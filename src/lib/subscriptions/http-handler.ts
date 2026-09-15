import { resolveSession } from '../auth/session';
import { DEV_GATE_ERROR, devGateDenied, isProdRequest } from '../auth/dev-gate';
import type { UserRecord } from '../auth/types';
import { tierFromSubscription } from '../auth/types';
import { formatAmount, formatChargeDate, renderTrialEndingEmail } from './email';
import { getSubscriptionsDeps, type SubscriptionsDeps } from './deps';
import {
  isoFromEpochSeconds,
  CHECKOUT_MAX_BODY_BYTES,
  SUBSCRIPTION_SESSIONS_PER_WINDOW,
  SUBSCRIPTION_WINDOW_SECONDS,
  WEBHOOK_MAX_BODY_BYTES,
  billingDisabled,
  billingFieldsFromSubscription,
  checkoutRequestSchema,
  hasLiveSubscription,
  isBillingStateStale,
  originForRequest,
  type CheckoutSession,
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
//   POST /api/subscriptions/checkout  session          -> { client_secret, url? }
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

  // Closed to NEW subscriptions in this environment (BILLING_DISABLED_ENVS). Checked
  // BEFORE beginStripeCall so a closed environment cannot consume the user's session
  // budget, and returning 503 rather than 403 because the honest reading is "billing is
  // not available here", which is also what the UI is told. The WEBHOOK and the Portal
  // are deliberately NOT gated — see billingDisabled() for why.
  if (billingDisabled(req, deps.billingDisabledEnvs)) {
    return withCookie(json({ error: 'billing_disabled' }, 503), refreshCookie);
  }

  const call = await beginStripeCall(req, deps, user.userId);
  if (!call.ok) return withCookie(call.response, refreshCookie);

  const origin = originForRequest(req);
  let created: CheckoutSession;
  try {
    created = await call.stripe.createCheckoutSession({
      userId: user.userId,
      email: user.email,
      plan: parsed.data.plan,
      // The embedded form redirects here after a successful payment (it is sent
      // as `return_url` — ui_mode=form rejects success_url). E4.3 reads
      // ?billing=updated to confirm the trial started.
      successUrl: `${origin}/account?billing=updated`,
      cancelUrl: `${origin}/pricing`,
      trialDays: deps.trialDays,
    });
  } catch (err) {
    return stripeFailure('createCheckoutSession', err);
  }

  // The client mounts the embedded form from `client_secret`. `url` is present
  // only in dev/e2e (the dummy's hosted fallback, used when no Stripe.js
  // publishable key is configured) — the real client returns none.
  return withCookie(
    json({
      client_secret: created.clientSecret,
      ...(created.url ? { url: created.url } : {}),
      plan: parsed.data.plan,
      trialDays: deps.trialDays,
    }),
    refreshCookie
  );
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

/** The billing view for /account. Card fields are display metadata only.
 *  `billingAvailable` tells the UI whether a Stripe client actually resolves for
 *  THIS request, so /pricing can show "not taking payments yet" instead of a
 *  button that 503s. It is deliberately derived from `stripeFor(req)` — the same
 *  seam the endpoints use — rather than re-deriving the mode here, so the UI and
 *  the API can never disagree. Prod is false until a LIVE key set exists, AND false
 *  whenever this environment is closed to new subscriptions by
 *  `BILLING_DISABLED_ENVS` (see billingDisabled) — which is how production shows
 *  "Premium is coming soon" instead of plans, with no rebuild needed. */
function statusPayload(user: UserRecord, billingAvailable: boolean) {
  return {
    plan: user.subscriptionPlan ?? null,
    status: user.subscriptionStatus ?? null,
    tier: user.tier,
    billingAvailable,
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

  return withCookie(
    json(
      statusPayload(
        user,
        deps.stripeFor(req) !== null && !billingDisabled(req, deps.billingDisabledEnvs)
      )
    ),
    refreshCookie
  );
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
 * Trial-ending reminder (E4.4). Stripe fires `trial_will_end` ~3 days before a
 * trial converts; this is the email that stops the first charge being a
 * surprise (plan §2.2 guard rail), so it names the card, the date and the
 * amount, and points at /account to cancel.
 *
 * BEST EFFORT by design: the tier write has already succeeded, so a mail
 * provider outage must never turn into a failed webhook (which would make
 * Stripe retry the whole event and, worse, look like a billing failure). The
 * event-id ledger already makes a redelivered event a no-op, so this cannot
 * double-send on a retry.
 */
async function sendTrialEndingReminder(
  sub: StripeSubscription,
  user: UserRecord,
  origin: string,
  deps: SubscriptionsDeps
): Promise<void> {
  if (!deps.emailSender) {
    console.warn(`[subscriptions] trial ending for ${sub.id} but EMAIL_PROVIDER is not configured — reminder skipped`);
    return;
  }
  // A converted or cancelled subscription must not get "your trial ends" copy.
  if (sub.status !== 'trialing' || !sub.trial_end) return;

  const chargeDate = formatChargeDate(isoFromEpochSeconds(sub.trial_end));
  const cardLine = user.cardLast4
    ? `${user.cardBrand ? user.cardBrand[0].toUpperCase() + user.cardBrand.slice(1) : 'Card'} ending ${user.cardLast4}`
    : null;
  const { subject, html, text } = renderTrialEndingEmail({
    displayName: user.displayName,
    chargeDate,
    amountLabel: formatAmount(sub.price?.unitAmount, sub.price?.currency),
    cardLine,
    planLabel: sub.metadata.plan === 'annual' ? 'Annual' : 'Monthly',
    accountUrl: `${origin}/account`,
  });
  try {
    await deps.emailSender.send({ to: [user.email], subject, html, text });
    console.log(`[subscriptions] trial reminder sent for ${sub.id} (charge ${chargeDate})`);
  } catch (err) {
    console.error('[subscriptions] trial reminder failed to send:', err instanceof Error ? err.message : err);
  }
}

/**
 * Apply one event. Always RE-READS the subscription from Stripe instead of
 * trusting the event payload: Stripe does not guarantee delivery order
 * (plan §6.4 rule 3), so a stale snapshot must never overwrite newer state.
 */
async function applyEvent(
  event: StripeEvent,
  stripe: StripeClient,
  origin: string,
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
  if (event.type === 'customer.subscription.trial_will_end') {
    await sendTrialEndingReminder(sub, updated, origin, deps);
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
    const result = await applyEvent(event, stripe, originForRequest(req), deps);
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
  req: Request,
  deps: SubscriptionsDeps = getSubscriptionsDeps()
): Promise<Response> {
  // Q2: prove BOTH the table/IAM grants and that STRIPE_ENV is usable, without
  // any network call to Stripe (a Stripe blip must not fail a deploy).
  if (!deps.stripeConfig.ok) {
    console.error('[subscriptions] health: STRIPE_ENV unusable:', deps.stripeConfig.error);
    return json({ ok: false }, 500);
  }
  if (deps.configuredStripeMode !== 'dummy') {
    // A PROD request must resolve to the LIVE set, so the requirement comes from
    // the marker, not from STRIPE_MODE. The deploy smoke probes each distribution
    // at its own origin: DEV asserts the test set, PROD asserts the live set.
    //
    // This is the deploy-time twin of the runtime refusal in deps.ts — a missing
    // or PARTIAL live set makes resolveStripeMode fall back to `test`, and
    // stripeFor() then answers 503 to every real customer. Without this, that
    // outage is only discoverable by a customer clicking a plan; `_health`
    // (unauthenticated, one GetItem) turns it into a red deploy instead.
    const required = isProdRequest(req) ? 'live' : deps.configuredStripeMode === 'live' ? 'live' : 'test';
    const keySet = required === 'live' ? deps.stripeConfig.live : deps.stripeConfig.test;
    if (!keySet) {
      // A wiped or partial secret must go red at deploy time, not at the first
      // real checkout — the FEEDBACK_ENV incident class.
      console.error(`[subscriptions] health: STRIPE_ENV has no ${required} key set`);
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
