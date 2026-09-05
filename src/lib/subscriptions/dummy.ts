import { createHmac, timingSafeEqual } from 'node:crypto';
import { InMemoryContactStorage } from '../contact/dummy';
import type { SubscriptionFields, UserRecord } from '../auth/types';
import type {
  CheckoutSession,
  CreateCheckoutParams,
  StripeClient,
  StripeEvent,
  StripeEventType,
  StripeSubscription,
  SubscriptionsStorage,
} from './types';

// Dummy Stripe client (docs/stripe-subscriptions-plan.md §6.6). Deterministic,
// zero-network, controllable — and deliberately FAITHFUL on the behaviours we
// depend on, so a test written against the dummy also proves the real flow:
//
//   * signature verification uses Stripe's real scheme
//     (`t=<ts>,v1=<hmac>` over "<ts>.<body>"), so the webhook's reject path
//     is genuinely exercisable, not stubbed open;
//   * a trial creates NO invoice — the first chargeable invoice appears only
//     when the trial converts (plan §2.2.1);
//   * cancelling sets `cancel_at_period_end` and leaves `status` untouched, so
//     the user keeps access to the trial boundary and NO invoice is ever
//     generated (the no-charge guarantee);
//   * `customer.subscription.deleted` is what ends a cancelled trial.
//
// Local dev and e2e drive the parts Stripe's hosted UI would normally do
// (`completeCheckoutSession`, `advanceTo`) rather than waiting on real time.

const MONTH_SECONDS = 30 * 24 * 60 * 60;
const YEAR_SECONDS = 365 * 24 * 60 * 60;
const TRIAL_REMINDER_LEAD_SECONDS = 3 * 24 * 60 * 60; // Stripe fires trial_will_end 3 days out

const periodSeconds = (plan: 'monthly' | 'annual') => (plan === 'annual' ? YEAR_SECONDS : MONTH_SECONDS);

export interface DummyStripeOptions {
  /** Injectable clock (epoch SECONDS) — tests drive trial expiry with this. */
  clock?: () => number;
  /** Webhook signing secret; defaults to a fixed dummy value. */
  webhookSecret?: string;
  /** Force the next conversion attempt to fail (exercises past_due). */
  failNextPayment?: boolean;
}

export class DummyStripeClient implements StripeClient {
  private readonly subscriptions = new Map<string, StripeSubscription>();
  private readonly pendingCheckout = new Map<string, CreateCheckoutParams & { id: string }>();
  private readonly events: StripeEvent[] = [];
  private counter = 0;
  private readonly clock: () => number;
  private readonly webhookSecret: string;
  /** Whether trial_will_end has already been emitted for a subscription. */
  private readonly reminded = new Set<string>();
  failNextPayment: boolean;

  constructor(opts: DummyStripeOptions = {}) {
    this.clock = opts.clock ?? (() => Math.floor(Date.now() / 1000));
    this.webhookSecret = opts.webhookSecret ?? 'whsec_dummy_local';
    this.failNextPayment = opts.failNextPayment ?? false;
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_dummy_${this.counter}`;
  }

  // --- Checkout --------------------------------------------------------------

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const id = this.nextId('cs');
    this.pendingCheckout.set(id, { ...params, id });
    return { id, url: `https://checkout.stripe.com/dummy/${id}` };
  }

  /**
   * Dummy-only: what Stripe's hosted page does when the user submits. Creates
   * the subscription in `trialing` and emits the same events Stripe would.
   * Returns null for an unknown/duplicate session.
   */
  async completeCheckoutSession(sessionId: string): Promise<StripeSubscription | null> {
    const pending = this.pendingCheckout.get(sessionId);
    if (!pending) return null;
    this.pendingCheckout.delete(sessionId);

    const now = this.clock();
    const trialEnd = now + pending.trialDays * 24 * 60 * 60;
    const sub: StripeSubscription = {
      id: this.nextId('sub'),
      customer: this.nextId('cus'),
      status: 'trialing',
      // During a trial the period end IS the trial end (plan §2.2.1).
      current_period_end: trialEnd,
      trial_end: trialEnd,
      cancel_at_period_end: false,
      metadata: { userId: pending.userId, plan: pending.plan },
    };
    this.subscriptions.set(sub.id, sub);

    this.emit('checkout.session.completed', { id: sessionId, subscription: sub.id, customer: sub.customer });
    this.emit('customer.subscription.created', sub as unknown as Record<string, unknown>);
    return sub;
  }

  // --- Portal / read / update ------------------------------------------------

  async createPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    return { url: `https://billing.stripe.com/dummy/${params.customerId}?return_url=${encodeURIComponent(params.returnUrl)}` };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
    const sub = this.subscriptions.get(subscriptionId);
    return sub ? { ...sub } : null;
  }

  async updateSubscription(
    subscriptionId: string,
    params: { cancelAtPeriodEnd?: boolean }
  ): Promise<StripeSubscription | null> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return null;
    if (params.cancelAtPeriodEnd !== undefined) sub.cancel_at_period_end = params.cancelAtPeriodEnd;
    // status is deliberately unchanged — cancelling does not end a trial early
    this.emit('customer.subscription.updated', sub as unknown as Record<string, unknown>);
    return { ...sub };
  }

  // --- Time travel (dummy-only) ----------------------------------------------

  /**
   * Advance the world to `epochSeconds`, converting every subscription whose
   * period has elapsed. This is where the plan's no-charge guarantee is
   * observable: a subscription cancelled during its trial is DELETED with no
   * invoice event at all, whereas a live one emits invoice.payment_succeeded.
   */
  advanceTo(epochSeconds: number): StripeEvent[] {
    for (const sub of this.subscriptions.values()) {
      const boundary = sub.trial_end ?? sub.current_period_end;
      if (epochSeconds < boundary) {
        if (sub.trial_end !== null && !this.reminded.has(sub.id) && epochSeconds >= sub.trial_end - TRIAL_REMINDER_LEAD_SECONDS) {
          this.reminded.add(sub.id);
          this.emit('customer.subscription.trial_will_end', sub as unknown as Record<string, unknown>);
        }
        continue;
      }

      if (sub.cancel_at_period_end) {
        sub.status = 'canceled';
        this.emit('customer.subscription.deleted', sub as unknown as Record<string, unknown>);
        continue;
      }

      if (this.failNextPayment) {
        sub.status = 'past_due';
        this.emit('invoice.payment_failed', { subscription: sub.id, customer: sub.customer });
        continue;
      }

      const wasTrialing = sub.status === 'trialing';
      sub.status = 'active';
      sub.trial_end = null;
      sub.current_period_end = boundary + periodSeconds(sub.metadata.plan);
      if (wasTrialing) {
        // The FIRST chargeable invoice of the whole relationship is here, at
        // conversion — nothing was invoiced during the trial.
        this.emit('invoice.payment_succeeded', { subscription: sub.id, customer: sub.customer });
      }
      this.emit('customer.subscription.updated', sub as unknown as Record<string, unknown>);
    }
    return this.takeEvents();
  }

  // --- Webhook signing -------------------------------------------------------

  /** Stripe's real scheme: HMAC-SHA256 of "<timestamp>.<payload>". */
  signPayload(payload: string, timestamp: number = this.clock()): string {
    const sig = createHmac('sha256', this.webhookSecret).update(`${timestamp}.${payload}`).digest('hex');
    return `t=${timestamp},v1=${sig}`;
  }

  constructEvent(payload: string, signature: string): StripeEvent {
    if (!signature) throw new Error('[dummy-stripe] missing Stripe-Signature header');
    const parts = Object.fromEntries(
      signature.split(',').map((kv) => {
        const idx = kv.indexOf('=');
        return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
      })
    );
    const timestamp = parts.t;
    const provided = parts.v1;
    if (!timestamp || !provided) throw new Error('[dummy-stripe] malformed Stripe-Signature header');

    const expected = createHmac('sha256', this.webhookSecret).update(`${timestamp}.${payload}`).digest();
    let providedBuf: Buffer;
    try {
      providedBuf = Buffer.from(provided, 'hex');
    } catch {
      throw new Error('[dummy-stripe] signature is not valid hex');
    }
    if (providedBuf.length !== expected.length || !timingSafeEqual(providedBuf, expected)) {
      throw new Error('[dummy-stripe] signature verification failed');
    }
    return JSON.parse(payload) as StripeEvent;
  }

  // --- Test helpers ----------------------------------------------------------

  /** Drain emitted events (tests assert on the resulting array). */
  takeEvents(): StripeEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /** Look up a subscription by its metadata userId (tests + local dev). */
  findByUserId(userId: string): StripeSubscription | null {
    for (const sub of this.subscriptions.values()) if (sub.metadata.userId === userId) return { ...sub };
    return null;
  }

  private emit(type: StripeEventType, object: Record<string, unknown>): void {
    this.events.push({
      id: this.nextId('evt'),
      type,
      created: this.clock(),
      data: { object },
    });
  }
}

// In-memory subscriptions storage — extends the deepest dummy in the chain
// (contact → leaderboard → analytics → feedback → progress → auth) so it joins
// the ONE shared in-memory universe: a dummy-OTP login resolves end-to-end and
// billing state lands on the same user row every other handler sees.
//
// The event ledger mirrors the DynamoDB adapter's semantics exactly: an event
// id can only be marked processed ONCE, which is what makes Stripe's retries
// no-ops (plan §6.4 rule 2).
export class InMemorySubscriptionsStorage extends InMemoryContactStorage implements SubscriptionsStorage {
  private readonly processedEvents = new Set<string>();

  async markEventProcessed(eventId: string): Promise<boolean> {
    if (this.processedEvents.has(eventId)) return false;
    this.processedEvents.add(eventId);
    return true;
  }

  async updateUser(userId: string, updates: SubscriptionFields): Promise<UserRecord | null> {
    return super.updateUser(userId, updates);
  }
}
