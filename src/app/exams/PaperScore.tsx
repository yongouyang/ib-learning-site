'use client';

import { useProgress } from '@/context/ProgressContext';

// Best score for one exam (paper), loaded from localStorage after mount.
export default function PaperScore({ examId }: { examId: string }) {
  const { examResults } = useProgress();
  const attempts = examResults.filter((r) => r.examId === examId);
  if (attempts.length === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">Not attempted</span>;
  }
  const best = Math.max(...attempts.map((r) => r.correctCount / Math.max(r.totalCount, 1)));
  return (
    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
      Best: {Math.round(best * 100)}%
      <span className="font-normal text-gray-400 dark:text-gray-500"> · {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</span>
    </span>
  );
}
