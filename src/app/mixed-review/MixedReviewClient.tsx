'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {mode === 'weak' && !usedWeakTopics && (
        <div className="card p-3 mb-4 bg-yellow-50 border-yellow-200 text-sm text-yellow-800">
          {weakTopicCount === 0
            ? 'No weak areas found yet. Practising random questions instead.'
            : 'Could not build a weak-area review. Practising random questions instead.'}
        </div>
      )}

      <QuizGame
        subtitle={mode === 'weak' && usedWeakTopics ? 'Focused on your weak areas' : 'Questions from all topics'}
        backHref="/progress"
        questions={questions.map((q) => q.question)}
        enableTimer={false}
        onComplete={handleComplete}
      />
    </div>
  );
}
