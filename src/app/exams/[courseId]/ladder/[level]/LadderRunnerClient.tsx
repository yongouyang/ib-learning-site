'use client';

import { useMemo, useRef } from 'react';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import { getCourse } from '@/lib/courses';
import { buildLadderQuestions, getLadderLevel, isLevelUnlocked, LADDER_UNLOCK_SCORE } from '@/lib/ladder';

interface LadderRunnerClientProps {
  courseId: string;
  level: number;
}

export default function LadderRunnerClient({ courseId, level }: LadderRunnerClientProps) {
  const course = getCourse(courseId);
  const levelDef = getLadderLevel(level);
  const { ladderProgress, recordLadder } = useProgress();

  // Deterministic build (seeded by course+level) — safe to compute during SSR.
  const questions = useMemo(() => buildLadderQuestions(courseId, level), [courseId, level]);
  const recorded = useRef(false);

  const handleComplete = (correctCount: number, totalCount: number) => {
    if (recorded.current) return;
    recorded.current = true;
    recordLadder(courseId, level, correctCount / Math.max(totalCount, 1));
  };

  if (!course || !levelDef || questions.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Ladder level not found.</div>;
  }

  if (!isLevelUnlocked(ladderProgress, courseId, level)) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          This level is locked — score {Math.round(LADDER_UNLOCK_SCORE * 100)}% or more on Level {level - 1} to unlock it.
        </p>
      </div>
    );
  }

  return (
    <QuizGame
      subtitle={`${course.title} · ${levelDef.title} · Non-calculator`}
      backHref={`/exams/${courseId}/ladder`}
      backLabel="Back to Ladder"
      breadcrumbs={[
        { href: '/', label: 'Home' },
        { href: '/exams', label: 'Mock Exams' },
        { href: `/exams/${courseId}/ladder`, label: `${course.title} Ladder` },
        { label: `Level ${level}` },
      ]}
      questions={questions.map((q) => q.question)}
      shuffleSeed={`ladder:${courseId}:${level}`}
      enableTimer={false}
      onComplete={handleComplete}
    />
  );
}
