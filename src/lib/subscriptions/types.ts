import { z } from 'zod';
import { isDevRequest, isProdRequest } from '../auth/dev-gate';
import { SITE } from '../seo/site';
import type { SessionAuthStorage } from '../auth/session';
import type { SubscriptionFields, SubscriptionPlan, SubscriptionStatus, UserRecord } from '../auth/types';
import type { Tier } from '../entitlements/features';
import { tierFromSubscription } from '../auth/types';

// E4 — Stripe subscriptions (docs/stripe-subscriptions-plan.md §6).
//
// This module owns TWO seams, both standing directives from AGENTS.md
// ("every external dependency gets a controllable dummy"):
//   1. `StripeClient`  — the external API. Real client in prod, DummyStripeClient
//                        in dev/e2e with faithful subscription lifecycle semantics.
//   2. `SubscriptionsStorage` — session validation + the user row + the webhook
//                        idempotency ledger, backed by DynamoDB or the shared
//                        in-memory universe.

/** Price ids per plan. Test mode and live mode have DIFFERENT ids, so these
 *  are always env-supplied and never hardcoded (plan §6.1). */
export type PlanPriceIds = Record<SubscriptionPlan, string>;

export interface CheckoutSession {
  id: string;
  url: string;
}

/** The trimmed Stripe subscription shape we actually act on. Timestamps are
 *  epoch SECONDS — Stripe's native unit (not ms). */
export interface StripeSubscription {
  id: string;
  customer: string;
  status: SubscriptionStatus;
  current_period_end: number;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  metadata: { userId: string; plan: SubscriptionPlan };
}

export type StripeEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

export interface StripeEvent {
  id: string;
  type: StripeEventType;
  created: number; // epoch seconds
  data: { object: Record<string, unknown> };
}

export interface CreateCheckoutParams {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  successUrl: string;
  cancelUrl: string;
  trialDays: number;
}

/**
 * The Stripe seam. `constructEvent` is on the interface because signature
 * verification is the security boundary of the webhook — it must be impossible
 * to handle an event without verifying it, and the dummy has to be able to
 * exercise both the accept and the reject path.
 */
export interface StripeClient {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
  createPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  retrieveSubscription(subscriptionId: string): Promise<StripeSubscription | null>;
  updateSubscription(
    subscriptionId: string,
    params: { cancelAtPeriodEnd?: boolean }
  ): Promise<StripeSubscription | null>;
  /** Verify + parse a webhook body. MUST throw on a missing/invalid signature. */
  constructEvent(payload: string, signature: string): StripeEvent;
}

export interface SubscriptionsStorage extends SessionAuthStorage {
  /**
   * Webhook idempotency ledger (plan §6.4 rule 2). Stripe retries deliveries,
   * so a replayed event must not double-apply: returns true only the FIRST time
   * a given event id is seen.
   */
  markEventProcessed(eventId: string): Promise<boolean>;
  /**
   * Write the cached billing state — and the derived `tier` — onto the user row
   * (plan §6.3). Tier rides along because it IS the entitlement source of
   * truth: writing the status without it would leave `me()` entitlements stale.
   */
  updateUser(userId: string, updates: SubscriptionFields & { tier?: Tier }): Promise<UserRecord | null>;
  /**
   * Per-user fixed-window budget guarding Stripe session creation (the
   * contact/analytics limiter pattern, bucket `subscriptions:<userId>:<epoch>`
   * in octav-rate-limits). Returns false once the budget is spent.
   */
  incrementSessionBudget(userId: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Fixed-key read for the unauthenticated CI smoke probe (contact precedent). */
  probeTable(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Budgets and body limits
// ---------------------------------------------------------------------------

/** Checkout/Portal sessions per user per window. Each call hits Stripe, so it
 *  is bounded even though the session gate already applies. */
export const SUBSCRIPTION_SESSIONS_PER_WINDOW = 20;
export const SUBSCRIPTION_WINDOW_SECONDS = 3600; // 1 hour
/** Stripe webhook payloads are a few KB; 64KB is generous and bounds abuse. */
export const WEBHOOK_MAX_BODY_BYTES = 65_536;
export const CHECKOUT_MAX_BODY_BYTES = 4096;

export function subscriptionWindowEpoch(nowMs: number, windowSeconds: number = SUBSCRIPTION_WINDOW_SECONDS): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

/** Bucket key `subscriptions:<userId>:<epoch>` (octav-rate-limits PK). */
export function subscriptionRateLimitBucket(
  userId: string,
  nowMs: number,
  windowSeconds: number = SUBSCRIPTION_WINDOW_SECONDS
): string {
  return `subscriptions:${userId}:${subscriptionWindowEpoch(nowMs, windowSeconds)}`;
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export const planSchema = z.enum(['monthly', 'annual']);
export const checkoutRequestSchema = z.object({ plan: planSchema });

// NOTE: there is deliberately NO portal request schema. `returnUrl` is not
// accepted from the client — Stripe would happily redirect the user anywhere we
// name, so a client-supplied URL is an open-redirect vector. The Portal always
// returns to our own /account page.

// ---------------------------------------------------------------------------
// STRIPE_ENV (plan §6.7): one secret, BOTH key sets, selected per request
// ---------------------------------------------------------------------------

export interface StripeKeySet {
  secretKey: string;
  webhookSecret: string;
  priceIds: PlanPriceIds;
}

export interface StripeConfig {
  /** False only when STRIPE_ENV is present but unusable. */
  ok: boolean;
  error?: string;
  /** Absent = unconfigured (the FEEDBACK_ENV precedent: no keys, no billing). */
  test?: StripeKeySet;
  live?: StripeKeySet;
}

function keySet(
  get: (k: string) => string | undefined,
  secret: string,
  webhook: string,
  monthly: string,
  annual: string
): StripeKeySet | undefined {
  const secretKey = get(secret);
  const webhookSecret = get(webhook);
  const m = get(monthly);
  const a = get(annual);
  // All four or nothing — a partial set is IGNORED rather than half-applied, so
  // a typo can never produce a live key paired with a test price id.
  if (!secretKey || !webhookSecret || !m || !a) return undefined;
  return { secretKey, webhookSecret, priceIds: { monthly: m, annual: a } };
}

export function parseStripeEnv(raw: string | undefined): StripeConfig {
  if (!raw || !raw.trim()) {
    // Unconfigured mode: billing endpoints report unavailable instead of
    // failing obscurely. Mirrors FEEDBACK_ENV being unset.
    return { ok: true };
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'STRIPE_ENV is not valid JSON (must be single-line with straight quotes)' };
  }
  const get = (k: string): string | undefined => {
    const v = parsed[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  const test = keySet(get, 'SECRET_KEY_TEST', 'WEBHOOK_SECRET_TEST', 'PRICE_MONTHLY_TEST', 'PRICE_ANNUAL_TEST');
  const live = keySet(get, 'SECRET_KEY_LIVE', 'WEBHOOK_SECRET_LIVE', 'PRICE_MONTHLY_LIVE', 'PRICE_ANNUAL_LIVE');

  if (!test && !live) {
    return { ok: false, error: 'STRIPE_ENV holds no complete key set (a partial set is ignored, all four fields are required)' };
  }
  return { ok: true, ...(test ? { test } : {}), ...(live ? { live } : {}) };
}

export type ResolvedStripeMode = 'dummy' | 'test' | 'live';

const DEV_ORIGIN = 'https://dev.octavlearning.com';
const LOCAL_ORIGIN = 'http://localhost:3000';

/**
 * Absolute origin the request arrived through — used for Stripe's
 * success/cancel/Portal return URLs, which must send the user back to the
 * environment they are actually on.
 *
 * An env var cannot express this: ONE Lambda serves both distributions, so the
 * same var would point dev users at prod. The CloudFront-overwritten marker is
 * the only per-request signal that works — and CloudFront does not forward the
 * viewer Host on the /api/* behaviours, which is why the marker comes first.
 *
 * The Host fallback is restricted to a LOCAL host on purpose: an
 * attacker-controlled Host must never become a Stripe return URL, or checkout
 * turns into an open redirect.
 */
export function originForRequest(req: Request): string {
  if (isProdRequest(req)) return SITE.origin;
  if (isDevRequest(req)) return DEV_ORIGIN;
  const host = req.headers.get('host') ?? '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : LOCAL_ORIGIN;
}

/**
 * Per-request key selection (plan §6.1). ONE Lambda serves both distributions,
 * so the environment cannot come from an env var — it comes from the
 * CloudFront-overwritten `X-Octav-Env` marker.
 *
 * FAIL-SAFE: live keys resolve ONLY when the marker is exactly `prod` AND a
 * complete live key set exists. A missing header (local dev, Next routes, e2e,
 * a stripped proxy) or `dev` always lands on test — and on the dummy when no
 * keys are configured at all. There is no input that makes a dev request
 * resolve the live key.
 */
export function resolveStripeMode(
  req: Request,
  configured: ResolvedStripeMode,
  config: StripeConfig
): ResolvedStripeMode {
  if (configured === 'dummy') return 'dummy';
  if (isProdRequest(req) && config.live) return 'live';
  if (config.test) return 'test';
  return 'dummy';
}

// ---------------------------------------------------------------------------
// Billing state mapping + staleness
// ---------------------------------------------------------------------------

export function isoFromEpochSeconds(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

/**
 * True when an existing subscription should BLOCK a new checkout. Anything not
 * terminally ended counts — including `incomplete` (an abandoned payment) and
 * `past_due` (a card Stripe is still retrying) — because a second subscription
 * would charge the same card again. `canceled` and absent allow checkout.
 */
export function hasLiveSubscription(status: SubscriptionStatus | undefined): boolean {
  return status === 'trialing' || status === 'active' || status === 'past_due' || status === 'incomplete';
}

/** Stripe subscription -> the cached fields written to the user row (§6.3). */
export function billingFieldsFromSubscription(sub: StripeSubscription): SubscriptionFields & { tier: Tier } {
  return {
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    subscriptionPlan: sub.metadata.plan,
    currentPeriodEnd: isoFromEpochSeconds(sub.current_period_end),
    // Omitted (not written as undefined) once the trial has converted — the
    // DynamoDB marshaller drops undefined, so a stale value would otherwise
    // survive. isBillingStateStale below is written to tolerate that residue.
    ...(sub.trial_end !== null ? { trialEndsAt: isoFromEpochSeconds(sub.trial_end) } : {}),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    tier: tierFromSubscription(sub.status),
  };
}

/**
 * True when the cached billing copy must be re-read from Stripe — the
 * self-healing reconciliation from plan §6.4.1 mitigation 1, which is what
 * stops a missed webhook leaving a cancelled user on premium forever.
 *
 * Deliberately NOT triggered by a stale `trialEndsAt` on a subscription that
 * has already left the trial: DynamoDB cannot store undefined, so a converted
 * subscription keeps its now-past `trialEndsAt`, and treating that as stale
 * would re-read from Stripe on every single request forever.
 *
 * KNOWN LIMITATION (not covered here, tracked for E4.5 alerting): a missed
 * `customer.subscription.created`/`invoice.payment_succeeded` leaves a PAYING
 * user on free until their period end passes, because nothing about their
 * cached row looks stale. The premium-leak direction this defends is the one
 * the plan calls out; the paying-user direction needs the reconciliation alert.
 */
export function isBillingStateStale(user: UserRecord, nowMs: number): boolean {
  const status = user.subscriptionStatus;
  // No subscription ever recorded, or already terminated: nothing live to
  // re-check, and free users must not cost a Stripe call per page view.
  if (!status || status === 'canceled') return false;

  if (status === 'trialing') {
    // The trial boundary is the thing that changes state; a past trial end with
    // the row still saying "trialing" means the conversion event was missed.
    if (user.trialEndsAt && Date.parse(user.trialEndsAt) <= nowMs) return true;
  }
  return Boolean(user.currentPeriodEnd && Date.parse(user.currentPeriodEnd) <= nowMs);
}

/** Re-exported so handlers read the tier rule from one place (plan §6.4.1). */
export { tierFromSubscription } from '../auth/types';
