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
