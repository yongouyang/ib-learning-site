import { describe, it, expect, afterEach, vi } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import type { AuthDeps } from '@/lib/auth/types';
import {
  handleCheckoutPost,
  handlePortalPost,
  handleStatusGet,
  handleSubscriptionsHealth,
  handleWebhookPost,
} from '@/lib/subscriptions/http-handler';
import { DummyStripeClient, InMemorySubscriptionsStorage } from '@/lib/subscriptions/dummy';
import type { SubscriptionsDeps } from '@/lib/subscriptions/deps';
import type { StripeSubscription } from '@/lib/subscriptions/types';
import {
  isBillingStateStale,
  originForRequest,
  parseStripeEnv,
  resolveStripeMode,
} from '@/lib/subscriptions/types';

// Handler-level tests for the E4.2 subscriptions API. One fresh shared universe
// per test (the SAME in-memory store backs both the auth session and the
// billing storage, exactly like production — session validation reuses it). The
// dummy Stripe client is shared between the test and the handler's `stripeFor`
// so a checkout the handler creates can be "completed" by the test, and the
// webhook re-reads the very subscription the dummy holds.

const DUMMY_CODE = '123456';
const T0 = Date.parse('2026-08-25T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `sub-${counter}@example.com`;
}

interface TestCtx {
  storage: InMemorySubscriptionsStorage;
  stripe: DummyStripeClient;
  deps: SubscriptionsDeps;
  authDeps: AuthDeps;
  clock: () => number;
}

function makeCtx(opts: { webhookSecret?: string; clock?: () => number } = {}): TestCtx {
  // The dummy Stripe client works in SECONDS; the handler's `clock` (staleness
  // checks) works in MILLISECONDS. Keep the two conventions separate.
  const clockMs = opts.clock ?? (() => T0);
  const clockSec = () => Math.floor(clockMs() / 1000);
  const storage = new InMemorySubscriptionsStorage(clockMs);
  const stripe = new DummyStripeClient({ clock: clockSec, webhookSecret: opts.webhookSecret ?? 'whsec_test' });
  const deps: SubscriptionsDeps = {
    storage,
    // The handler and the test share the ONE dummy instance — see header.
    stripeFor: () => stripe,
    stripeModeFor: () => 'dummy',
    stripeConfig: { ok: true },
    configuredStripeMode: 'dummy',
    trialDays: 14,
    clock: clockMs,
    testMode: false,
    dummyMode: true,
  };
  const authDeps: AuthDeps = { storage, emailSender: new DummyEmailSender(), testMode: true, dummyMode: true };
  return { storage, stripe, deps, authDeps, clock: clockMs };
}

function req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No Set-Cookie header');
  return `octav_session=${setCookie.split(';')[0].split('=')[1] ?? ''}`;
}

async function login(ctx: TestCtx, email = uniqueEmail()): Promise<{ cookie: string; userId: string }> {
  await handleRequestOtp(req('POST', 'https://x.test/api/auth/request-otp', { email }), ctx.authDeps);
  const res = await handleVerifyOtp(
    req('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
    ctx.authDeps
  );
  expect(res.status).toBe(200);
  return { cookie: cookieFrom(res), userId: (await res.json()).user.userId };
}

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/subscriptions/checkout', () => {
  it('requires a session (401) then rejects the DEV gate (403)', async () => {
    const ctx = makeCtx();
    expect(
      (await handleCheckoutPost(req('POST', 'https://x/api/subscriptions/checkout', { plan: 'monthly' }), ctx.deps)).status
    ).toBe(401);

    vi.stubEnv('DEV_ALLOWED_EMAILS', 'staff@example.com');
    const { cookie } = await login(ctx, 'guest@example.com');
    const res = await handleCheckoutPost(
      req('POST', 'https://x/api/subscriptions/checkout', { plan: 'monthly' }, { 'x-octav-env': 'dev', cookie }),
      ctx.deps
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'dev_allowlist' });
  });

  it('rejects a malformed plan (400)', async () => {
    const ctx = makeCtx();
    const { cookie } = await login(ctx);
    const res = await handleCheckoutPost(
      req('POST', 'https://x/api/subscriptions/checkout', { plan: 'lifetime' }, { cookie }),
      ctx.deps
    );
    expect(res.status).toBe(400);
  });

  it('blocks a second subscription with 409 (no double-charge)', async () => {
    const ctx = makeCtx();
    const { cookie, userId } = await login(ctx);
    await ctx.storage.updateUser(userId, { subscriptionStatus: 'active', subscriptionPlan: 'monthly' });
    const res = await handleCheckoutPost(
      req('POST', 'https://x/api/subscriptions/checkout', { plan: 'annual' }, { cookie }),
      ctx.deps
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'already_subscribed' });
  });

  it('rate-limits per user (429 on the 21st attempt)', async () => {
    const ctx = makeCtx({ clock: () => T0 }); // frozen clock → one bucket
    const { cookie } = await login(ctx);
    let last = 200;
    for (let i = 0; i < 21; i++) {
      const res = await handleCheckoutPost(
        req('POST', 'https://x/api/subscriptions/checkout', { plan: 'monthly' }, { cookie }),
        ctx.deps
      );
      last = res.status;
      if (i < 20) expect(res.status).toBe(200);
    }
    expect(last).toBe(429);
  });

  it('returns the checkout URL on success and sets origin from the marker', async () => {
    const ctx = makeCtx();
    const { cookie } = await login(ctx);
    const res = await handleCheckoutPost(
      req('POST', 'https://x/api/subscriptions/checkout', { plan: 'monthly' }, { 'x-octav-env': 'dev', cookie }),
      ctx.deps
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The dummy returns a checkout URL verbatim; the real Stripe URL embeds the
    // (marker-derived) success target, which originForRequest covers in isolation.
    expect(body.url).toContain('checkout.stripe.com');
  });

  it('reports billing_unavailable when no client is configured (503)', async () => {
    const ctx = makeCtx();
    const { cookie } = await login(ctx);
    ctx.deps = { ...ctx.deps, stripeFor: () => null };
    const res = await handleCheckoutPost(
      req('POST', 'https://x/api/subscriptions/checkout', { plan: 'monthly' }, { cookie }),
      ctx.deps
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'billing_unavailable' });
  });
});

describe('POST /api/subscriptions/portal', () => {
  it('needs a billing account (409 no_billing_account)', async () => {
    const ctx = makeCtx();
    const { cookie } = await login(ctx);
    const res = await handlePortalPost(req('POST', 'https://x/api/subscriptions/portal', {}, { cookie }), ctx.deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'no_billing_account' });
  });

  it('returns a portal URL for a known customer', async () => {
    const ctx = makeCtx();
    const { cookie, userId } = await login(ctx);
    await ctx.storage.updateUser(userId, { stripeCustomerId: 'cus_1' });
    const res = await handlePortalPost(req('POST', 'https://x/api/subscriptions/portal', {}, { cookie }), ctx.deps);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain('billing.stripe.com');
  });
});

describe('GET /api/subscriptions/status', () => {
  it('returns the cached billing view', async () => {
    const ctx = makeCtx();
    const { cookie, userId } = await login(ctx);
    await ctx.storage.updateUser(userId, {
      subscriptionStatus: 'active',
      subscriptionPlan: 'annual',
      currentPeriodEnd: new Date(T0 + 30 * DAY).toISOString(),
      cardLast4: '4242',
      cardBrand: 'visa',
      tier: 'premium',
    });
    const res = await handleStatusGet(
      req('GET', 'https://x/api/subscriptions/status', undefined, { cookie }),
      ctx.deps
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'active',
      plan: 'annual',
      tier: 'premium',
      card: { brand: 'visa', last4: '4242' },
    });
  });

  it('self-heals a missed conversion by re-reading Stripe (trial → active)', async () => {
    const ctx = makeCtx({ clock: () => T0 });
    const { cookie, userId } = await login(ctx);

    // A trial that the webhook missed converting. The cached copy is now stale
    // (trial end in the past), but the dummy holds the real, now-active sub.
    const session = await ctx.stripe.createCheckoutSession({
      userId,
      email: 'u@x.com',
      plan: 'monthly',
      trialDays: 14,
      successUrl: '',
      cancelUrl: '',
    });
    const sub = await ctx.stripe.completeCheckoutSession(session.id);
    ctx.stripe.advanceTo(T0 / 1000 + 15 * 24 * 60 * 60); // past the trial boundary → active

    await ctx.storage.updateUser(userId, {
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(T0).toISOString(),
      currentPeriodEnd: new Date(T0 + 14 * DAY).toISOString(),
      stripeSubscriptionId: sub!.id,
    });

    const res = await handleStatusGet(
      req('GET', 'https://x/api/subscriptions/status', undefined, { cookie }),
      ctx.deps
    );
    expect(await res.json()).toMatchObject({ status: 'active', tier: 'premium' });
  });

  it('downgrades when Stripe no longer knows the subscription (closes the premium leak)', async () => {
    const ctx = makeCtx({ clock: () => T0 });
    const { cookie, userId } = await login(ctx);
    await ctx.storage.updateUser(userId, {
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date(T0 - DAY).toISOString(), // stale → triggers re-read
      stripeSubscriptionId: 'sub_does_not_exist',
      tier: 'premium',
    });
    const res = await handleStatusGet(
      req('GET', 'https://x/api/subscriptions/status', undefined, { cookie }),
      ctx.deps
    );
    expect(await res.json()).toMatchObject({ status: 'canceled', tier: 'free' });
  });
});

describe('POST /api/subscriptions (webhook)', () => {
  async function seedTrial(ctx: TestCtx, userId: string): Promise<StripeSubscription> {
    const session = await ctx.stripe.createCheckoutSession({
      userId,
      email: 'u@x.com',
      plan: 'monthly',
      trialDays: 14,
      successUrl: '',
      cancelUrl: '',
    });
    const sub = await ctx.stripe.completeCheckoutSession(session.id);
    if (!sub) throw new Error('checkout did not create a subscription');
    return sub; // emits + stores sub
  }

  function webhookRequest(event: unknown, secret: string): Request {
    const raw = JSON.stringify(event);
    const sig = new DummyStripeClient({ webhookSecret: secret }).signPayload(raw);
    return new Request('https://x/api/subscriptions', {
      method: 'POST',
      headers: { 'stripe-signature': sig },
      body: raw,
    });
  }

  it('rejects a missing and an invalid signature (400)', async () => {
    const ctx = makeCtx();
    const noSig = await handleWebhookPost(req('POST', 'https://x/api/subscriptions', { id: 'evt_1' }), ctx.deps);
    expect(noSig.status).toBe(400);
    expect(await noSig.json()).toMatchObject({ error: 'missing_signature' });

    const bad = await handleWebhookPost(
      new Request('https://x/api/subscriptions', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: JSON.stringify({ id: 'evt_1' }),
      }),
      ctx.deps
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'invalid_signature' });
  });

  it('flips a user to premium from a checkout.session.completed event', async () => {
    const ctx = makeCtx();
    const { userId } = await login(ctx);
    const sub = await seedTrial(ctx, userId);

    const events = ctx.stripe.takeEvents();
    const completed = events.find((e) => e.type === 'checkout.session.completed')!;
    const res = await handleWebhookPost(webhookRequest(completed, 'whsec_test'), ctx.deps);
    expect(res.status).toBe(200);

    const user = await ctx.storage.getUserById(userId);
    expect(user?.subscriptionStatus).toBe('trialing');
    expect(user?.tier).toBe('premium');
    expect(user?.stripeSubscriptionId).toBe(sub.id);
  });

  it('is idempotent by event id (a replay is a no-op, not a double-apply)', async () => {
    const ctx = makeCtx();
    const { userId } = await login(ctx);
    await seedTrial(ctx, userId);
    const completed = ctx.stripe.takeEvents().find((e) => e.type === 'checkout.session.completed')!;

    expect((await handleWebhookPost(webhookRequest(completed, 'whsec_test'), ctx.deps)).status).toBe(200);
    const second = await handleWebhookPost(webhookRequest(completed, 'whsec_test'), ctx.deps);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ received: true, duplicate: true });
    // Exactly one markEventProcessed win — the ledger proves it.
    expect(await ctx.storage.markEventProcessed(completed.id)).toBe(false);
  });

  it('acknowledges (200) events it intentionally ignores', async () => {
    const ctx = makeCtx();
    const ping = { id: 'evt_ping', type: 'ping', created: Math.floor(T0 / 1000), data: { object: {} } };
    const res = await handleWebhookPost(webhookRequest(ping, 'whsec_test'), ctx.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, ignored: true });
  });
});

describe('GET /api/subscriptions/_health', () => {
  it('passes when dummy and fails on a missing key set', async () => {
    const good = makeCtx();
    expect((await handleSubscriptionsHealth(req('GET', 'https://x/api/subscriptions/_health'), good.deps)).status).toBe(200);

    const broken = makeCtx();
    broken.deps = { ...broken.deps, configuredStripeMode: 'test', stripeConfig: { ok: true } }; // no test key set
    expect((await handleSubscriptionsHealth(req('GET', 'https://x/api/subscriptions/_health'), broken.deps)).status).toBe(500);

    const malformed = makeCtx();
    malformed.deps = { ...malformed.deps, stripeConfig: { ok: false, error: 'bad json' } };
    expect((await handleSubscriptionsHealth(req('GET', 'https://x/api/subscriptions/_health'), malformed.deps)).status).toBe(500);
  });
});

// --- Pure helpers ------------------------------------------------------------

describe('resolveStripeMode — the fail-safe (plan §6.1)', () => {
  const liveConfig = { ok: true as const, live: {} as never, test: {} as never };
  const testOnly = { ok: true as const, test: {} as never };

  it('never resolves live without an explicit prod marker', async () => {
    const prodReq = req('POST', 'https://x/api/subscriptions/checkout', undefined, { 'x-octav-env': 'prod' });
    const devReq = req('POST', 'https://x/api/subscriptions/checkout', undefined, { 'x-octav-env': 'dev' });
    const noMarker = req('POST', 'https://x/api/subscriptions/checkout');

    expect(resolveStripeMode(prodReq, 'live', liveConfig)).toBe('live');
    expect(resolveStripeMode(devReq, 'live', liveConfig)).toBe('test');
    expect(resolveStripeMode(noMarker, 'live', liveConfig)).toBe('test');
  });

  it('dummy stays dummy regardless of the marker', () => {
    const prodReq = req('POST', 'https://x/api/subscriptions/checkout', undefined, { 'x-octav-env': 'prod' });
    expect(resolveStripeMode(prodReq, 'dummy', { ok: true, test: {} as never })).toBe('dummy');
  });

  it('test configuration ignores the marker entirely', () => {
    const devReq = req('POST', 'https://x/api/subscriptions/checkout', undefined, { 'x-octav-env': 'dev' });
    expect(resolveStripeMode(devReq, 'test', testOnly)).toBe('test');
  });
});

describe('originForRequest', () => {
  it('maps the marker to the right origin and never trusts a remote Host', () => {
    const prod = req('GET', 'https://x/api/subscriptions/status', undefined, { 'x-octav-env': 'prod' });
    const dev = req('GET', 'https://x/api/subscriptions/status', undefined, { 'x-octav-env': 'dev' });
    const local = req('GET', 'https://localhost:3000/api/subscriptions/status');
    const spoofed = new Request('https://localhost:3000/api/subscriptions/status', {
      headers: { host: 'evil.example.com' },
    });

    expect(originForRequest(prod)).toBe('https://octavlearning.com');
    expect(originForRequest(dev)).toBe('https://dev.octavlearning.com');
    expect(originForRequest(local)).toBe('http://localhost:3000');
    // Defensive: an attacker-controlled Host must not become a Stripe return URL.
    expect(originForRequest(spoofed)).toBe('http://localhost:3000');
  });
});

describe('isBillingStateStale (plan §6.4.1 reconciliation)', () => {
  const mk = (over: Partial<{ subscriptionStatus: any; trialEndsAt: string; currentPeriodEnd: string }>) =>
    ({
      userId: 'u',
      email: 'e',
      displayName: 'n',
      role: 'parent',
      tier: 'free',
      childProfiles: [],
      createdAt: '',
      lastLoginAt: '',
      ...over,
    }) as any;
  const future = new Date(T0 + 30 * DAY).toISOString();
  const past = new Date(T0 - DAY).toISOString();

  it('is false for never-subscribed and canceled users', () => {
    expect(isBillingStateStale(mk({}), T0)).toBe(false);
    expect(isBillingStateStale(mk({ subscriptionStatus: 'canceled' }), T0)).toBe(false);
  });

  it('re-reads a trialing user only once the trial end has passed', () => {
    expect(isBillingStateStale(mk({ subscriptionStatus: 'trialing', trialEndsAt: past }), T0)).toBe(true);
    expect(isBillingStateStale(mk({ subscriptionStatus: 'trialing', trialEndsAt: future }), T0)).toBe(false);
  });

  it('re-reads when the current period has ended', () => {
    expect(isBillingStateStale(mk({ subscriptionStatus: 'active', currentPeriodEnd: past }), T0)).toBe(true);
    expect(isBillingStateStale(mk({ subscriptionStatus: 'active', currentPeriodEnd: future }), T0)).toBe(false);
  });

  it('does NOT treat a converted sub’s stale trialEndsAt as stale', () => {
    // DynamoDB cannot store undefined, so a converted subscription keeps its
    // now-past trialEndsAt; treating it as stale would re-read forever.
    expect(isBillingStateStale(mk({ subscriptionStatus: 'active', currentPeriodEnd: future, trialEndsAt: past }), T0)).toBe(false);
  });
});

describe('parseStripeEnv', () => {
  it('treats an empty secret as unconfigured, not an error', () => {
    expect(parseStripeEnv(undefined).ok).toBe(true);
    expect(parseStripeEnv('').ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    const r = parseStripeEnv('{not json');
    expect(r.ok).toBe(false);
  });

  it('requires a complete key set; a partial set is ignored', () => {
    expect(parseStripeEnv('{"SECRET_KEY_LIVE":"sk_live_x"}').ok).toBe(false);
    const full = parseStripeEnv(
      '{"SECRET_KEY_TEST":"sk_test_x","WEBHOOK_SECRET_TEST":"whsec_t","PRICE_MONTHLY_TEST":"p_m","PRICE_ANNUAL_TEST":"p_a"}'
    );
    expect(full.ok).toBe(true);
    expect(full.test?.priceIds.monthly).toBe('p_m');
  });
});
