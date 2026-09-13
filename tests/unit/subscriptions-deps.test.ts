import { describe, it, expect } from 'vitest';
import { getSubscriptionsDeps } from '@/lib/subscriptions/deps';
import { DummyStripeClient } from '@/lib/subscriptions/dummy';
import { StripeRestClient } from '@/lib/subscriptions/stripe-rest';

// The deps seam's key-selection safety, which is the whole reason ONE Lambda can
// serve both distributions (plan §6.1). The interesting cases are the FAIL-CLOSED
// ones: a prod request must never be served by test keys, and a missing key set
// must never degrade to the in-memory dummy inside the deployed Lambda.

const TEST_KEYS = {
  SECRET_KEY_TEST: 'sk_test_x',
  WEBHOOK_SECRET_TEST: 'whsec_test',
  PRICE_MONTHLY_TEST: 'price_m_test',
  PRICE_ANNUAL_TEST: 'price_a_test',
};
const LIVE_KEYS = {
  SECRET_KEY_LIVE: 'sk_live_x',
  WEBHOOK_SECRET_LIVE: 'whsec_live',
  PRICE_MONTHLY_LIVE: 'price_m_live',
  PRICE_ANNUAL_LIVE: 'price_a_live',
};

/** A request as it arrives through a distribution (CloudFront overwrites the marker). */
function req(env: 'dev' | 'prod' | null): Request {
  return new Request('https://x.test/api/subscriptions/status', {
    headers: env ? { 'x-octav-env': env } : {},
  });
}

const ENV_BASE = {
  SUBSCRIPTIONS_STORAGE: 'dynamodb',
  AUTH_USERS_TABLE: 'octav-users',
  AUTH_SESSIONS_TABLE: 'octav-sessions',
  AUTH_RATE_LIMITS_TABLE: 'octav-rate-limits',
};

function depsWith(keys: Record<string, string> | null, stripeMode = 'test') {
  return getSubscriptionsDeps({
    ...ENV_BASE,
    STRIPE_MODE: stripeMode,
    ...(keys ? { STRIPE_ENV: JSON.stringify(keys) } : {}),
  });
}

describe('subscriptions deps — key selection (plan §6.1)', () => {
  it('serves PROD from live keys and DEV from test keys', () => {
    const deps = depsWith({ ...TEST_KEYS, ...LIVE_KEYS });
    expect(deps.stripeModeFor(req('prod'))).toBe('live');
    expect(deps.stripeModeFor(req('dev'))).toBe('test');
    expect(deps.stripeFor(req('prod'))).toBeInstanceOf(StripeRestClient);
    expect(deps.stripeFor(req('dev'))).toBeInstanceOf(StripeRestClient);
  });

  it('REFUSES to serve a prod request from test keys (no live set configured)', () => {
    // The hazard this guards: without it, resolveStripeMode falls back to the
    // test key set and real customers get test-mode Checkout sessions.
    const deps = depsWith(TEST_KEYS);
    expect(deps.stripeModeFor(req('prod'))).toBe('test'); // resolution still falls back…
    expect(deps.stripeFor(req('prod'))).toBeNull(); // …but billing answers 503
    expect(deps.stripeFor(req('dev'))).toBeInstanceOf(StripeRestClient);
  });

  it('never serves the in-memory dummy once a real mode is configured', () => {
    // Empty STRIPE_ENV in the deployed Lambda: resolveStripeMode lands on
    // 'dummy', which would hand out fake checkout URLs that 404 at Stripe.
    const deps = depsWith(null);
    expect(deps.stripeFor(req('prod'))).toBeNull();
    expect(deps.stripeFor(req('dev'))).toBeNull();
  });

  it('refuses a dev request when only live keys exist (no test set to serve it)', () => {
    const deps = depsWith(LIVE_KEYS);
    expect(deps.stripeModeFor(req('dev'))).toBe('dummy');
    expect(deps.stripeFor(req('dev'))).toBeNull();
  });

  it('still hands local dev/e2e the controllable dummy', () => {
    // configuredStripeMode 'dummy' = `next dev`, the Next route handlers, e2e —
    // the seam's reason for existing. Must NOT be affected by the guards above.
    const deps = getSubscriptionsDeps({ SUBSCRIPTIONS_STORAGE: 'dummy', STRIPE_MODE: 'dummy' });
    expect(deps.stripeFor(req('dev'))).toBeInstanceOf(DummyStripeClient);
    expect(deps.stripeFor(req(null))).toBeInstanceOf(DummyStripeClient);
    expect(deps.stripeFor(req('prod'))).toBeInstanceOf(DummyStripeClient);
  });

  it('rejects a malformed STRIPE_ENV loudly at construction (deploy smoke class)', () => {
    expect(() => getSubscriptionsDeps({ ...ENV_BASE, STRIPE_MODE: 'test', STRIPE_ENV: '{not json' })).toThrow(
      /not valid JSON/
    );
    expect(() =>
      getSubscriptionsDeps({ ...ENV_BASE, STRIPE_MODE: 'test', STRIPE_ENV: JSON.stringify({ SECRET_KEY_TEST: 'sk_test_x' }) })
    ).toThrow(/no complete key set/);
  });

  it('refuses dummy storage/stripe inside AWS Lambda unless explicitly allowed', () => {
    expect(() =>
      getSubscriptionsDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-subscriptions', SUBSCRIPTIONS_STORAGE: 'dummy' })
    ).toThrow(/refusing dummy storage\/stripe inside AWS Lambda/);
    expect(() =>
      getSubscriptionsDeps({
        AWS_LAMBDA_FUNCTION_NAME: 'iblearn-subscriptions',
        SUBSCRIPTIONS_STORAGE: 'dummy',
        AUTH_ALLOW_DUMMY: '1',
      })
    ).not.toThrow();
  });
});
