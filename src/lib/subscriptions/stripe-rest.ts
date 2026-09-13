import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutSession,
  CreateCheckoutParams,
  PlanPriceIds,
  StripeClient,
  StripeEvent,
  StripeSubscription,
} from './types';

// E4.2 — the real Stripe client (docs/stripe-subscriptions-plan.md §6.1/§6.5).
//
// Deliberately dependency-free: Stripe's REST API is form-encoded POSTs over
// HTTPS and its webhook scheme is an HMAC-SHA256 over "<timestamp>.<payload>"
// — about 60 lines with fetch + node:crypto, so the Lambda bundle stays as
// small as the other eight functions' (the `stripe` npm package would add a
// second HTTP stack and ~200KB to a zip that currently has none).
//
// KEY SELECTION IS NOT DONE HERE. One Lambda serves dev AND prod, so which key
// set applies is decided per request in deps.ts (`resolveStripeMode`, keyed off
// the CloudFront-overwritten X-Octav-Env marker). This class only ever holds
// ONE key set — the one it was constructed with — which is what makes a live
// key unreachable from a dev request by construction.

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Pinned API version. Sent as the `Stripe-Version` header on every call — this
 * class is our "Stripe client", so the pin belongs here.
 *
 * WHICH VERSION, WHY THIS ONE (verified against the live test account 2026-09-13):
 *   * 2026-03-25.dahlia is the release that RENAMED `stripe.initEmbeddedCheckout()`
 *     to `stripe.createEmbeddedCheckoutPage()` — the client call this integration
 *     makes — and it is also the release where the ui_mode values moved from
 *     `embedded`/`hosted` to `embedded_page`/`hosted_page` (passing the old names
 *     now returns "no longer supported. Use …" — measured). Pinning means an API
 *     rename cannot silently break the browser side.
 *   * NO beta flag: `custom_checkout_payment_form_preview=v1` belongs to
 *     `ui_mode=form`, which this account CANNOT use (see managed_payments below).
 *   * Stripe REJECTS an unknown version string outright ("Invalid Stripe API
 *     version" — measured), so this is a checkable value, not decoration.
 */
export const STRIPE_API_VERSION = '2026-03-25.dahlia';

/**
 * Reject a webhook whose signed timestamp is older than this — Stripe's own
 * default tolerance. Without it a captured delivery could be replayed forever
 * (the event-id ledger in storage catches duplicates, but only after the
 * signature is trusted; this is the cheaper first line).
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Each Stripe call is bounded well under the Lambda timeout (module sets 15s). */
const REQUEST_TIMEOUT_MS = 8_000;

export interface StripeRestConfig {
  secretKey: string;
  webhookSecret: string;
  priceIds: PlanPriceIds;
  /** Injectable for tests; defaults to the platform fetch. */
  fetchImpl?: typeof fetch;
  clock?: () => number;
}

/** Stripe's REST errors carry a JSON body with a human-readable message. */
interface StripeErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

/** Form-encode a nested params object: {a: {b: 1}} -> a[b]=1 (URLSearchParams). */
function encodeParams(params: Record<string, unknown>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((entry, i) => {
        if (entry && typeof entry === 'object') {
          for (const [k, v] of encodeParams(entry as Record<string, unknown>, `${name}[${i}]`)) {
            out.append(k, v);
          }
        } else {
          out.append(`${name}[${i}]`, String(entry));
        }
      });
    } else if (typeof value === 'object') {
      for (const [k, v] of encodeParams(value as Record<string, unknown>, name)) out.append(k, v);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

/**
 * The trimmed subscription shape we act on. `current_period_end` moved off the
 * Subscription object in Stripe's 2025 API versions (it now lives on the
 * subscription items), so it is read from either place — the handler's billing
 * math must not silently become epoch 0 on a version bump.
 */
function normalizeSubscription(raw: Record<string, unknown>): StripeSubscription {
  const items = (raw.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  const periodEndFromItem = items
    .map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => b - a)[0];
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>;

  // The payment method only arrives when the caller expanded it (see
  // retrieveSubscription); an unexpanded id string is deliberately treated as
  // "no card known" rather than being mistaken for an object.
  const pm = raw.default_payment_method;
  const card = pm && typeof pm === 'object' ? ((pm as { card?: Record<string, unknown> }).card ?? null) : null;
  // Price of the first item — what the trial-ending reminder email states as the
  // amount about to be charged. Only present when the caller expanded it.
  const price = (() => {
    const item = items[0] as { price?: unknown } | undefined;
    const p = item?.price;
    if (!p || typeof p !== 'object') return null;
    const rec = p as { unit_amount?: unknown; currency?: unknown; recurring?: { interval?: unknown } };
    return {
      unitAmount: typeof rec.unit_amount === 'number' ? rec.unit_amount : null,
      currency: typeof rec.currency === 'string' ? rec.currency : null,
      interval: typeof rec.recurring?.interval === 'string' ? rec.recurring.interval : null,
    };
  })();

  return {
    id: String(raw.id ?? ''),
    customer: typeof raw.customer === 'string' ? raw.customer : String((raw.customer as { id?: string })?.id ?? ''),
    status: (raw.status ?? 'incomplete') as StripeSubscription['status'],
    current_period_end:
      typeof raw.current_period_end === 'number' ? raw.current_period_end : (periodEndFromItem ?? 0),
    trial_end: typeof raw.trial_end === 'number' ? raw.trial_end : null,
    cancel_at_period_end: raw.cancel_at_period_end === true,
    metadata: {
      userId: typeof metadata.userId === 'string' ? metadata.userId : '',
      plan: (metadata.plan === 'annual' ? 'annual' : 'monthly') as StripeSubscription['metadata']['plan'],
    },
    card:
      card && typeof card.last4 === 'string'
        ? {
            brand: typeof card.brand === 'string' ? card.brand : null,
            last4: card.last4,
            expMonth: typeof card.exp_month === 'number' ? card.exp_month : null,
            expYear: typeof card.exp_year === 'number' ? card.exp_year : null,
          }
        : null,
    price,
  };
}

export class StripeRestClient implements StripeClient {
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly priceIds: PlanPriceIds;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;

  constructor(config: StripeRestConfig) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.priceIds = config.priceIds;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? Date.now;
  }

  /** One authenticated call. Throws with Stripe's own message on a non-2xx so
   *  the handler's stripeFailure() surfaces something actionable in the logs. */
  private async call(
    path: string,
    init: { method: 'GET' | 'POST'; params?: Record<string, unknown> } = { method: 'GET' }
  ): Promise<Record<string, unknown>> {
    const url = `${STRIPE_API}${path}`;
    const body = init.method === 'POST' ? encodeParams(init.params ?? {}).toString() : undefined;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': STRIPE_API_VERSION,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(`[stripe] ${init.method} ${path} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error(`[stripe] ${init.method} ${path} returned non-JSON (HTTP ${res.status})`);
      }
    }
    if (!res.ok) {
      const message = (parsed as StripeErrorBody).error?.message ?? `HTTP ${res.status}`;
      throw new Error(`[stripe] ${init.method} ${path} failed: ${message}`);
    }
    return parsed;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    // metadata MUST land on the SUBSCRIPTION, not just the session: the webhook
    // attributes a subscription to a user by reading sub.metadata.userId, and
    // the session object is not what later events carry.
    const subscriptionData: Record<string, unknown> = {
      metadata: { userId: params.userId, plan: params.plan },
      trial_period_days: params.trialDays,
      // §2.2.1: with payment_method_collection=always, a trial that ends with no
      // usable card must CANCEL rather than silently convert to past_due.
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    };

    // Embedded Checkout (`ui_mode: embedded_page`) — Stripe's own checkout UI in
    // an iframe on OUR page, so card data still never touches this origin. Why
    // not the custom form SDK (`ui_mode: form`): it is INCOMPATIBLE with Managed
    // Payments, and Managed Payments is the arrangement this account wants. All
    // four facts below were MEASURED against the live test account
    // (2026-09-13), not taken from docs — the docs never mention the first one:
    //   * `ui_mode=form` + Managed Payments -> 400 "Managed Payments currently
    //     only supports ui_mode: hosted_page and ui_mode: embedded_page". So the
    //     choice is embedded_page OR giving up Stripe's merchant-of-record/tax
    //     handling. This account keeps it ON.
    //   * `ui_mode=embedded_page` + Managed Payments -> 200, with
    //     `managed_payments.enabled=true` and
    //     `automatic_tax.liability.type="stripe"`: Stripe remains the merchant of
    //     record and owns indirect-tax compliance (registration and filing), plus
    //     fraud and disputes. Sent EXPLICITLY rather than trusting the account
    //     default, so a future default change cannot silently move who is liable
    //     for the tax — and so the product's tax_code stays mandatory and correct.
    //   * `success_url` AND `cancel_url` are rejected with ui_mode=embedded_page
    //     ("`success_url` is not supported with `ui_mode: embedded_page`"): the
    //     post-payment destination is `return_url`, which is why params.successUrl
    //     is sent there and params.cancelUrl is deliberately not sent at all.
    //   * While Managed Payments is on, subscriptions may only be created through
    //     Checkout (or Payment Links) — so do NOT enable Customer-Portal PLAN
    //     SWITCHING without checking with Stripe first. Cancel / payment method /
    //     invoice history are unaffected.
    const created = await this.call('/checkout/sessions', {
      method: 'POST',
      params: {
        ui_mode: 'embedded_page',
        mode: 'subscription',
        return_url: params.successUrl,
        // Decision 10 (2026-09-05): collect the card up front.
        payment_method_collection: 'always',
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: false },
        automatic_tax: { enabled: true },
        submit_type: 'auto',
        // Labels this integration in the Dashboard so its conversion can be
        // measured separately from any other Checkout integration.
        integration_identifier: 'custom_embedded_web_0001',
        managed_payments: { enabled: true },
        customer_email: params.email,
        client_reference_id: params.userId,
        metadata: { userId: params.userId, plan: params.plan },
        line_items: [{ price: this.priceIds[params.plan], quantity: 1 }],
        subscription_data: subscriptionData,
      },
    });

    // An embedded session returns a client SECRET and no url — the client hands it
    // to Stripe.js to mount Stripe's checkout (see BillingPanel).
    const clientSecret = created.client_secret;
    if (typeof clientSecret !== 'string' || !clientSecret) {
      throw new Error('[stripe] checkout session returned no client_secret');
    }
    return { id: String(created.id ?? ''), clientSecret };
  }

  async createPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const created = await this.call('/billing_portal/sessions', {
      method: 'POST',
      params: { customer: params.customerId, return_url: params.returnUrl },
    });
    const url = created.url;
    if (typeof url !== 'string' || !url) throw new Error('[stripe] portal session returned no url');
    return { url };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
    try {
      // Expand the payment method: it arrives as a bare `pm_…` id otherwise, and
      // the /account billing line needs brand + last4 (plan §2.2). Verified live
      // that this account's subscriptions do carry one under Managed Payments.
      const raw = await this.call(
        `/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=default_payment_method&expand[]=items.data.price`
      );
      return normalizeSubscription(raw);
    } catch (err) {
      // A subscription Stripe no longer knows is a normal end-of-life state
      // (status reconciliation downgrades on null), not an error to retry.
      if (err instanceof Error && /No such subscription/i.test(err.message)) return null;
      throw err;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    params: { cancelAtPeriodEnd?: boolean }
  ): Promise<StripeSubscription | null> {
    if (params.cancelAtPeriodEnd === undefined) return this.retrieveSubscription(subscriptionId);
    const raw = await this.call(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'POST',
      params: { cancel_at_period_end: params.cancelAtPeriodEnd },
    });
    return normalizeSubscription(raw);
  }

  /**
   * Stripe's real scheme: header `t=<unix>,v1=<hex hmac>[,v1=<hex>...]`, where
   * the HMAC covers `${t}.${rawBody}`. Any matching v1 from the current
   * tolerance window passes (Stripe sends several during a secret rotation).
   */
  constructEvent(payload: string, signature: string): StripeEvent {
    if (!signature) throw new Error('[stripe] missing Stripe-Signature header');

    const timestamp = /(?:^|,)t=(\d+)/.exec(signature)?.[1];
    const provided = [...signature.matchAll(/(?:^|,)v1=([0-9a-fA-F]+)/g)].map((m) => m[1]);
    if (!timestamp || provided.length === 0) {
      throw new Error('[stripe] malformed Stripe-Signature header');
    }

    const age = Math.abs(Math.floor(this.clock() / 1000) - Number(timestamp));
    if (age > WEBHOOK_TOLERANCE_SECONDS) {
      throw new Error(`[stripe] signature timestamp outside tolerance (${age}s > ${WEBHOOK_TOLERANCE_SECONDS}s)`);
    }

    const expected = createHmac('sha256', this.webhookSecret).update(`${timestamp}.${payload}`).digest();
    const matches = provided.some((candidate) => {
      let buf: Buffer;
      try {
        buf = Buffer.from(candidate, 'hex');
      } catch {
        return false;
      }
      return buf.length === expected.length && timingSafeEqual(buf, expected);
    });
    if (!matches) throw new Error('[stripe] signature verification failed');

    const event = JSON.parse(payload) as Partial<StripeEvent>;
    if (typeof event.id !== 'string' || typeof event.type !== 'string') {
      throw new Error('[stripe] verified payload is not a Stripe event');
    }
    return {
      id: event.id,
      type: event.type,
      created: typeof event.created === 'number' ? event.created : Math.floor(this.clock() / 1000),
      data: { object: (event.data?.object ?? {}) as Record<string, unknown> },
    };
  }
}
