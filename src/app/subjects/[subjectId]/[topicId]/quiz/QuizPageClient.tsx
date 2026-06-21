'use client';

import { getTopic } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import type { SubjectId } from '@/content/types';

interface QuizPageClientProps {
  subjectId: string;
  topicId: string;
}

export default function QuizPageClient({ subjectId, topicId }: QuizPageClientProps) {
  const topic = getTopic(subjectId as SubjectId, topicId);
  const { recordAttempt } = useProgress();

  if (!topic) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Topic not found.</div>;

  return (
    <QuizGame
      questions={topic.questions}
      shuffleSeed={topicId}
      backHref={`/subjects/${subjectId}`}
      backLabel="Back to Topics"
      enableTimer={true}
      timerSeconds={60}
      onComplete={(correctCount, totalCount) => {
        recordAttempt(topicId, subjectId as SubjectId, topic.title, subjectId, correctCount, totalCount);
      }}
    />
  );
}
