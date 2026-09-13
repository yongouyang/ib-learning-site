'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

// --- Embedded Checkout -------------------------------------------------------
//
// Stripe.js is loaded in the root layout's <head> straight from Stripe's domain
// (app/layout.tsx) — never bundled or self-hosted, which is the PCI requirement.
// Checkout itself is Stripe's own UI in an iframe, so card data never touches
// this origin (SAQ A); the only handoff is the session's client secret from
// POST /api/subscriptions/checkout.
//
// `embedded_page` rather than the custom form SDK (`ui_mode=form`): the form is
// incompatible with Managed Payments, which keeps Stripe the merchant of record
// and the party that registers and files indirect tax. Measured
// 2026-09-13 — see the createCheckoutSession comment in stripe-rest.ts.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// NOTE: there is deliberately no appearance object here. Embedded Checkout takes
// NO `appearance` option — Stripe.js rejects the call outright:
//   "IntegrationError: Invalid initEmbeddedCheckout(options) parameter:
//    appearance is not an accepted parameter."
// (found by scripts/check-embedded-checkout.mjs against real test mode; the
// appearance docs describe the Elements/Checkout appearance API, not this SDK).
// Colours, fonts, logo and radius for embedded checkout are configured in
// Checkout Studio / Dashboard -> Settings -> Branding, which is also where the
// Checkout Studio palette now lives.

/** The slice of Stripe.js this file uses, typed by hand: one script tag and zero
 *  dependencies, versus ~50KB of types for three methods. */
interface EmbeddedCheckoutInstance {
  mount(target: string | HTMLElement): void;
  destroy?(): void;
}
interface StripeEmbeddedCheckoutSdk {
  createEmbeddedCheckoutPage(options: {
    /** Re-called by Stripe if the session expires, which is why it is a function
     *  rather than a value (the old `clientSecret` option is deprecated). */
    fetchClientSecret: () => Promise<string>;
  }): EmbeddedCheckoutInstance | Promise<EmbeddedCheckoutInstance>;
}
type StripeConstructor = (key: string, options?: { betas?: string[] }) => StripeEmbeddedCheckoutSdk;

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

/** The head script is `async`, so on a cold load `window.Stripe` may not exist
 *  yet when the user clicks a plan. Resolve when it does — event, not polling.
 *
 *  The timeout is NOT decoration: a blocked script (ad blockers commonly block
 *  js.stripe.com; measured in the UX capture, where an aborted request left this
 *  promise permanently unsettled) fires NO event at all if it already failed
 *  before this call — without a bound the user would stare at an empty box with
 *  no message for ever. */
export function whenStripeReady(timeoutMs = 5000): Promise<StripeConstructor | null> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  const script = document.querySelector<HTMLScriptElement>('script[src*="js.stripe.com"]');
  if (!script) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = () => resolve(window.Stripe ?? null);
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

export function BillingPanel({ variant }: { variant: 'pricing' | 'account' }) {
  const { user, loaded } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Plan | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The plan the user is paying for. Non-null = the embedded Checkout branch
   *  below owns the space, and the effect mounts Stripe's checkout into it. */
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  /** POST one billing action and hand back Stripe's JSON. Returns null when the
   *  request never got a usable 200 (each failure sets its own message). */
  const post = useCallback(
    async (path: string, body: unknown): Promise<{ url?: string; client_secret?: string } | null> => {
      setError(null);
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push('/login?next=/pricing');
          return null;
        }
        const payload = (await res.json().catch(() => ({}))) as { url?: string; client_secret?: string };
        if (res.ok) return payload;
        if (res.status === 409) {
          // Already subscribed (another tab, or a webhook landing first).
          setError('You already have a subscription — refresh to see it.');
          await load();
          return null;
        }
        if (res.status === 503) {
          setError("We're not taking payments just yet — please check back soon.");
          await load();
          return null;
        }
        setError('Something went wrong starting that. Please try again.');
        return null;
      } catch {
        setError('Network problem — please try again.');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [load, router]
  );

  const startCheckout = async (plan: Plan) => {
    setError(null);
    setFormError(null);
    // With a publishable key the POST belongs INSIDE fetchClientSecret (Stripe
    // re-calls it if a session expires), so this creates exactly one session per
    // click instead of one here plus one there.
    if (PUBLISHABLE_KEY) {
      setCheckoutPlan(plan);
      return;
    }
    // No publishable key (local dev, CI): the dev/e2e dummy also returns a
    // hosted-style URL. Follow it so the button still does something observable.
    setBusy(plan);
    const payload = await post('/api/subscriptions/checkout', { plan });
    if (payload?.url) {
      window.location.assign(payload.url);
      return;
    }
    if (payload) setError("We're not taking payments just yet — please check back soon.");
  };

  const openPortal = async () => {
    setBusy('portal');
    const payload = await post('/api/subscriptions/portal', {});
    if (payload?.url) window.location.assign(payload.url);
  };

  // The mount effect must depend on the PLAN and nothing else. Depending on
  // `post` would re-run it whenever that callback's identity changed (it is
  // memoised on `useRouter()`'s object), and a re-run DESTROYS the mounted
  // checkout and fetches a new session — i.e. it would wipe a customer's
  // half-entered card details and create a second Stripe session. The ref keeps
  // the callback fresh without making it a dependency.
  const postRef = useRef(post);
  useEffect(() => {
    postRef.current = post;
  }, [post]);

  // Mount Stripe's embedded checkout once a plan is chosen. The container id is
  // Stripe's snippet contract, and it is rendered by the branch below — so this
  // effect (which runs after that commit) always finds it.
  useEffect(() => {
    if (!checkoutPlan) return;
    const key = PUBLISHABLE_KEY;
    let instance: EmbeddedCheckoutInstance | null = null;
    let cancelled = false;

    void (async () => {
      const StripeCtor = await whenStripeReady();
      if (cancelled) return;
      if (!StripeCtor || !key) {
        setFormError('Couldn’t load the checkout. Refresh the page, or try again.');
        return;
      }
      try {
        const stripe = StripeCtor(key);
        const checkout = await stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: async () => {
            const payload = await postRef.current('/api/subscriptions/checkout', { plan: checkoutPlan });
            if (!payload?.client_secret) throw new Error('checkout_unavailable');
            return payload.client_secret;
          },
        });
        if (cancelled) {
          checkout.destroy?.();
          return;
        }
        instance = checkout;
        checkout.mount('#checkout-form');
      } catch (err) {
        console.error('Embedded checkout failed to load:', err);
        if (!cancelled) setFormError('Couldn’t load the checkout. Refresh the page, or try again.');
      }
    })();

    return () => {
      cancelled = true;
      instance?.destroy?.();
    };
  }, [checkoutPlan]);

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

  // --- Choosing a plan: embedded Checkout owns this space until it's done -----
  //
  // Replaces the buttons rather than opening a modal: Stripe's checkout is tall
  // (plan summary + card + billing address + tax) and a /pricing card column is
  // the narrowest place it ever renders. On success Stripe redirects to
  // return_url (/account?billing=updated) — nothing is handled here, because the
  // webhook is what grants Premium.
  if (checkoutPlan) {
    // `error` too: a failure while fetching the client secret (503 not
    // configured, 409 already subscribed, network) is reported by post().
    const message = formError ?? error;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter your card details to start the trial — nothing is charged today.
        </p>
        {/* Stripe mounts its iframe here (id is its snippet contract). The
            min-height stops the card collapsing and shoving Cancel upwards for
            the moment before the iframe paints — dropped in the error state,
            where the same space is pure dead air above the message. */}
        <div id="checkout-form" className={message ? undefined : 'min-h-[288px]'} />
        {message && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        )}
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setCheckoutPlan(null);
            setFormError(null);
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

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
            onClick={() => void startCheckout(plan)}
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
