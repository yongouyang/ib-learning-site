'use client';

import { useParams } from 'next/navigation';
import { getTopic } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import type { SubjectId } from '@/content/types';

export default function QuizPage() {
  const params = useParams();
  const subjectId = params.subjectId as SubjectId;
  const topicId = params.topicId as string;
  const topic = getTopic(subjectId, topicId);
  const { recordAttempt } = useProgress();

  if (!topic) return <div className="p-6 text-center text-gray-500">Topic not found.</div>;

  return (
    <QuizGame
      questions={topic.questions}
      backHref={`/subjects/${subjectId}`}
      backLabel="Back to Topics"
      enableTimer={true}
      timerSeconds={60}
      onComplete={(correctCount, totalCount) => {
        recordAttempt(topicId, subjectId, topic.title, subjectId, correctCount, totalCount);
      }}
    />
  );
}
