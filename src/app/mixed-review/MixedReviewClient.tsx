'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Shuffle, Target } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import {
  buildMixedReviewQuestions,
  MIXED_REVIEW_TOPIC_ID,
  MIXED_REVIEW_SUBJECT_ID,
  MIXED_REVIEW_TITLE,
} from '@/lib/mixed-review';

export default function MixedReviewClient() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'weak' ? 'weak' : 'random';
  const { topicProgress, recordAttempt } = useProgress();

  const { questions, usedWeakTopics, weakTopicCount } = useMemo(
    () => buildMixedReviewQuestions(topicProgress, mode),
    [topicProgress, mode]
  );

  const handleComplete = (correctCount: number, totalCount: number) => {
    recordAttempt(
      MIXED_REVIEW_TOPIC_ID,
      MIXED_REVIEW_SUBJECT_ID,
      MIXED_REVIEW_TITLE,
      MIXED_REVIEW_SUBJECT_ID,
      correctCount,
      totalCount
    );
  };

  const modes = [
    { key: 'weak', href: '/mixed-review?mode=weak', label: 'Weak areas', icon: Target },
    { key: 'random', href: '/mixed-review', label: 'All topics', icon: Shuffle },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex gap-2 mb-4" role="group" aria-label="Review mode">
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

      {mode === 'weak' && !usedWeakTopics && (
        <div className="card p-3 mb-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900 text-sm text-yellow-800 dark:text-yellow-300">
          {weakTopicCount === 0
            ? 'No weak areas found yet. Practising random questions instead.'
            : 'Could not build a weak-area review. Practising random questions instead.'}
        </div>
      )}

      <QuizGame
        subtitle={mode === 'weak' && usedWeakTopics ? 'Focused on your weak areas' : 'Questions from all topics'}
        backHref="/progress"
        backLabel="Back to Progress"
        breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'Mixed Review' }]}
        questions={questions.map((q) => q.question)}
        shuffleSeed={questions.map((q) => q.question.id).join(',')}
        enableTimer={false}
        onComplete={handleComplete}
      />
    </div>
  );
}
