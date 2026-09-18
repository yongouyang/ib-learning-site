'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import { useEntitlements } from '@/context/EntitlementsContext';
import { getCourse } from '@/lib/courses';
import { loginHref } from '@/lib/safe-redirect';
import type { Paper, PaperMeta } from '@/content/types';
import type { PremiumAttribution } from '@/lib/content/types';
import PaperRunnerClient from './PaperRunnerClient';

/**
 * Phase 1b (docs/premium-content-protection-plan.md §4.2) — the premium paper sets are no longer in
 * the build, so this shell fetches them from the gated content API once the session's entitlements
 * resolve. States, in this order on purpose:
 *
 *  1. entitlements unresolved → a NEUTRAL skeleton, never the lock. A gate that flashes over content
 *     the user may be entitled to is the no-flash rule (UX_GUIDELINES + LockedFeature).
 *  2. not entitled → a plainly-readable preview (public metadata: title, duration, marks, counts) plus
 *     the premium CTA card. The preview is NOT dimmed and NOT hidden from AT: it is the page's
 *     evidence of value, it is already public (it is in the page <title>), and dimming it measured
 *     ~1.7:1 contrast while putting it inside `aria-hidden`.
 *  3. entitled → one GET to /api/content/premium/papers/<courseId>/<setId>; 401 → sign-in prompt,
 *     403 → an honest "not in your plan" card, 429 → the per-account speed limit (before Phase 2 this
 *     fell into the generic error line, telling a real student clicking through sets that "something
 *     went wrong" and leaving them to guess), anything else → an error line.
 *
 * EVERY branch renders the same breadcrumb chrome, which is also the page's <h1>
 * (`currentAsHeading`). The free set-1 page gets its chrome from PaperRunnerClient; before this the
 * premium page had no heading at all and never named the course its copy referred to ("for this
 * course"), and the mobile account pill overlapped the first card at 375px.
 */
export default function PremiumPaperShell({
  courseId,
  setId,
  meta,
}: {
  courseId: string;
  setId: string;
  /** Public metadata only — the page never receives the questions or mark schemes. */
  meta: PaperMeta;
}) {
  const { has, loaded } = useEntitlements();
  const entitled = loaded && has('exam-sets-full');
  const pathname = usePathname();
  const [paper, setPaper] = useState<Paper | null>(null);
  // Phase 2: the leak-tracing marker the server issued with this set (premium sets only).
  const [attribution, setAttribution] = useState<PremiumAttribution | null>(null);
  const [failure, setFailure] = useState<'login' | 'not_entitled' | 'rate_limited' | 'error' | null>(null);
  // Minutes until the premium rate-limit window rolls, resolved when the 429 arrives — never computed
  // during render (this component is prerendered, so render must stay pure).
  const [rateLimitResetsIn, setRateLimitResetsIn] = useState<number | null>(null);
  // A retry is in flight. This keeps the CARD — and the pressed button, and the user's focus — mounted
  // while the refetch runs, rather than swapping in the skeleton: the explanation stays readable, and
  // an unmounted focused button drops focus to <body> with nothing announced (UX-review finding).
  const [retrying, setRetrying] = useState(false);
  // Bumping this re-runs the fetch, so a transitory failure (5xx, offline, a stale 404) has a control
  // to press instead of advice the user cannot act on.
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!entitled) return;
    let cancelled = false;
    fetch(`/api/content/premium/papers/${courseId}/${setId}`)
      .then(async (res) => {
        if (res.status === 401) throw new Error('login');
        if (res.status === 403) throw new Error('not_entitled');
        if (res.status === 429) {
          // Phase 2: the per-account premium budget. Read `resetAt` so the copy can name a time
          // instead of saying "later" — the server already computes it (400-style parsing is not
          // worth a failure path here: a missing field just yields the vaguer sentence).
          const body = (await res.json().catch(() => null)) as { resetAt?: string } | null;
          const deltaMs = body?.resetAt ? Date.parse(body.resetAt) - Date.now() : Number.NaN;
          // Only a POSITIVE, finite delta is quoted. A device clock running ahead of the server can
          // make it negative, and clamping that to 1 would pin the copy at "about 1 minute" for as
          // long as the skew lasts — a number the server keeps contradicting. Say nothing precise.
          if (!cancelled && Number.isFinite(deltaMs) && deltaMs > 0) {
            setRateLimitResetsIn(Math.ceil(deltaMs / 60_000));
          }
          throw new Error('rate_limited');
        }
        if (!res.ok) throw new Error('error');
        return res.json() as Promise<{ paper: Paper; attribution?: PremiumAttribution }>;
      })
      .then((body) => {
        if (cancelled) return;
        setFailure(null);
        setPaper(body.paper);
        setAttribution(body.attribution ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setFailure(err.message as 'login' | 'not_entitled' | 'rate_limited' | 'error');
      })
      .finally(() => {
        if (!cancelled) setRetrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entitled, courseId, setId, retryKey]);

  const heading = `${getCourse(courseId)?.title ?? courseId} ${meta.title}`;

  // One skeleton definition, shaped like the runner's first screen (a heading row plus a tall question
  // card). Visible text, not an sr-only line: a status region that mounts with its text and an
  // `aria-busy` that never flips to false announces nothing, so the copy is shown to everyone and
  // matches /mixed-review's loading state. Tone is bumped one step (gray-300 / gray-700) because the
  // placeholder is the only thing on screen under reduced motion, where the pulse does not run.
  const loading = (
    <div role="status">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Loading this set…</p>
      <div className="h-7 w-3/4 rounded bg-gray-300 dark:bg-gray-700 motion-safe:animate-pulse" />
      <div className="mt-4 h-56 rounded-xl bg-gray-200 dark:bg-gray-800 motion-safe:animate-pulse" />
    </div>
  );

  // No title line: the breadcrumb-as-h1 above already reads "<course> <set title>", so repeating it
  // here added nothing and left the card's only heading a <p>.
  const preview = (
    <div className="card p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {meta.durationMinutes && (
          <>
            <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />
            {meta.durationMinutes} min ·{' '}
          </>
        )}
        {meta.questionCount} questions · {meta.totalMarks} marks
      </p>
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Free-response questions with a tick-point mark scheme and a model answer for every question.
      </p>
    </div>
  );

  // The retry control is shared by the two recoverable failure cards (rate limit, generic error) so
  // they cannot drift apart: both keep the card mounted and disable the button while the refetch is in
  // flight. Without `retrying`, pressing the button changed NOTHING on screen until the response
  // landed — and on a repeat failure, not even then (UX-review P2-1; the error card had the same hole).
  const retryControl = (
    <button
      type="button"
      disabled={retrying}
      onClick={() => {
        setRetrying(true);
        setRetryKey((key) => key + 1);
      }}
      className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed dark:hover:bg-blue-500"
    >
      {retrying ? 'Checking…' : 'Try again'}
    </button>
  );

  let body: React.ReactNode;
  if (!loaded || (entitled && !paper && failure === null)) {
    // One branch for both loading states (entitlements unresolved; entitled and fetching) — they
    // rendered byte-identical blocks before, which is also why the status region was duplicated.
    body = loading;
  } else if (failure === 'not_entitled') {
    // The SERVER said not_entitled while this client believed otherwise (a stale tier). LockedFeature
    // cannot express this state — it re-reads the same client entitlements and would render the paper
    // unlocked — so the honest answer is said plainly.
    body = (
      <>
        {preview}
        <div className="card p-5 mt-3 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Not included in your plan</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            This set is part of the exam tier, which your account does not include. If you upgraded just
            now, reload the page to pick up your new access.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
          >
            See Premium plans
          </Link>
        </div>
      </>
    );
  } else if (!entitled) {
    body = (
      <>
        {preview}
        <div className="mt-3">
          {/* No children: there is nothing to dim — the CTA card is the whole message. */}
          <LockedFeature
            feature="exam-sets-full"
            title="Full exam sets"
            benefit="Set 1 is free — Premium unlocks every set for this course, upper ladder levels and timed mock mode."
          />
        </div>
      </>
    );
  } else if (failure === 'login') {
    body = (
      <>
        {preview}
        <div className="card p-5 mt-3 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Sign in to open this set</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Premium sets are served to your account, so we need to know who you are.
          </p>
          <a
            href={loginHref(pathname ?? '/')}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
          >
            Sign in
          </a>
        </div>
      </>
    );
  } else if (failure === 'rate_limited') {
    // The per-account premium budget (Phase 2). Three copy rules, each from the UX-review pass:
    //  • the headline is about the LIMIT, never about "you" — the bucket is per ACCOUNT, and an
    //    account holds several child profiles, so three siblings can trip it between them;
    //  • it never says "sets": the counter counts DELIVERIES, so 30 reloads of one set trip it too;
    //  • the count and its unit are joined with a non-breaking space, because at 375px "…in about
    //    17 / minutes." split the number from its unit across a line break.
    body = (
      <>
        {preview}
        <div className="card p-5 mt-3 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">This is a speed limit</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {rateLimitResetsIn
              ? `Premium sets are limited per\u00A0account per\u00A0hour. You can open the next one in about ${rateLimitResetsIn}\u00A0minute${rateLimitResetsIn === 1 ? '' : 's'}.`
              : 'Premium sets are limited per\u00A0account per\u00A0hour. Try again in a little while.'}{' '}
            Your plan is unaffected.
          </p>
          {retryControl}
        </div>
      </>
    );
  } else if (failure === 'error') {
    body = (
      <>
        {preview}
        <div className="card p-5 mt-3 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Could not load this set</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Something went wrong fetching it — your plan is unaffected.
          </p>
          {retryControl}
        </div>
      </>
    );
  } else if (!paper) {
    body = loading;
  } else {
    return <PaperRunnerClient paper={paper} attribution={attribution ?? undefined} />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/papers', label: 'Practice Papers' },
          { label: heading },
        ]}
        currentAsHeading
      />
      {body}
    </div>
  );
}
