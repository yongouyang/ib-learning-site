'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Shuffle, Target } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  buildMixedReviewQuestions,
  MIXED_REVIEW_TOPIC_ID,
  MIXED_REVIEW_SUBJECT_ID,
  MIXED_REVIEW_TITLE,
} from '@/lib/mixed-review';
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

  const { questions, usedWeakTopics, weakTopicCount } = useMemo(
    () => buildMixedReviewQuestions(topicProgress, mode, sessionSeed),
    [topicProgress, mode, sessionSeed]
  );

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
  const isFallback = mode === 'weak' && !usedWeakTopics;
  const description =
    mode === 'weak'
      ? usedWeakTopics
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
    </div>
  );
}
