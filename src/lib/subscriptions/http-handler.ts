import { resolveSession } from '../auth/session';
import { DEV_GATE_ERROR, devGateDenied } from '../auth/dev-gate';
import type { UserRecord } from '../auth/types';
import { tierFromSubscription } from '../auth/types';
import { getSubscriptionsDeps, type SubscriptionsDeps } from './deps';
import {
  CHECKOUT_MAX_BODY_BYTES,
  SUBSCRIPTION_SESSIONS_PER_WINDOW,
  SUBSCRIPTION_WINDOW_SECONDS,
  WEBHOOK_MAX_BODY_BYTES,
  billingFieldsFromSubscription,
  checkoutRequestSchema,
  hasLiveSubscription,
  isBillingStateStale,
  originForRequest,
  type StripeClient,
  type StripeEvent,
  type StripeSubscription,
} from './types';

// E4.2 — framework-agnostic subscriptions handler
// (docs/stripe-subscriptions-plan.md §6.2). Single source of truth for the
// /api/subscriptions contract: the Next routes (src/app/api/subscriptions/*,
// the dev/e2e path) and the production Lambda (lambda/subscriptions, behind
// the CloudFront /api/subscriptions + /api/subscriptions/* behaviours) both
// delegate here, exactly like the auth/progress/analytics/feedback/contact
// handlers.
//
// Endpoint table (plan §6.2):
//   POST /api/subscriptions/checkout  session          -> { url }
//   POST /api/subscriptions/portal    session          -> { url }
//   GET  /api/subscriptions/status    session          -> billing state
//   POST /api/subscriptions           Stripe signature -> webhook receiver
//   GET  /api/subscriptions/_health   none             -> CI smoke probe
//
// Security model:
//   * The three user endpoints require a session (401 login_required) and pass
//     the DEV allowlist gate (403 dev_allowlist) — the same ordering the
//     feedback POST uses.
//   * The webhook is authenticated by SIGNATURE, not session: Stripe has no
//     account here, so the DEV gate deliberately does NOT apply (a dev-origin
//     delivery verifies against the test secret, which is the correct scoping).
//     An unverifiable signature is rejected BEFORE parsing (plan §6.4 rule 1).
//   * `_health` stays open (plan §6.8: probes are never gated).
//   * Card data never appears in a request or response body — only brand and
//     last4 come back from Stripe, which is what keeps us in PCI SAQ A.
//
// Deliberately NOT in this slice:
//   * the live Stripe REST client (needs the E4.0 account) — `stripeFor`
//     returns null and billing answers 503 until it lands;
//   * trial-reminder emails on `trial_will_end` (E4.5);
//   * per-test response injection (plan §6.6). The dummy's own
//     completeCheckoutSession/advanceTo cover unit tests; the e2e injection
//     hook is deferred until the /account billing UI (E4.3) needs it.

/** Every response is built here so Cache-Control: no-store is uniform —
 *  billing state must never be cached by CloudFront or a browser. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

/** Upstream Stripe failure: 502, never a stack trace to the client. */
function stripeFailure(where: string, err: unknown): Response {
  console.error(`[subscriptions] ${where} failed:`, err instanceof Error ? err.message : err);
  return json({ error: 'billing_provider_error' }, 502);
}

type SessionResult =
  | { ok: true; user: UserRecord; refreshCookie: string }
  | { ok: false; response: Response };

/** Session + DEV allowlist gate, in the feedback handler's order. */
async function requireSession(req: Request, deps: SubscriptionsDeps): Promise<SessionResult> {
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return { ok: false, response: json({ error: 'login_required' }, 401) };
  if (devGateDenied(req, auth.user.email)) return { ok: false, response: json({ error: DEV_GATE_ERROR }, 403) };
  return { ok: true, user: auth.user, refreshCookie: auth.refreshCookie };
}

/** Parse a small JSON body, or answer 400. */
async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, response: json({ error: 'Invalid request' }, 400) };
  if (!text) return { ok: false, response: json({ error: 'Invalid request' }, 400) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: json({ error: 'Invalid JSON body' }, 400) };
  }
}

/** Bound Stripe session creation per user (Q4), then hand back the client. */
async function beginStripeCall(
  req: Request,
  deps: SubscriptionsDeps,
  userId: string
): Promise<{ ok: true; stripe: StripeClient } | { ok: false; response: Response }> {
  const allowed = await deps.storage.incrementSessionBudget(
    userId,
    SUBSCRIPTION_SESSIONS_PER_WINDOW,
    SUBSCRIPTION_WINDOW_SECONDS
  );
  if (!allowed) return { ok: false, response: json({ error: 'rate_limited' }, 429) };

  const stripe = deps.stripeFor(req);
  if (!stripe) return { ok: false, response: json({ error: 'billing_unavailable' }, 503) };
  return { ok: true, stripe };
}

// ---------------------------------------------------------------------------
// POST /api/subscriptions/checkout
// ---------------------------------------------------------------------------

export async function handleCheckoutPost(
  req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  const session = await requireSession(req, deps);
  if (!session.ok) return session.response;
  const { user, refreshCookie } = session;

  const body = await readJson(req, CHECKOUT_MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = checkoutRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    return json(
      { error: 'Invalid request', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      400
    );
  }

  // Q3: an existing subscription must block a new one — Stripe would happily
  // create a SECOND subscription and charge the same card again. Cheapest and
  // most definitive check first, so it cannot even consume budget.
  if (hasLiveSubscription(user.subscriptionStatus)) {
    return withCookie(json({ error: 'already_subscribed' }, 409), refreshCookie);
  }

  const call = await beginStripeCall(req, deps, user.userId);
  if (!call.ok) return withCookie(call.response, refreshCookie);

  const origin = originForRequest(req);
  let sessionUrl: string;
  try {
    const created = await call.stripe.createCheckoutSession({
      userId: user.userId,
      email: user.email,
      plan: parsed.data.plan,
      // E4.3 reads ?billing=updated to confirm the trial started.
      successUrl: `${origin}/account?billing=updated`,
      cancelUrl: `${origin}/pricing`,
      trialDays: deps.trialDays,
    });
    sessionUrl = created.url;
  } catch (err) {
    return stripeFailure('createCheckoutSession', err);
  }

  return withCookie(json({ url: sessionUrl, plan: parsed.data.plan, trialDays: deps.trialDays }), refreshCookie);
}

// ---------------------------------------------------------------------------
// POST /api/subscriptions/portal
// ---------------------------------------------------------------------------

export async function handlePortalPost(
  req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  const session = await requireSession(req, deps);
  if (!session.ok) return session.response;
  const { user, refreshCookie } = session;

  // No customer = nothing to manage. (A client-supplied returnUrl is
  // deliberately not accepted — see types.ts: open-redirect vector.)
  if (!user.stripeCustomerId) {
    return withCookie(json({ error: 'no_billing_account' }, 409), refreshCookie);
  }

  const call = await beginStripeCall(req, deps, user.userId);
  if (!call.ok) return withCookie(call.response, refreshCookie);

  let url: string;
  try {
    const portal = await call.stripe.createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${originForRequest(req)}/account`,
    });
    url = portal.url;
  } catch (err) {
    return stripeFailure('createPortalSession', err);
  }

  return withCookie(json({ url }), refreshCookie);
}

// ---------------------------------------------------------------------------
// GET /api/subscriptions/status
// ---------------------------------------------------------------------------

/** The billing view for /account. Card fields are display metadata only. */
function statusPayload(user: UserRecord) {
  return {
    plan: user.subscriptionPlan ?? null,
    status: user.subscriptionStatus ?? null,
    tier: user.tier,
    currentPeriodEnd: user.currentPeriodEnd ?? null,
    trialEndsAt: user.trialEndsAt ?? null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
    card: user.cardLast4
      ? {
          brand: user.cardBrand ?? null,
          last4: user.cardLast4,
          expMonth: user.cardExpMonth ?? null,
          expYear: user.cardExpYear ?? null,
        }
      : null,
  };
}

export async function handleStatusGet(
  req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  const session = await requireSession(req, deps);
  if (!session.ok) return session.response;
  let { user } = session;
  const { refreshCookie } = session;

  // Plan §6.4.1 mitigation 1: Stripe is the source of truth and this row is a
  // cache, so re-read whenever the cache is stale and write the correction
  // back. That is what self-heals a missed webhook without a cron job — and it
  // is bounded, because isBillingStateStale is false for every user who has
  // never subscribed, so free page views cost no Stripe call.
  if (user.subscriptionStatus && isBillingStateStale(user, deps.clock()) && user.stripeSubscriptionId) {
    const stripe = deps.stripeFor(req);
    if (stripe) {
      try {
        const fresh = await stripe.retrieveSubscription(user.stripeSubscriptionId);
        if (fresh) {
          const updates = billingFieldsFromSubscription(fresh);
          const updated = await deps.storage.updateUser(user.userId, updates);
          if (updated) user = updated;
        } else {
          // Stripe no longer knows this subscription: it ended. Downgrading
          // here closes the premium-leak direction the plan calls out, rather
          // than leaving a cancelled user entitled forever.
          const updated = await deps.storage.updateUser(user.userId, {
            subscriptionStatus: 'canceled',
            cancelAtPeriodEnd: false,
            tier: tierFromSubscription('canceled'),
          });
          if (updated) user = updated;
        }
      } catch (err) {
        // A failed reconciliation must not break the page — serve the cached
        // copy and let the next request retry.
        console.error('[subscriptions] status reconciliation failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  return withCookie(json(statusPayload(user)), refreshCookie);
}

// ---------------------------------------------------------------------------
// POST /api/subscriptions — Stripe webhook
// ---------------------------------------------------------------------------

/** Event types we act on; anything else is acknowledged and ignored
 *  (plan §6.4 rule 4: 200 for events we intentionally ignore). */
const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

/** Subscription id referenced by an event, whatever its shape. */
function subscriptionIdFromEvent(event: StripeEvent): string | null {
  const object = event.data.object ?? {};
  const direct = object.subscription;
  if (typeof direct === 'string' && direct) return direct;
  // customer.subscription.* events carry the subscription itself.
  if (typeof object.id === 'string' && object.id.startsWith('sub_')) return object.id;
  return null;
}

/**
 * Apply one event. Always RE-READS the subscription from Stripe instead of
 * trusting the event payload: Stripe does not guarantee delivery order
 * (plan §6.4 rule 3), so a stale snapshot must never overwrite newer state.
 */
async function applyEvent(
  event: StripeEvent,
  stripe: StripeClient,
  deps: SubscriptionsDeps
): Promise<'applied' | 'ignored'> {
  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) {
    console.warn(`[subscriptions] ${event.type} carried no subscription id — ignored`);
    return 'ignored';
  }

  const sub: StripeSubscription | null = await stripe.retrieveSubscription(subscriptionId);
  if (!sub) {
    console.warn(`[subscriptions] subscription ${subscriptionId} not found at Stripe — ignored`);
    return 'ignored';
  }

  // Subscriptions we did not create carry no userId metadata; ignore rather
  // than guess (a wrong attribution would move someone's entitlement).
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.warn(`[subscriptions] subscription ${sub.id} has no userId metadata — ignored`);
    return 'ignored';
  }

  const updated = await deps.storage.updateUser(userId, billingFieldsFromSubscription(sub));
  if (!updated) {
    // Deleted account: acknowledge so Stripe stops retrying an event we can
    // never apply.
    console.warn(`[subscriptions] no user ${userId} for ${event.type} — acknowledged without applying`);
    return 'ignored';
  }
  return 'applied';
}

export async function handleWebhookPost(
  req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  const raw = await req.text();
  if (raw.length > WEBHOOK_MAX_BODY_BYTES) return json({ error: 'Invalid request' }, 400);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'missing_signature' }, 400);

  const stripe = deps.stripeFor(req);
  if (!stripe) return json({ error: 'billing_unavailable' }, 503);

  // Rule 1: verify BEFORE parsing. constructEvent must throw on a bad
  // signature — the dummy implements Stripe's real HMAC scheme so the reject
  // path is genuinely exercised, not stubbed open.
  let event: StripeEvent;
  try {
    event = stripe.constructEvent(raw, signature);
  } catch (err) {
    console.error('[subscriptions] webhook signature rejected:', err instanceof Error ? err.message : err);
    return json({ error: 'invalid_signature' }, 400);
  }

  // Rule 2: idempotent by event id — Stripe retries, and a replay must not
  // double-apply. Marked BEFORE applying so a crash mid-apply cannot be
  // replayed into a duplicate; the re-read in applyEvent makes a missed write
  // self-correcting on the next event anyway.
  const first = await deps.storage.markEventProcessed(event.id);
  if (!first) return json({ received: true, duplicate: true });

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return json({ received: true, ignored: true });
  }

  try {
    const result = await applyEvent(event, stripe, deps);
    return json({ received: true, ...(result === 'ignored' ? { ignored: true } : {}) });
  } catch (err) {
    // Rule 4: fail loudly so Stripe retries. (The event id is already marked
    // processed, so the retry re-reads authoritative state rather than
    // double-applying — which is exactly why applyEvent never trusts the
    // payload.)
    console.error(`[subscriptions] webhook ${event.type} failed:`, err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/subscriptions/_health — unauthenticated CI smoke probe
// ---------------------------------------------------------------------------

export async function handleSubscriptionsHealth(
  _req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  // Q2: prove BOTH the table/IAM grants and that STRIPE_ENV is usable, without
  // any network call to Stripe (a Stripe blip must not fail a deploy).
  if (!deps.stripeConfig.ok) {
    console.error('[subscriptions] health: STRIPE_ENV unusable:', deps.stripeConfig.error);
    return json({ ok: false }, 500);
  }
  if (deps.configuredStripeMode !== 'dummy') {
    const keySet = deps.configuredStripeMode === 'live' ? deps.stripeConfig.live : deps.stripeConfig.test;
    if (!keySet) {
      // A wiped or partial secret must go red at deploy time, not at the first
      // real checkout — the FEEDBACK_ENV incident class.
      console.error(`[subscriptions] health: STRIPE_ENV has no ${deps.configuredStripeMode} key set`);
      return json({ ok: false }, 500);
    }
  }
  try {
    await deps.storage.probeTable();
    return json({ ok: true });
  } catch (err) {
    console.error('[subscriptions] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}
