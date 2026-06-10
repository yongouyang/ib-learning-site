import { UserProgress, TopicProgress, QuizAttempt, SubjectId } from '@/content/types';

const STORAGE_KEY = 'iblearn_progress';

interface StoredData {
  userProgress: UserProgress;
  topicProgress: Record<string, TopicProgress>;
}

function load(): StoredData {
  if (typeof window === 'undefined') {
    return { userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null }, topicProgress: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null }, topicProgress: {} };
}

function save(data: StoredData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getUserProgress(): UserProgress {
  return load().userProgress;
}

export function getTopicProgress(topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string): TopicProgress {
  const data = load();
  const key = `${subjectId}:${topicId}`;
  if (!data.topicProgress[key]) {
    data.topicProgress[key] = { topicId, subjectId, topicTitle, subjectTitle, attempts: [] };
  }
  return data.topicProgress[key];
}

export function getAllTopicProgress(): TopicProgress[] {
  return Object.values(load().topicProgress);
}

export function recordQuizAttempt(
  topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string,
  correctCount: number, totalCount: number
): void {
  const data = load();
  const key = `${subjectId}:${topicId}`;
  const tp = data.topicProgress[key] || { topicId, subjectId, topicTitle, subjectTitle, attempts: [] };

  const attempt: QuizAttempt = { date: new Date().toISOString(), correctCount, totalCount };
  tp.attempts.push(attempt);
  data.topicProgress[key] = tp;

  // Update user progress
  const up = data.userProgress;
  const scorePercent = correctCount / Math.max(totalCount, 1);
  up.totalStars += starsForScore(scorePercent);
  updateStreak(up);
  data.userProgress = up;

  save(data);
}

function updateStreak(up: UserProgress): void {
  const today = new Date().toISOString().split('T')[0];
  if (!up.lastStudyDate) {
    up.lastStudyDate = today;
    up.currentStreakDays = 1;
    return;
  }
  const lastDate = up.lastStudyDate.split('T')[0];
  if (lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (lastDate === yesterday) {
    up.currentStreakDays += 1;
  } else {
    up.currentStreakDays = 1;
  }
  up.lastStudyDate = today;
}

function starsForScore(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.7) return 2;
  if (score >= 0.4) return 1;
  return 0;
}

export function getRecentAverageScore(attempts: QuizAttempt[]): number {
  if (attempts.length === 0) return 0;
  const recent = attempts.slice(-5);
  const total = recent.reduce((sum, a) => sum + (a.correctCount / a.totalCount), 0);
  return total / recent.length;
}

export function getStarRating(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.7) return 2;
  if (score >= 0.4) return 1;
  return 0;
}
