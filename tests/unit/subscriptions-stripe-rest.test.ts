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
  it('creates an EMBEDDED PAGE session that keeps Managed Payments on, using the Checkout Studio parameters', async () => {
    const { client, calls } = makeClient({ responses: [jsonResponse({ id: 'cs_1', client_secret: 'cs_1_secret', url: null })] });

    const session = await client.createCheckoutSession({
      userId: 'user-1',
      email: 'parent@example.com',
      plan: 'annual',
      successUrl: 'https://octavlearning.com/account?billing=updated',
      cancelUrl: 'https://octavlearning.com/pricing',
      trialDays: 14,
    });

    // An embedded session returns a client secret and NO url — Stripe.js mounts
    // the checkout from it (the hosted checkout URL is gone).
    expect(session).toEqual({ id: 'cs_1', clientSecret: 'cs_1_secret' });
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET}`);
    // 2026-03-25.dahlia is the release that renamed initEmbeddedCheckout to
    // createEmbeddedCheckoutPage (the client call this pairs with). No beta
    // flag: custom_checkout_payment_form_preview belongs to ui_mode=form, which
    // Managed Payments forbids.
    expect(headers['Stripe-Version']).toBe('2026-03-25.dahlia');

    const params = new URLSearchParams(String(calls[0].init.body));
    expect(params.get('mode')).toBe('subscription');
    // embedded_page, NOT form: the form SDK is incompatible with Managed
    // Payments, and Managed Payments is the arrangement this account wants
    // (verified live: form+MP -> 400, embedded_page+MP -> 200).
    expect(params.get('ui_mode')).toBe('embedded_page');
    // ui_mode=embedded_page REJECTS success_url/cancel_url (Stripe answers 400
    // naming them), so the post-payment destination rides on return_url.
    expect(params.get('return_url')).toBe('https://octavlearning.com/account?billing=updated');
    expect(params.get('success_url')).toBeNull();
    expect(params.get('cancel_url')).toBeNull();
    // Checkout Studio field intents — sent exactly as configured.
    expect(params.get('billing_address_collection')).toBe('auto');
    expect(params.get('phone_number_collection[enabled]')).toBe('false');
    expect(params.get('automatic_tax[enabled]')).toBe('true');
    expect(params.get('submit_type')).toBe('auto');
    expect(params.get('integration_identifier')).toBe('custom_embedded_web_0001');
    expect(params.get('payment_method_collection')).toBe('always');
    expect(params.get('customer_email')).toBe('parent@example.com');
    expect(params.get('line_items[0][price]')).toBe(PRICES.annual);
    expect(params.get('line_items[0][quantity]')).toBe('1');
    expect(params.get('subscription_data[metadata][userId]')).toBe('user-1');
    expect(params.get('subscription_data[metadata][plan]')).toBe('annual');
    expect(params.get('subscription_data[trial_period_days]')).toBe('14');
    // §2.2.1: a trial that ends with no usable card must cancel, not convert.
    expect(params.get('subscription_data[trial_settings][end_behavior][missing_payment_method]')).toBe('cancel');
    // Managed Payments ON, sent explicitly: Stripe stays the MERCHANT OF RECORD
    // and owns indirect-tax registration/filing (the session comes back with
    // automatic_tax.liability.type="stripe"). Explicit so a future account
    // default change cannot silently move who is liable for the tax — and so the
    // product's tax_code stays mandatory and correct.
    expect(params.get('managed_payments[enabled]')).toBe('true');
  });

  it('fails loudly when a session comes back without a client secret', async () => {
    const { client } = makeClient({ responses: [jsonResponse({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })] });
    await expect(
      client.createCheckoutSession({
        userId: 'u',
        email: 'a@b.c',
        plan: 'monthly',
        successUrl: 'https://x/y',
        cancelUrl: 'https://x/z',
        trialDays: 14,
      })
    ).rejects.toThrow(/no client_secret/);
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
  it('expands the payment method and maps the card for the billing line', async () => {
    // Found by the E4.3 UX review: card fields were declared and rendered but
    // never fetched or stored, so /account's "Visa ending 4242" line could not
    // ever render in production. Verified against the live test account that
    // Managed Payments subscriptions DO carry a default_payment_method.
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'trialing',
        cancel_at_period_end: false,
        metadata: { userId: 'user-1', plan: 'monthly' },
        items: { data: [{ current_period_end: 1800000000 }] },
        default_payment_method: { id: 'pm_1', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 } },
      });
    });
    const client = new StripeRestClient({
      secretKey: SECRET,
      webhookSecret: WEBHOOK_SECRET,
      priceIds: PRICES,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const sub = await client.retrieveSubscription('sub_1');

    expect(calls[0].url).toContain('expand[]=default_payment_method');
    expect(sub?.card).toEqual({ brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 });
  });

  it('treats an UNEXPANDED payment-method id as no card known', async () => {
    // Without the expand, Stripe returns the bare string `pm_…` — mistaking that
    // for an object would crash the mapper.
    const { client } = makeClient({
      responses: [
        jsonResponse({
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          cancel_at_period_end: false,
          metadata: { userId: 'user-1', plan: 'monthly' },
          default_payment_method: 'pm_1',
        }),
      ],
    });
    await expect(client.retrieveSubscription('sub_1')).resolves.toMatchObject({ card: null });
  });

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
