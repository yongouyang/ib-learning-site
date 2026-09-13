import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { StripeRestClient, WEBHOOK_TOLERANCE_SECONDS } from '@/lib/subscriptions/stripe-rest';

// The real Stripe client (E4.2). fetch is mocked — these pin the REQUEST SHAPE
// and the webhook security boundary, which are the two things a sandbox run
// against live Stripe could otherwise hide:
//   * metadata must ride on `subscription_data` (the webhook attributes a
//     subscription to a user by reading sub.metadata.userId — session-level
//     metadata alone would silently orphan every paying user);
//   * an unsigned / forged / replayed webhook must never produce an event.

const SECRET = 'sk_test_example';
const WEBHOOK_SECRET = 'whsec_example';
const PRICES = { monthly: 'price_month', annual: 'price_year' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(opts: { responses?: Response[]; clock?: () => number } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const responses = opts.responses ?? [];
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch call');
    return next;
  });
  const client = new StripeRestClient({
    secretKey: SECRET,
    webhookSecret: WEBHOOK_SECRET,
    priceIds: PRICES,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...(opts.clock ? { clock: opts.clock } : {}),
  });
  return { client, calls, fetchImpl };
}

/** Reproduce Stripe's signature header for a payload. */
function sign(payload: string, opts: { timestamp?: number; secret?: string } = {}): string {
  const t = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', opts.secret ?? WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('StripeRestClient — checkout session', () => {
  it('puts metadata and the trial on subscription_data, and collects the card up front', async () => {
    const { client, calls } = makeClient({ responses: [jsonResponse({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })] });

    const session = await client.createCheckoutSession({
      userId: 'user-1',
      email: 'parent@example.com',
      plan: 'annual',
      successUrl: 'https://octavlearning.com/account?billing=updated',
      cancelUrl: 'https://octavlearning.com/pricing',
      trialDays: 14,
    });

    expect(session).toEqual({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);

    const body = String(calls[0].init.body);
    const params = new URLSearchParams(body);
    expect(params.get('mode')).toBe('subscription');
    expect(params.get('payment_method_collection')).toBe('always');
    expect(params.get('customer_email')).toBe('parent@example.com');
    expect(params.get('line_items[0][price]')).toBe(PRICES.annual);
    expect(params.get('line_items[0][quantity]')).toBe('1');
    expect(params.get('subscription_data[metadata][userId]')).toBe('user-1');
    expect(params.get('subscription_data[metadata][plan]')).toBe('annual');
    expect(params.get('subscription_data[trial_period_days]')).toBe('14');
    // §2.2.1: a trial that ends with no usable card must cancel, not convert.
    expect(params.get('subscription_data[trial_settings][end_behavior][missing_payment_method]')).toBe('cancel');
    expect(params.get('success_url')).toBe('https://octavlearning.com/account?billing=updated');
    // Managed Payments explicitly on: Stripe is the merchant of record and owns
    // indirect-tax compliance. Verified against the live test account that this
    // is ALSO the account default (a session without the flag returns
    // managed_payments.enabled=true) — sending it makes the tax stance
    // deliberate rather than inherited, and it is what requires the product's
    // tax_code above.
    expect(params.get('managed_payments[enabled]')).toBe('true');
    // No Stripe-Version pin: the account default accepts this parameter, and a
    // preview pin would freeze webhook payload shapes too (see the client).
    expect((calls[0].init.headers as Record<string, string>)['Stripe-Version']).toBeUndefined();
  });

  it('surfaces Stripe\'s own error message on a rejected call', async () => {
    const { client } = makeClient({
      responses: [jsonResponse({ error: { message: 'Invalid API Key provided' } }, 401)],
    });
    await expect(
      client.createCheckoutSession({
        userId: 'u',
        email: 'a@b.c',
        plan: 'monthly',
        successUrl: 'https://x/y',
        cancelUrl: 'https://x/z',
        trialDays: 14,
      })
    ).rejects.toThrow(/Invalid API Key provided/);
  });
});

describe('StripeRestClient — subscription reads', () => {
  it('reads current_period_end from the subscription items when the top level omits it', async () => {
    // Stripe's 2025 API versions moved current_period_end onto the items; a
    // version bump must not silently turn every renewal date into epoch 0.
    const { client } = makeClient({
      responses: [
        jsonResponse({
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          cancel_at_period_end: false,
          metadata: { userId: 'user-1', plan: 'monthly' },
          items: { data: [{ current_period_end: 1800000000 }] },
        }),
      ],
    });

    const sub = await client.retrieveSubscription('sub_1');
    expect(sub?.current_period_end).toBe(1800000000);
    expect(sub?.customer).toBe('cus_1');
    expect(sub?.metadata).toEqual({ userId: 'user-1', plan: 'monthly' });
  });

  it('treats an unknown subscription as null (end of life), not an error to retry', async () => {
    const { client } = makeClient({
      responses: [jsonResponse({ error: { message: 'No such subscription: sub_gone' } }, 404)],
    });
    await expect(client.retrieveSubscription('sub_gone')).resolves.toBeNull();
  });
});

describe('StripeRestClient — webhook signature (the security boundary)', () => {
  const event = { id: 'evt_1', type: 'customer.subscription.updated', created: 1, data: { object: { id: 'sub_1' } } };

  it('accepts a correctly signed payload', () => {
    const payload = JSON.stringify(event);
    const { client } = makeClient();
    const parsed = client.constructEvent(payload, sign(payload));
    expect(parsed.id).toBe('evt_1');
    expect(parsed.data.object).toEqual({ id: 'sub_1' });
  });

  it('rejects a forged signature, a wrong secret, and a missing header', () => {
    const payload = JSON.stringify(event);
    const { client } = makeClient();
    const ts = Math.floor(Date.now() / 1000);
    expect(() => client.constructEvent(payload, 't=1,v1=deadbeef')).toThrow(/verification failed|tolerance/);
    expect(() => client.constructEvent(payload, sign(payload, { secret: 'whsec_attacker' }))).toThrow(/verification failed/);
    expect(() => client.constructEvent(payload, '')).toThrow(/missing Stripe-Signature/);
    expect(() => client.constructEvent(payload, 'nonsense')).toThrow(/malformed/);
    expect(() => client.constructEvent(payload, `t=${ts}`)).toThrow(/malformed/);
  });

  it('rejects a replayed delivery once the timestamp leaves the tolerance window', () => {
    const payload = JSON.stringify(event);
    const now = 1_800_000_000_000;
    const { client } = makeClient({ clock: () => now });
    const fresh = sign(payload, { timestamp: now / 1000 - WEBHOOK_TOLERANCE_SECONDS + 1 });
    expect(() => client.constructEvent(payload, fresh)).not.toThrow();

    const stale = sign(payload, { timestamp: now / 1000 - WEBHOOK_TOLERANCE_SECONDS - 1 });
    expect(() => client.constructEvent(payload, stale)).toThrow(/outside tolerance/);
  });

  it('accepts any of several v1 signatures sent during a secret rotation', () => {
    const payload = JSON.stringify(event);
    const { client } = makeClient();
    const t = Math.floor(Date.now() / 1000);
    const good = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex');
    expect(client.constructEvent(payload, `t=${t},v1=${'0'.repeat(64)},v1=${good}`).id).toBe('evt_1');
  });

  it('refuses a verified body that is not a Stripe event', () => {
    const payload = JSON.stringify({ hello: 'world' });
    const { client } = makeClient();
    expect(() => client.constructEvent(payload, sign(payload))).toThrow(/not a Stripe event/);
  });
});
