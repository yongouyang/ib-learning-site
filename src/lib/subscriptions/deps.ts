import { getSharedDummyUniverse } from '../progress/deps';
import { DummyStripeClient } from './dummy';
import {
  parseStripeEnv,
  resolveStripeMode,
  type ResolvedStripeMode,
  type StripeClient,
  type StripeConfig,
  type SubscriptionsStorage,
} from './types';

// Dependency wiring for the subscriptions handler (E4 —
// docs/stripe-subscriptions-plan.md §6). Two independent selections, matching
// the auth/progress/feedback precedent:
//   SUBSCRIPTIONS_STORAGE = "dummy" (default) | "dynamodb"
//   STRIPE_MODE           = "dummy" (default) | "test" | "live"
//
// Defaulting BOTH to the dummy means local dev and e2e run with zero AWS
// resources and zero Stripe calls — and it is what lets the whole subscription
// flow be built and tested before a Stripe account exists (E4.0 is user-owned
// and can lag). Same fail-closed guard as every other Lambda: dummy wiring is
// refused inside AWS unless AUTH_ALLOW_DUMMY=1.
//
// `STRIPE_MODE` is a CAPABILITY, not the answer for a given request: one Lambda
// serves both distributions, so which key set applies is decided per request
// from the CloudFront-overwritten X-Octav-Env marker (plan §6.1). See
// resolveStripeMode — live requires an explicit `prod`.

export interface SubscriptionsDeps {
  storage: SubscriptionsStorage;
  /**
   * The Stripe client for THIS request, or null when billing is not configured
   * (unconfigured STRIPE_ENV, or a mode whose client is not wired yet). Null
   * rather than a throw so handlers can answer 503 `billing_unavailable`
   * instead of surfacing a 500.
   */
  stripeFor(req: Request): StripeClient | null;
  stripeModeFor(req: Request): ResolvedStripeMode;
  /** Parsed STRIPE_ENV — `_health` asserts it is usable (Q2). */
  stripeConfig: StripeConfig;
  /** The configured capability, before per-request selection. */
  configuredStripeMode: ResolvedStripeMode;
  /** Trial length in days (plan §2.2: 14). */
  trialDays: number;
  clock: () => number;
  /** Enables per-test response injection (the feedback `_testResponse` precedent). */
  testMode: boolean;
  /** True only with the in-memory dummy storage. */
  dummyMode: boolean;
}

const STRIPE_MODES: readonly ResolvedStripeMode[] = ['dummy', 'test', 'live'];

export function getSubscriptionsDeps(
  env: Record<string, string | undefined> = process.env
): SubscriptionsDeps {
  const kind = env.SUBSCRIPTIONS_STORAGE ?? 'dummy';
  const configuredStripeMode = (env.STRIPE_MODE ?? 'dummy') as ResolvedStripeMode;

  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy' || configuredStripeMode === 'dummy') {
      throw new Error(
        '[subscriptions] refusing dummy storage/stripe inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[subscriptions] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production'
      );
    }
  }
  if (!STRIPE_MODES.includes(configuredStripeMode)) {
    throw new Error(`[subscriptions] STRIPE_MODE must be one of ${STRIPE_MODES.join(', ')} (got "${configuredStripeMode}")`);
  }

  const stripeConfig = parseStripeEnv(env.STRIPE_ENV);
  if (!stripeConfig.ok) {
    // Loud at construction: a malformed secret must fail the deploy smoke, not
    // silently degrade every checkout (the FEEDBACK_ENV incident class).
    throw new Error(`[subscriptions] ${stripeConfig.error}`);
  }

  // ONE dummy client per deps instance so its in-memory subscriptions survive
  // across requests within a process — the same reasoning as the shared
  // in-memory universe.
  const dummy = new DummyStripeClient({ webhookSecret: env.STRIPE_WEBHOOK_SECRET });

  const stripeModeFor = (req: Request): ResolvedStripeMode =>
    resolveStripeMode(req, configuredStripeMode, stripeConfig);

  const stripeFor = (req: Request): StripeClient | null => {
    const mode = stripeModeFor(req);
    if (mode === 'dummy') return dummy;
    // E4.2 follow-up: the live Stripe REST client (checkout sessions, portal,
    // subscription reads, webhook verification) lands with the Stripe account
    // (E4.0). Billing reports unavailable until then rather than half-working.
    console.error(
      `[subscriptions] STRIPE_MODE=${mode} resolved but the live Stripe client is not wired yet (E4.2 follow-up) — billing unavailable`
    );
    return null;
  };

  const trialDays = Number(env.STRIPE_TRIAL_DAYS ?? 14);

  if (kind === 'dummy') {
    return {
      storage: getSharedDummyUniverse(),
      stripeFor,
      stripeModeFor,
      stripeConfig,
      configuredStripeMode,
      trialDays,
      clock: Date.now,
      testMode: env.SUBSCRIPTIONS_TEST_MODE === '1',
      dummyMode: true,
    };
  }

  if (kind === 'dynamodb') {
    // The DynamoDB subscriptions storage adapter lands with the live client
    // (E4.2 follow-up): it needs the real table names plus the rate-limit and
    // event-ledger grants. The seam and the faithful dummy are in place so the
    // handler, routes and tests are buildable and testable now.
    throw new Error(
      '[subscriptions] dynamodb storage is not wired yet (E4.2 follow-up: subscriptions dynamodb-storage adapter + live Stripe client)'
    );
  }

  throw new Error(`[subscriptions] SUBSCRIPTIONS_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
