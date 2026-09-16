'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Shuffle, Target } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  MIXED_REVIEW_TOPIC_ID,
  MIXED_REVIEW_SUBJECT_ID,
  MIXED_REVIEW_TITLE,
  type MixedReviewQuestion,
} from '@/lib/mixed-review';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import { randomSeed } from '@/lib/quiz-utils';
import { trackEvent } from '@/lib/analytics';

export default function MixedReviewClient() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'weak' ? 'weak' : 'random';
  const { topicProgress, recordAttempt, loaded } = useProgress();

  // Draw seed: deterministic during SSR/first render (hydration-safe — an
  // unseeded Math.random sample made the prerendered question and the hydrated
  // one disagree, which throws the whole tree away), then reseeded from an
  // effect so each visit still draws a fresh mix. Same shape as the topic quiz
  // (QuizPageClient); the key on QuizGame below is what swaps in the new set.
  const [sessionSeed, setSessionSeed] = useState(mode);
  // A mode switch is a deliberate new session; progress arriving is not, so it
  // must never clobber answers already given (touchedRef).
  const touchedRef = useRef(false);
  useEffect(() => {
    setSessionSeed(`${mode}:${randomSeed()}`);
  }, [mode]);
  // Progress is localStorage/server-merged, so the first draw above sees none of
  // it — re-draw once it lands, or "weak areas" would silently mix in everything.
  useEffect(() => {
    if (!loaded || touchedRef.current) return;
    setSessionSeed(`${mode}:${randomSeed()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // The draw happens on the SERVER (Phase 1b, docs/premium-content-protection-plan.md §1.1 decision
  // 8): mixed review is the one free surface whose input cannot be known at build time, so it is the
  // one runtime API for free content. The client sends the ids of its own weak topics (or none for
  // all topics) plus the session seed, and the response is edge-cacheable because it is free content.
  // This is also why the first paint is a loading state rather than a question: nothing is drawn
  // during render, so the prerendered HTML and the first client paint always agree.
  const weakTopics = mode === 'weak' ? getWeakTopics(topicProgress) : [];
  const weakTopicCount = weakTopics.length;
  const usedWeakTopics = mode === 'weak' && weakTopicCount > 0;
  // The effect keys off a STRING, not the array: `topicProgress` can be a fresh reference on every
  // render (any provider that rebuilds it would otherwise re-fetch in a loop), and a value-compared
  // key makes that impossible. Bounded here; the server re-validates count and charset.
  const weakIdsKey = weakTopics
    .slice(0, 40)
    .map((t) => t.topicId)
    .join(',');

  const [questions, setQuestions] = useState<MixedReviewQuestion[]>([]);
  const [drawFailed, setDrawFailed] = useState(false);
  // True only when the weak-topic request was refused and the retry from all topics is what rendered.
  const [weakDrawFellBack, setWeakDrawFellBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Seeds and ids are charset-restricted ([A-Za-z0-9_:.-] and [A-Za-z0-9_-]) and go in the PATH
    // unencoded on purpose — `encodeURIComponent` would turn the seed's colon into %3A, which the
    // server's validator rejects. The path (not a query string) is also what makes the edge cache key
    // cover every input that changes the response.
    const drawPath = (ids: string) => `/api/content/public/mixed-review/${sessionSeed}${ids}`;
    const ids = usedWeakTopics ? `/${weakIdsKey}` : '';

    const load = async (path: string): Promise<MixedReviewQuestion[]> => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { questions: MixedReviewQuestion[] };
      if (body.questions.length === 0) throw new Error('empty');
      return body.questions;
    };

    load(drawPath(ids))
      .then((drawn) => {
        if (cancelled) return;
        setDrawFailed(false);
        setWeakDrawFellBack(false);
        setQuestions(drawn);
      })
      .catch(async () => {
        // Weak mode sends up to 40 ids from LOCAL progress, so a stale id list (progress from an older
        // content revision) empties the pool server-side and 404s. Retrying the SAME ids on reload —
        // which is what the old copy told the user to do — could never work, so fall back to all
        // topics once and say so.
        if (!usedWeakTopics) {
          if (!cancelled) {
            setQuestions([]);
            setDrawFailed(true);
          }
          return;
        }
        try {
          const drawn = await load(drawPath(''));
          if (cancelled) return;
          setDrawFailed(false);
          setWeakDrawFellBack(true);
          setQuestions(drawn);
        } catch {
          if (cancelled) return;
          setQuestions([]);
          setDrawFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionSeed, usedWeakTopics, weakIdsKey]);

  const draw = questions.length > 0 ? { questions } : null;

  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
    trackEvent('quiz_started', {
      subjectId: MIXED_REVIEW_SUBJECT_ID,
      topicId: MIXED_REVIEW_TOPIC_ID,
      source: 'mixed_review',
    });
  }, [mode]);

  const handleComplete = (correctCount: number, totalCount: number) => {
    recordAttempt(
      MIXED_REVIEW_TOPIC_ID,
      MIXED_REVIEW_SUBJECT_ID,
      MIXED_REVIEW_TITLE,
      MIXED_REVIEW_SUBJECT_ID,
      correctCount,
      totalCount
    );
    trackEvent('quiz_completed', {
      subjectId: MIXED_REVIEW_SUBJECT_ID,
      topicId: MIXED_REVIEW_TOPIC_ID,
      correctCount,
      totalCount,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
  };

  const modes = [
    { key: 'weak', href: '/mixed-review?mode=weak', label: 'Weak areas', icon: Target },
    { key: 'random', href: '/mixed-review', label: 'All topics', icon: Shuffle },
  ];

  // What the two modes actually do, stated plainly so the difference is visible
  // while practising (not just on the results screen).
  // Both fallbacks are now reachable and distinct: no weak topics yet, and (after the retry) a weak
  // draw the server could not build. `weakTopicCount > 0` alone used to make the second arm dead code.
  const isFallback = mode === 'weak' && (!usedWeakTopics || weakDrawFellBack);
  const description =
    mode === 'weak'
      ? usedWeakTopics && !weakDrawFellBack
        ? `Focused on your weak areas — questions from the ${weakTopicCount} topic${weakTopicCount !== 1 ? 's' : ''} you scored below 70% on.`
        : weakTopicCount === 0
          ? 'No weak areas found yet — questions are drawn from all topics instead.'
          : 'Could not build a weak-area review — questions are drawn from all topics instead.'
      : 'A random mix of easy, medium and hard questions from all topics.';

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Mixed Review' }]} currentAsHeading />

      <div className="flex gap-2 mb-3" role="group" aria-label="Review mode">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <Link
              key={m.key}
              href={m.href}
              aria-pressed={active}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {m.label}
            </Link>
          );
        })}
      </div>

      <p
        className={`mb-4 text-sm ${
          isFallback
            ? 'card p-3 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900 text-yellow-800 dark:text-yellow-300'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {description}
      </p>

      {!draw ? (
        <p
          className="card p-6 text-center text-gray-500 dark:text-gray-400"
          role="status"
          aria-busy={!drawFailed}
        >
          {drawFailed
            ? mode === 'weak'
              ? 'Could not load mixed review — switch to All topics, or reload to try again.'
              : 'Could not load mixed review — reload the page to try again.'
            : 'Loading mixed review…'}
        </p>
      ) : (
      <QuizGame
        key={sessionSeed}
        subtitle={mode === 'weak' && usedWeakTopics ? 'Focused on your weak areas' : 'Questions from all topics'}
        backHref="/progress"
        backLabel="Back to Progress"
        questions={questions.map((q) => q.question)}
        shuffleSeed={questions.map((q) => q.question.id).join(',')}
        onQuestionResult={() => { touchedRef.current = true; }}
        enableTimer={false}
        onComplete={handleComplete}
      />
      )}
    </div>
  );
}
