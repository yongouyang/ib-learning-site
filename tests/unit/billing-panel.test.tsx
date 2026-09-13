import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillingPanel } from '@/components/BillingPanel';

// E4.3 billing UI: the STATE MACHINE is what matters here — which action each
// billing state offers, and what happens when the API says no. These are exactly
// the branches that decide whether a paying user can reach the Portal and
// whether a free user sees a working Checkout button, so every one is pinned.
//
// The server re-checks everything; nothing in this component is a gate, so the
// tests assert REQUESTS and rendered affordances, not entitlement bugs.

let authUser: unknown = { userId: 'u1', email: 'a@b.c', tier: 'free' };
const { assign, push } = vi.hoisted(() => ({ assign: vi.fn(), push: vi.fn() }));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: authUser, loaded: true }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function statusBody(over: Record<string, unknown> = {}) {
  return {
    plan: null,
    status: null,
    tier: 'free',
    billingAvailable: true,
    currentPeriodEnd: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    card: null,
    ...over,
  };
}

/** fetch mock: GET status -> `status`, POST <path> -> `post` */
function mockFetch(status: unknown, post?: { status: number; body?: unknown }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (init?.method === 'POST') {
      return new Response(JSON.stringify(post?.body ?? {}), { status: post?.status ?? 200 });
    }
    return new Response(JSON.stringify(status), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

beforeEach(() => {
  assign.mockClear();
  push.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
  authUser = { userId: 'u1', email: 'a@b.c', tier: 'free' };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('BillingPanel — free user', () => {
  it('offers both plans and sends the chosen one to Checkout, then follows Stripe', async () => {
    const calls = mockFetch(statusBody(), { status: 200, body: { url: 'https://checkout.stripe.com/cs_test_x' } });
    render(<BillingPanel variant="pricing" />);

    const monthly = await screen.findByRole('button', { name: /\$20 per month/i });
    expect(screen.getByRole('button', { name: /\$200 per year/i })).toBeInTheDocument();

    await userEvent.click(monthly);

    const post = calls.find((c) => c.init?.method === 'POST');
    expect(post?.url).toBe('/api/subscriptions/checkout');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ plan: 'monthly' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/cs_test_x'));
  });

  it('hides the plans and explains itself when billing is unconfigured (prod today)', async () => {
    mockFetch(statusBody({ billingAvailable: false }));
    render(<BillingPanel variant="pricing" />);

    await waitFor(() => expect(screen.getByText(/not taking payments yet/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /\$20 per month/i })).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in rather than failing', async () => {
    authUser = null;
    mockFetch(statusBody());
    render(<BillingPanel variant="pricing" />);

    const link = await screen.findByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login?next=/pricing');
  });
});

describe('BillingPanel — subscribed states', () => {
  it('shows the trial end date, the card and a working Portal button while trialing', async () => {
    const calls = mockFetch(
      statusBody({
        plan: 'monthly',
        status: 'trialing',
        tier: 'premium',
        trialEndsAt: '2026-09-27T02:17:13.000Z',
        card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
      }),
      { status: 200, body: { url: 'https://billing.stripe.com/p/session_x' } }
    );
    render(<BillingPanel variant="account" />);

    expect(await screen.findByText(/Monthly — free trial/i)).toBeInTheDocument();
    expect(screen.getByText(/First charge 27 September 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Visa ending 4242/)).toBeInTheDocument();
    // A trialing user must NOT be offered Checkout again (the API 409s it too).
    expect(screen.queryByRole('button', { name: /\$20 per month/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /manage billing/i }));
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(post?.url).toBe('/api/subscriptions/portal');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session_x'));
  });

  it('flags a past-due subscription and still routes to the Portal, not Checkout', async () => {
    mockFetch(statusBody({ plan: 'annual', status: 'past_due', tier: 'premium', currentPeriodEnd: '2026-10-01T00:00:00.000Z' }));
    render(<BillingPanel variant="account" />);

    expect(await screen.findByText(/payment needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe is retrying your card/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\$200 per year/i })).not.toBeInTheDocument();
  });

  it('tells a cancelling user they keep access until the period ends', async () => {
    mockFetch(statusBody({ plan: 'monthly', status: 'active', tier: 'premium', currentPeriodEnd: '2026-10-13T00:00:00.000Z', cancelAtPeriodEnd: true }));
    render(<BillingPanel variant="account" />);

    expect(await screen.findByText(/Ends 13 October 2026/)).toBeInTheDocument();
    expect(screen.getByText(/won’t renew/i)).toBeInTheDocument();
  });

  it('lets a lapsed subscriber start again', async () => {
    mockFetch(statusBody({ status: 'canceled', tier: 'free' }));
    render(<BillingPanel variant="pricing" />);

    expect(await screen.findByText(/subscription has ended/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\$20 per month/i })).toBeInTheDocument();
  });
});

describe('BillingPanel — API refusals surface honestly', () => {
  it('explains a 503 (billing not configured) instead of looking broken', async () => {
    mockFetch(statusBody(), { status: 503, body: { error: 'billing_unavailable' } });
    render(<BillingPanel variant="pricing" />);

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not taking payments just yet/i);
    expect(assign).not.toHaveBeenCalled();
  });

  it('refreshes state when the server says a subscription already exists', async () => {
    mockFetch(statusBody(), { status: 409, body: { error: 'already_subscribed' } });
    render(<BillingPanel variant="pricing" />);

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already have a subscription/i);
    expect(assign).not.toHaveBeenCalled();
  });

  it('rounds a 401 up to the login page via the router (no full reload)', async () => {
    mockFetch(statusBody(), { status: 401, body: { error: 'login_required' } });
    render(<BillingPanel variant="pricing" />);

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?next=/pricing'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not spin forever when the status read fails — it offers a retry', async () => {
    // A 5xx, an expired session or the dev allowlist's 403 all return non-200;
    // the first version of this component rendered "Checking your plan…" for
    // ever in every one of those cases, with no way out.
    let attempts = 0;
    vi.stubGlobal('fetch', async () => {
      attempts++;
      if (attempts === 1) return new Response('{}', { status: 403 });
      return new Response(JSON.stringify(statusBody()), { status: 200 });
    });
    render(<BillingPanel variant="pricing" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t load your plan/i);
    expect(screen.queryByText(/Checking your plan/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /\$20 per month/i })).toBeInTheDocument();
  });

  it('describes an incomplete subscription as an unfinished first payment, not a retry', async () => {
    // `incomplete` means the FIRST payment never completed and the subscription
    // is not active (tier free) — "Stripe is retrying your card" would be false.
    mockFetch(statusBody({ plan: 'monthly', status: 'incomplete', tier: 'free', currentPeriodEnd: '2026-09-20T00:00:00.000Z' }));
    render(<BillingPanel variant="account" />);

    expect(await screen.findByText(/couldn’t take your first payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/retrying your card/i)).not.toBeInTheDocument();
  });
});

// Embedded Checkout (ui_mode=embedded_page): with a publishable key present the
// panel mounts Stripe's own checkout in an iframe from the session's client
// secret instead of navigating to a hosted page. Verified against the live test
// account that the SERVER half works (an embedded_page session with Managed
// Payments returns client_secret and automatic_tax.liability=stripe); this pins
// the client half — the option names (`createEmbeddedCheckoutPage` and the
// function-shaped `fetchClientSecret`, both of which the 2026-03-25.dahlia API
// renamed from the older `initEmbeddedCheckout`/`clientSecret`), that the session
// POST happens INSIDE fetchClientSecret rather than on click, that the container
// id Stripe mounts into still exists, and that Cancel destroys the instance.
describe('BillingPanel — embedded Checkout', () => {
  type EmbeddedOptions = {
    fetchClientSecret: () => Promise<string>;
    /** Must stay absent — see the assertion below. */
    appearance?: unknown;
  };

  const mountMock = vi.fn();
  const destroyMock = vi.fn();

  async function renderWithStripe(key: string | undefined) {
    if (key) vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', key);
    vi.resetModules(); // module-scope key read — must be re-imported after stubbing
    const { BillingPanel: Panel } = await import('@/components/BillingPanel');

    const options: EmbeddedOptions[] = [];
    const stripeCtor = vi.fn(() => ({
      createEmbeddedCheckoutPage(opts: EmbeddedOptions) {
        options.push(opts);
        return { mount: mountMock, destroy: destroyMock };
      },
    }));
    vi.stubGlobal('Stripe', stripeCtor);
    render(<Panel variant="pricing" />);
    return { stripeCtor, options };
  }

  beforeEach(() => {
    mountMock.mockClear();
    destroyMock.mockClear();
  });

  it('mounts Stripe checkout into #checkout-form, fetching the secret only when Stripe asks for it', async () => {
    const calls = mockFetch(statusBody(), { status: 200, body: { client_secret: 'cs_test_x_secret' } });
    const { stripeCtor, options } = await renderWithStripe('pk_test_probe');

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));

    // The plan buttons give way to the container Stripe's snippet mounts into…
    await waitFor(() => expect(document.getElementById('checkout-form')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /\$200 per year/i })).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(mountMock).toHaveBeenCalledWith('#checkout-form'));

    // No beta flag: that belongs to ui_mode=form, which Managed Payments forbids.
    expect(stripeCtor).toHaveBeenCalledWith('pk_test_probe');
    // And NO `appearance`: embedded checkout rejects that option outright —
    // "Invalid initEmbeddedCheckout(options) parameter: appearance is not an
    // accepted parameter" — which broke the whole mount until it was removed
    // (found by scripts/check-embedded-checkout.mjs against real test mode).
    expect(options[0]?.appearance).toBeUndefined();
    expect(Object.keys(options[0]!)).toEqual(['fetchClientSecret']);

    // The session is created by fetchClientSecret, not by the click — one
    // session per click, and Stripe can re-call it when one expires.
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(0);
    await expect(options[0]!.fetchClientSecret()).resolves.toBe('cs_test_x_secret');
    const posted = calls.filter((c) => c.init?.method === 'POST');
    expect(posted[0]?.url).toBe('/api/subscriptions/checkout');
    expect(JSON.parse(String(posted[0]?.init?.body))).toEqual({ plan: 'monthly' });

    // Cancel tears the iframe down and brings the plans back.
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(destroyMock).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /\$20 per month/i })).toBeInTheDocument();
  });

  it('shows the server\u2019s refusal inside the checkout branch, not nowhere', async () => {
    // A 503 (billing not configured) arrives while Stripe is asking for the
    // client secret — before this branch rendered `error`, that message was set
    // and never displayed.
    mockFetch(statusBody(), { status: 503, body: { error: 'billing_unavailable' } });
    const { options } = await renderWithStripe('pk_test_probe');

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));
    await waitFor(() => expect(options[0]).toBeTruthy());
    await expect(options[0]!.fetchClientSecret()).rejects.toThrow(/checkout_unavailable/);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not taking payments just yet/i);
  });

  it('falls back to the hosted URL (and never touches Stripe.js) without a publishable key', async () => {
    // The dev/e2e dummy returns a URL alongside the secret, which is what keeps
    // a local run clickable and the e2e suite green.
    mockFetch(statusBody(), { status: 200, body: { client_secret: 'cs_dummy_secret', url: 'https://checkout.stripe.com/dummy/cs_1' } });
    const { stripeCtor } = await renderWithStripe(undefined);

    await userEvent.click(await screen.findByRole('button', { name: /\$20 per month/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/dummy/cs_1'));
    expect(stripeCtor).not.toHaveBeenCalled();
  });

  it('gives up on a Stripe.js script that is present but never loads (blocked by an ad blocker)', async () => {
    // Regression: the wait listened for the script's load/error events only. A
    // script that ALREADY failed before the click (blockers block js.stripe.com;
    // this was reproduced by aborting the request in the UX capture) fires
    // neither, so the promise never settled and the user sat in front of an
    // empty box with no message — for ever.
    vi.resetModules();
    const { whenStripeReady } = await import('@/components/BillingPanel');
    const dead = document.createElement('script');
    dead.src = 'https://js.stripe.com/dahlia/stripe.js'; // never fires load or error
    document.head.appendChild(dead);
    try {
      delete (window as { Stripe?: unknown }).Stripe;
      await expect(whenStripeReady(50)).resolves.toBeNull();
    } finally {
      dead.remove();
    }
    // And it still resolves the real constructor when the script DID load.
    const ctor = vi.fn();
    vi.stubGlobal('Stripe', ctor);
    await expect(whenStripeReady(50)).resolves.toBe(ctor);
  });
});
