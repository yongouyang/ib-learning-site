'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserProgress, TopicProgress, SubjectId } from '@/content/types';
import {
  getUserProgress,
  getAllTopicProgress,
  recordQuizAttempt,
  getRecentAverageScore,
} from '@/lib/progress-store';

interface ProgressContextType {
  userProgress: UserProgress;
  topicProgress: TopicProgress[];
  refresh: () => void;
  recordAttempt: (topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string, correct: number, total: number) => void;
  getSubjectScore: (subjectId: SubjectId) => number;
}

const ProgressContext = createContext<ProgressContextType | null>(null);

// Same defaults the server renders with (progress-store returns these when
// window is undefined) — state starts here so SSR and the first client render
// match, then real progress is loaded from localStorage after mount.
const SSR_DEFAULTS: UserProgress = { totalStars: 0, currentStreakDays: 0, lastStudyDate: null };

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [userProgress, setUserProgress] = useState<UserProgress>(SSR_DEFAULTS);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);

  const refresh = useCallback(() => {
    setUserProgress(getUserProgress());
    setTopicProgress(getAllTopicProgress());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordAttempt = useCallback((
    topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string,
    correct: number, total: number
  ) => {
    recordQuizAttempt(topicId, subjectId, topicTitle, subjectTitle, correct, total);
    refresh();
  }, [refresh]);

  const getSubjectScore = useCallback((subjectId: SubjectId): number => {
    const subjectProgress = topicProgress.filter(tp => tp.subjectId === subjectId && tp.attempts.length > 0);
    if (subjectProgress.length === 0) return 0;
    const total = subjectProgress.reduce((sum, tp) => sum + getRecentAverageScore(tp.attempts), 0);
    return total / subjectProgress.length;
  }, [topicProgress]);

  return (
    <ProgressContext.Provider value={{ userProgress, topicProgress, refresh, recordAttempt, getSubjectScore }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
