import { describe, it, expect } from 'vitest';
import { billingFieldsFromSubscription, type StripeSubscription } from '@/lib/subscriptions/types';

// The Stripe-subscription → user-row mapping (plan §6.3). These assertions exist
// because the E4.3 UX review found the CARD fields were declared, rendered and
// stored… but never populated: `cardBrand/cardLast4/cardExpMonth/cardExpYear`
// had no writer anywhere in the repo, so /account's "Visa ending 4242" line
// could not render in production. The card now comes from the subscription's
// expanded default_payment_method.

function sub(over: Partial<StripeSubscription> = {}): StripeSubscription {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'trialing',
    current_period_end: 1_800_000_000,
    trial_end: 1_790_000_000,
    cancel_at_period_end: false,
    metadata: { userId: 'u1', plan: 'monthly' },
    card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
    price: { unitAmount: 2000, currency: 'usd', interval: 'month' },
    ...over,
  };
}

describe('billingFieldsFromSubscription', () => {
  it('writes the card summary alongside the status and derived tier', () => {
    const fields = billingFieldsFromSubscription(sub());
    expect(fields).toMatchObject({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'monthly',
      cardBrand: 'visa',
      cardLast4: '4242',
      cardExpMonth: 12,
      cardExpYear: 2034,
      tier: 'premium',
    });
    expect(fields.trialEndsAt).toBe(new Date(1_790_000_000 * 1000).toISOString());
  });

  it('omits the card fields entirely when Stripe has none', () => {
    // Omission (not empty strings) is what protects the stored value: the
    // per-field merge skips undefined, so a webhook object without card data can
    // never blank a card we already know about.
    const fields = billingFieldsFromSubscription(sub({ card: null }));
    expect('cardLast4' in fields).toBe(false);
    expect('cardBrand' in fields).toBe(false);
    expect('cardExpMonth' in fields).toBe(false);
    expect('cardExpYear' in fields).toBe(false);
  });

  it('keeps a partial card (last4 only) usable', () => {
    const fields = billingFieldsFromSubscription(sub({ card: { brand: null, last4: '4242', expMonth: null, expYear: null } }));
    expect(fields.cardLast4).toBe('4242');
    expect('cardBrand' in fields).toBe(false);
  });

  it('drops the trial date once the trial has converted', () => {
    // A converted subscription must not keep a now-past trialEndsAt (it is what
    // isBillingStateStale is written to tolerate).
    const fields = billingFieldsFromSubscription(sub({ status: 'active', trial_end: null }));
    expect('trialEndsAt' in fields).toBe(false);
    expect(fields.tier).toBe('premium');
  });

  it('maps status to tier for the states the UI distinguishes', () => {
    expect(billingFieldsFromSubscription(sub({ status: 'past_due' })).tier).toBe('premium');
    expect(billingFieldsFromSubscription(sub({ status: 'canceled' })).tier).toBe('free');
    // `incomplete` = the first payment never completed, so no entitlement —
    // which is why the UI must not describe it as a retry (see BillingPanel).
    expect(billingFieldsFromSubscription(sub({ status: 'incomplete' })).tier).toBe('free');
  });
});
