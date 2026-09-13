'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Billing UI (E4.3) — the Checkout/Portal entry points on /pricing and /account.
// One component, two variants, because the STATE MACHINE is identical and the
// only difference is typography/layout: duplicating it would mean two places to
// get the trial/past-due/cancelled cases wrong.
//
// Everything here is UX only. The server re-checks the session on every call and
// the webhook is what actually moves `tier`; nothing in this file is a gate.
//
// Prices are display copy — the charged amounts live on the Stripe Price objects
// referenced by PRICE_*_TEST/PRICE_*_LIVE in STRIPE_ENV (see
// scripts/stripe-sandbox.mjs). Changing a price therefore means: create a new
// Stripe Price, update the secret, and update these two labels.

const PRICES = {
  monthly: { label: '$20', suffix: 'per month', blurb: 'Cancel any time.' },
  annual: { label: '$200', suffix: 'per year', blurb: 'Two months free vs monthly.' },
} as const;

type Plan = keyof typeof PRICES;

interface BillingStatus {
  plan: Plan | null;
  status: string | null;
  tier: 'free' | 'premium';
  billingAvailable: boolean;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  card: { brand: string | null; last4: string; expMonth: number | null; expYear: number | null } | null;
}

/** '2026-09-27T02:17:13.000Z' -> '27 September 2026' (en-GB, matching the site). */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PRIMARY_BASE =
  'inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const SECONDARY_BASE =
  'inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

export function BillingPanel({ variant }: { variant: 'pricing' | 'account' }) {
  const { user, loaded } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Plan | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/subscriptions/status');
      if (!res.ok) {
        // Without this the panel would spin forever: a 5xx, an expired session,
        // or the dev allowlist's 403 all return non-200, and there is no other
        // exit from the loading branch. Reachable on dev for non-allowlisted
        // accounts, which is exactly where a click-through happens.
        setFailed(true);
        return;
      }
      setStatus((await res.json()) as BillingStatus);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (loaded && user) void load();
  }, [loaded, user, load]);

  /** Stripe hands back an ABSOLUTE url (window.location.assign); our own routes
   *  (the sign-in bounce) go through the router so they stay client-side. */
  const post = useCallback(
    async (path: string, body: unknown, onSuccess: (url: string) => void) => {
      setError(null);
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push('/login?next=/pricing');
          return;
        }
        const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && payload.url) {
          onSuccess(payload.url);
          return;
        }
        if (res.status === 409) {
          // Already subscribed (another tab, or a webhook landing first).
          setError('You already have a subscription — refresh to see it.');
          await load();
          return;
        }
        if (res.status === 503) {
          setError("We're not taking payments just yet — please check back soon.");
          await load();
          return;
        }
        setError('Something went wrong starting that. Please try again.');
      } catch {
        setError('Network problem — please try again.');
      } finally {
        setBusy(null);
      }
    },
    [load, router]
  );

  const startCheckout = (plan: Plan) => {
    setBusy(plan);
    void post('/api/subscriptions/checkout', { plan }, (url) => window.location.assign(url));
  };


  const openPortal = () => {
    setBusy('portal');
    void post('/api/subscriptions/portal', {}, (url) => window.location.assign(url));
  };

  // The plan pair fills its column on /pricing (a deliberate equal-weight pair),
  // but must be content-width on /account, where every other button is. NOTE:
  // `w-full` alone did NOT achieve that — grid items stretch regardless, so the
  // container has to change too (grid → flex-wrap). The UX review caught the
  // first version of this claiming a fix it did not deliver.
  const planPairClass = variant === 'pricing' ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2';
  const fullWidth = variant === 'pricing' ? ' w-full' : '';
  const primaryButtonClass = PRIMARY_BASE + fullWidth;
  const secondaryButtonClass = SECONDARY_BASE + fullWidth;

  // --- Loading / failed / signed-out -------------------------------------------

  if (!status && failed) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn’t load your plan. Refresh the page, or try again.
        </p>
        <button type="button" className={secondaryButtonClass} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!loaded || !status) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400" aria-busy="true">
        {loaded && !user ? (
          <Link
            href="/login?next=/pricing"
            className={variant === 'pricing' ? primaryButtonClass : secondaryButtonClass}
          >
            Sign in to see your plan
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> Checking your plan…
          </span>
        )}
      </div>
    );
  }

  const planLabel = status.plan ? (status.plan === 'annual' ? 'Annual' : 'Monthly') : null;
  const cardLine = status.card
    ? `${status.card.brand ? status.card.brand[0].toUpperCase() + status.card.brand.slice(1) : 'Card'} ending ${status.card.last4}`
    : null;

  // --- Not configured (prod until a LIVE key set exists) ----------------------

  if (!status.billingAvailable) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {status.tier === 'premium'
          ? 'Your Premium access is active.'
          : "We're not taking payments yet — Premium is coming soon."}
      </p>
    );
  }

  // --- Subscribed -------------------------------------------------------------

  if (status.status && status.status !== 'canceled') {
    const trialing = status.status === 'trialing';
    const when = trialing ? status.trialEndsAt : status.currentPeriodEnd;
    const needsAttention = status.status === 'past_due' || status.status === 'incomplete';
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            {planLabel ?? 'Premium'}
            {trialing ? ' — free trial' : ''}
          </span>
          {needsAttention && <span className="text-amber-700 dark:text-amber-400"> — payment needs attention</span>}
          {when && (
            <>
              {' · '}
              {needsAttention
                ? status.status === 'incomplete'
                  ? "we couldn’t take your first payment — no subscription is active"
                  : 'Stripe is retrying your card'
                : status.cancelAtPeriodEnd
                  ? `Ends ${formatDate(when)}`
                  : `${trialing ? 'First charge' : 'Renews'} ${formatDate(when)}`}
            </>
          )}
        </p>
        {status.cancelAtPeriodEnd && !needsAttention && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your subscription won’t renew. You keep Premium until the date above.
          </p>
        )}
        {cardLine && <p className="text-xs text-gray-500 dark:text-gray-400">{cardLine}</p>}
        <button type="button" className={secondaryButtonClass} onClick={openPortal} disabled={busy !== null} aria-busy={busy === 'portal'}>
          {busy === 'portal' ? (
            <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <CreditCard className="w-4 h-4" aria-hidden="true" />
          )}
          Manage billing
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  // --- Free (or lapsed) — offer both plans ------------------------------------

  const lapsed = status.status === 'canceled';
  return (
    <div className="space-y-4">
      {variant === 'pricing' ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {lapsed
            ? 'Your subscription has ended. Start a new one to get Premium back — the first 14 days are free.'
            : 'Start a 14-day free trial. We collect your card now and only charge when the trial ends.'}
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {/* Must not restate the benefit list two lines below (UX_GUIDELINES:
              say it once) — so it states the TRIAL, which the list does not. */}
          {lapsed
            ? 'Your subscription has ended. Start a new one — the first 14 days are free.'
            : 'You’re on the free plan. The first 14 days of Premium are free.'}
        </p>
      )}

      {/* On /pricing the card above ALREADY lists the benefits, so repeating
          them here duplicates the copy (and the two lists had already drifted
          to different wording). /account has no such list, so it keeps this. */}
      {variant === 'account' && (
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {['Unlimited AI marking', 'Every paper set and ladder level', 'Timed mock exams'].map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>
      )}

      <div className={planPairClass}>
        {(['monthly', 'annual'] as const).map((plan) => (
          <button
            key={plan}
            type="button"
            className={primaryButtonClass}
            onClick={() => startCheckout(plan)}
            disabled={busy !== null}
            aria-busy={busy === plan}
          >
            {busy === plan && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />}
            {PRICES[plan].label} {PRICES[plan].suffix}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {PRICES.annual.blurb} Cancel any time from your account.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
