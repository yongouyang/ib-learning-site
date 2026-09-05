import { describe, it, expect } from 'vitest';
import { DummyStripeClient, InMemorySubscriptionsStorage } from '@/lib/subscriptions/dummy';
import { tierFromSubscription } from '@/lib/auth/types';
import type { CreateCheckoutParams } from '@/lib/subscriptions/types';

const DAY = 24 * 60 * 60;
const T0 = 1_700_000_000; // fixed epoch seconds

const checkout = (over: Partial<CreateCheckoutParams> = {}): CreateCheckoutParams => ({
  userId: 'user-1',
  email: 'yong.ouyang@gmail.com',
  plan: 'monthly',
  successUrl: 'https://octavlearning.com/account?ok=1',
  cancelUrl: 'https://octavlearning.com/pricing',
  trialDays: 14,
  ...over,
});

/** Fixed-clock client plus a helper to complete checkout for a user. */
function setup(over: { failNextPayment?: boolean } = {}) {
  let now = T0;
  const stripe = new DummyStripeClient({ clock: () => now, ...over });
  const advance = (seconds: number) => {
    now += seconds;
    return stripe.advanceTo(now);
  };
  return { stripe, advance, now: () => now };
}

async function startTrial(stripe: DummyStripeClient, params = checkout()) {
  const session = await stripe.createCheckoutSession(params);
  const sub = await stripe.completeCheckoutSession(session.id);
  if (!sub) throw new Error('checkout did not create a subscription');
  stripe.takeEvents(); // ignore the creation events
  return sub;
}

describe('DummyStripeClient — checkout + trial', () => {
  it('creates a checkout session with a hosted URL', async () => {
    const { stripe } = setup();
    const session = await stripe.createCheckoutSession(checkout());
    expect(session.id).toMatch(/^cs_dummy_/);
    expect(session.url).toContain('checkout.stripe.com');
  });

  it('completing checkout starts a TRIALING subscription with no charge', async () => {
    const { stripe } = setup();
    const session = await stripe.createCheckoutSession(checkout({ trialDays: 14 }));
    const sub = await stripe.completeCheckoutSession(session.id);

    expect(sub?.status).toBe('trialing');
    expect(sub?.trial_end).toBe(T0 + 14 * DAY);
    expect(sub?.cancel_at_period_end).toBe(false);
    expect(sub?.metadata).toEqual({ userId: 'user-1', plan: 'monthly' });

    const types = stripe.takeEvents().map((e) => e.type);
    expect(types).toContain('checkout.session.completed');
    expect(types).toContain('customer.subscription.created');
    // The whole point of a trial: nothing is invoiced at signup.
    expect(types).not.toContain('invoice.payment_succeeded');
  });

  it('a trialing subscription grants premium (plan §6.4.1)', async () => {
    const { stripe } = setup();
    const sub = await startTrial(stripe);
    expect(tierFromSubscription(sub.status)).toBe('premium');
  });

  it('rejects an unknown or already-completed session', async () => {
    const { stripe } = setup();
    expect(await stripe.completeCheckoutSession('cs_nope')).toBeNull();
    const session = await stripe.createCheckoutSession(checkout());
    await stripe.completeCheckoutSession(session.id);
    expect(await stripe.completeCheckoutSession(session.id)).toBeNull();
  });
});

describe('DummyStripeClient — trial conversion and the no-charge guarantee', () => {
  it('a LIVE trial converts to active and emits the FIRST invoice', async () => {
    const { stripe, advance } = setup();
    const sub = await startTrial(stripe);

    const events = advance(14 * DAY);

    expect(stripe.retrieveSubscription(sub.id).then((s) => s?.status)).resolves.toBe('active');
    const types = events.map((e) => e.type);
    expect(types).toContain('invoice.payment_succeeded');
    expect(types).toContain('customer.subscription.updated');
    // No charge happened before conversion.
    expect(types).not.toContain('customer.subscription.deleted');
  });

  it('cancelling mid-trial keeps access but NEVER charges (plan §2.2.1)', async () => {
    const { stripe, advance } = setup();
    const sub = await startTrial(stripe);

    // Day 3: cancel.
    advance(3 * DAY);
    await stripe.updateSubscription(sub.id, { cancelAtPeriodEnd: true });
    stripe.takeEvents();

    // Still trialing — the user keeps the access they were promised.
    const midway = await stripe.retrieveSubscription(sub.id);
    expect(midway?.status).toBe('trialing');
    expect(midway?.cancel_at_period_end).toBe(true);
    expect(tierFromSubscription(midway?.status)).toBe('premium');

    // Day 14: the trial boundary.
    const events = advance(11 * DAY);

    const ended = await stripe.retrieveSubscription(sub.id);
    expect(ended?.status).toBe('canceled');
    expect(tierFromSubscription(ended?.status)).toBe('free');

    const types = events.map((e) => e.type);
    // THE guarantee: no invoice is ever generated, so nothing needs refunding.
    expect(types).not.toContain('invoice.payment_succeeded');
    expect(types).toContain('customer.subscription.deleted');
  });

  it('emits trial_will_end 3 days before the boundary', async () => {
    const { stripe, advance } = setup();
    await startTrial(stripe);

    // The window opens at trial_end − 3d, i.e. day 11 of a 14-day trial.
    const before = advance(10 * DAY);
    expect(before.map((e) => e.type)).not.toContain('customer.subscription.trial_will_end');

    const early = advance(2 * DAY); // day 12 — inside the window
    expect(early.map((e) => e.type)).toContain('customer.subscription.trial_will_end');

    // It fires once, not on every advance.
    const again = advance(1 * DAY);
    expect(again.map((e) => e.type)).not.toContain('customer.subscription.trial_will_end');
  });

  it('a failed payment moves to past_due and KEEPS premium (grace)', async () => {
    const { stripe, advance } = setup({ failNextPayment: true });
    await startTrial(stripe);

    const events = advance(14 * DAY);

    const types = events.map((e) => e.type);
    expect(types).toContain('invoice.payment_failed');
    expect(types).not.toContain('invoice.payment_succeeded');
    const sub = await stripe.findByUserId('user-1');
    expect(sub?.status).toBe('past_due');
    expect(tierFromSubscription(sub?.status)).toBe('premium');
  });
});

describe('DummyStripeClient — webhook signature (Stripe scheme)', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', created: T0, data: { object: {} } });

  it('accepts a correctly signed payload', () => {
    const { stripe } = setup();
    const event = stripe.constructEvent(payload, stripe.signPayload(payload));
    expect(event.id).toBe('evt_1');
  });

  it('rejects a tampered payload', () => {
    const { stripe } = setup();
    const sig = stripe.signPayload(payload);
    expect(() => stripe.constructEvent(payload + 'x', sig)).toThrow(/signature verification failed/);
  });

  it('rejects a missing or malformed header', () => {
    const { stripe } = setup();
    expect(() => stripe.constructEvent(payload, '')).toThrow(/missing Stripe-Signature/);
    expect(() => stripe.constructEvent(payload, 'garbage')).toThrow(/malformed/);
  });

  it('rejects a signature made with a different secret', () => {
    const { stripe } = setup();
    const other = new DummyStripeClient({ clock: () => T0, webhookSecret: 'whsec_other' });
    expect(() => stripe.constructEvent(payload, other.signPayload(payload))).toThrow(/signature verification failed/);
  });
});

describe('InMemorySubscriptionsStorage — shared universe + idempotency', () => {
  it('records a Stripe event id exactly once (retries are no-ops)', async () => {
    const storage = new InMemorySubscriptionsStorage();
    await expect(storage.markEventProcessed('evt_1')).resolves.toBe(true);
    await expect(storage.markEventProcessed('evt_1')).resolves.toBe(false);
    await expect(storage.markEventProcessed('evt_2')).resolves.toBe(true);
  });

  it('persists billing fields on the user row without blanking omitted ones', async () => {
    const storage = new InMemorySubscriptionsStorage();
    await storage.createUser({
      userId: 'user-1',
      email: 'a@b.com',
      displayName: 'A',
      role: 'parent',
      tier: 'free',
      childProfiles: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    });

    await storage.updateUser('user-1', { stripeCustomerId: 'cus_1', subscriptionStatus: 'trialing' });
    await storage.updateUser('user-1', { stripeSubscriptionId: 'sub_1' });

    const user = await storage.getUserById('user-1');
    expect(user?.stripeCustomerId).toBe('cus_1');
    expect(user?.stripeSubscriptionId).toBe('sub_1');
    // Not blanked by the second update.
    expect(user?.subscriptionStatus).toBe('trialing');
  });
});
