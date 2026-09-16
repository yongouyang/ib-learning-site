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
 *     403 → an honest "not in your plan" card, anything else → an error line.
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
  const [failure, setFailure] = useState<'login' | 'not_entitled' | 'error' | null>(null);

  useEffect(() => {
    if (!entitled) return;
    let cancelled = false;
    fetch(`/api/content/premium/papers/${courseId}/${setId}`)
      .then(async (res) => {
        if (res.status === 401) throw new Error('login');
        if (res.status === 403) throw new Error('not_entitled');
        if (!res.ok) throw new Error('error');
        return res.json() as Promise<{ paper: Paper }>;
      })
      .then((body) => {
        if (cancelled) return;
        setFailure(null);
        setPaper(body.paper);
      })
      .catch((err: Error) => {
        if (!cancelled) setFailure(err.message as 'login' | 'not_entitled' | 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [entitled, courseId, setId]);

  const heading = `${getCourse(courseId)?.title ?? courseId} ${meta.title}`;

  // One skeleton definition, shaped like the runner's first screen (a heading row plus a tall question
  // card) rather than two thin bars: it is visible for the whole premium round-trip, and the loaded
  // screen is ~7× taller, so a short block would grow the page under the reader.
  const skeleton = (
    <>
      <div className="mt-2 h-7 w-3/4 rounded bg-gray-200 dark:bg-gray-800 motion-safe:animate-pulse" />
      <div className="mt-4 h-56 rounded-xl bg-gray-100 dark:bg-gray-800/60 motion-safe:animate-pulse" />
    </>
  );

  const preview = (
    <div className="card p-5">
      <p className="font-semibold text-gray-900 dark:text-gray-50">{meta.title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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

  let body: React.ReactNode;
  if (!loaded) {
    body = (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading this set…</span>
        {skeleton}
      </div>
    );
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
            This set is part of the exam tier. If you recently upgraded, sign out and back in to refresh
            your access.
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
  } else if (failure === 'error') {
    body = (
      <>
        {preview}
        <div className="card p-5 mt-3 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Could not load this set</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Check your connection and reload the page — your plan is unaffected.
          </p>
        </div>
      </>
    );
  } else if (!paper) {
    body = (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading this set…</span>
        {skeleton}
      </div>
    );
  } else {
    return <PaperRunnerClient paper={paper} />;
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
