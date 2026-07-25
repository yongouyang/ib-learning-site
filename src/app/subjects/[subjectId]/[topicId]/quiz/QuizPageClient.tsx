'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSubject, getTopic } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import type { SubjectId } from '@/content/types';
import {
  DIFFICULTY_LEVELS,
  filterQuestionsByDifficulty,
  orderQuestionsByDifficulty,
  parseDifficultyFilter,
  type DifficultyFilter,
} from '@/lib/quiz-utils';

interface QuizPageClientProps {
  subjectId: string;
  topicId: string;
}

export default function QuizPageClient({ subjectId, topicId }: QuizPageClientProps) {
  const searchParams = useSearchParams();
  const difficulty = parseDifficultyFilter(searchParams.get('difficulty'));
  const topic = getTopic(subjectId as SubjectId, topicId);
  const subject = getSubject(subjectId as SubjectId);
  const { recordAttempt } = useProgress();

  if (!topic) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Topic not found.</div>;

  const filtered = filterQuestionsByDifficulty(topic.questions, difficulty);
  // Easy -> hard with a deterministic intra-band shuffle; QuizGame receives the
  // final order (no shuffleSeed), and keying on the filter forces a remount
  // when the user switches difficulty mid-visit.
  const ordered = orderQuestionsByDifficulty(filtered, `${topicId}:${difficulty}`);

  const filters: { key: DifficultyFilter; label: string }[] = [
    { key: 'all', label: `All (${topic.questions.length})` },
    ...DIFFICULTY_LEVELS.map((level) => ({
      key: level as DifficultyFilter,
      label: `${level[0].toUpperCase()}${level.slice(1)} (${
        topic.questions.filter((q) => (q.difficulty ?? 'medium') === level).length
      })`,
    })),
  ];

  const quizHref = (key: DifficultyFilter) =>
    key === 'all'
      ? `/subjects/${subjectId}/${topicId}/quiz`
      : `/subjects/${subjectId}/${topicId}/quiz?difficulty=${key}`;

  return (
    <div>
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex gap-2" role="group" aria-label="Filter by difficulty">
          {filters.map((f) => {
            const active = difficulty === f.key;
            return (
              <Link
                key={f.key}
                href={quizHref(f.key)}
                aria-pressed={active}
                className={`flex-1 inline-flex items-center justify-center py-2 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>
      <QuizGame
        key={difficulty}
        questions={ordered}
        backHref={`/subjects/${subjectId}`}
        backLabel="Back to Topics"
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: `/subjects/${subjectId}`, label: subject?.name ?? subjectId },
          { href: `/subjects/${subjectId}/${topicId}/study`, label: topic.title },
          { label: 'Quiz' },
        ]}
        enableTimer={true}
        timerSeconds={60}
        onComplete={(correctCount, totalCount) => {
          recordAttempt(topicId, subjectId as SubjectId, topic.title, subjectId, correctCount, totalCount);
        }}
      />
    </div>
  );
}
