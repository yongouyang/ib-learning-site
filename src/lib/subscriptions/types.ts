import type { SessionAuthStorage } from '../auth/session';
import type { SubscriptionFields, SubscriptionPlan, SubscriptionStatus, UserRecord } from '../auth/types';

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
  /** Write the cached billing state onto the user row (plan §6.3). */
  updateUser(userId: string, updates: SubscriptionFields): Promise<UserRecord | null>;
}

/** Re-exported so handlers read the tier rule from one place (plan §6.4.1). */
export { tierFromSubscription } from '../auth/types';
