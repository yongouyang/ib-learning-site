'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { LockedFeature } from '@/components/LockedFeature';
import { useEntitlements } from '@/context/EntitlementsContext';
import type { Paper, PaperMeta } from '@/content/types';
import PaperRunnerClient from './PaperRunnerClient';

/**
 * Phase 1b (docs/premium-content-protection-plan.md §4.2) — the premium paper sets are no longer in
 * the build, so this shell fetches them from the gated content API once the session's entitlements
 * resolve. Three states, in this order on purpose:
 *
 *  1. entitlements unresolved → a NEUTRAL skeleton, never the lock. A gate that flashes over content
 *     the user may be entitled to is the no-flash rule (UX_GUIDELINES + LockedFeature).
 *  2. not entitled → the same premium tease as before, wrapping a static preview built from PUBLIC
 *     METADATA (title, marks, duration). No request is made in this state at all.
 *  3. entitled → one GET to /api/content/premium/papers/<courseId>/<setId>; 401 → login prompt,
 *     403 → the tease (a stale client tier), anything else → an error line with a retry affordance.
 *
 * 401/403 are both "you cannot read this": the server is the gate, this component is the UX.
 */
export default function PremiumPaperShell({
  courseId,
  setId,
  meta,
}: {
  courseId: string;
  setId: string;
  meta: PaperMeta;
}) {
  const { has, loaded } = useEntitlements();
  const entitled = loaded && has('exam-sets-full');
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

  // 1. Neutral skeleton while entitlements resolve — no lock, no request.
  if (!loaded) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6" aria-busy="true">
        <div className="card p-5 animate-pulse">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-3 h-3 w-56 rounded bg-gray-100 dark:bg-gray-800/60" />
        </div>
      </div>
    );
  }

  // 2a. The SERVER said not_entitled while this client believed otherwise (a stale tier). LockedFeature
  // cannot express this state — it re-reads the same client entitlements and would render the paper
  // unlocked — so the honest answer is said plainly: your plan does not include this set.
  if (failure === 'not_entitled') {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div aria-hidden="true" className="pointer-events-none select-none opacity-40">
          {preview}
        </div>
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
      </div>
    );
  }

  // 2b. Not entitled (the client already knows): the same tease as before, over public metadata.
  if (!entitled) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <LockedFeature
          feature="exam-sets-full"
          title="Full exam sets"
          benefit="Set 1 is free — Premium unlocks every set for this course, upper ladder levels and timed mock mode."
        >
          {preview}
        </LockedFeature>
      </div>
    );
  }

  if (failure === 'login') {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card p-5 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Sign in to open this set</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Premium sets are served to your account, so we need to know who you are.
          </p>
          <a
            href="/login"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (failure === 'error') {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card p-5 text-center">
          <p className="font-bold text-gray-900 dark:text-gray-50">Could not load this set</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Check your connection and reload the page — your plan is unaffected.
          </p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6" aria-busy="true">
        <div className="card p-5 animate-pulse">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-3 h-3 w-56 rounded bg-gray-100 dark:bg-gray-800/60" />
        </div>
      </div>
    );
  }

  return <PaperRunnerClient paper={paper} />;
}
