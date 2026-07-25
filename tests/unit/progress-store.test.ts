import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserProgress,
  getAllTopicProgress,
  recordQuizAttempt,
  getRecentAverageScore,
  getStarRating,
  recordExamResult,
  getExamResults,
  recordLadderResult,
  getLadderProgress,
} from '@/lib/progress-store';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
});

describe('progress-store', () => {
  it('should start with empty progress', () => {
    const up = getUserProgress();
    expect(up.totalStars).toBe(0);
    expect(up.currentStreakDays).toBe(0);
    expect(up.lastStudyDate).toBeNull();
    expect(getAllTopicProgress()).toEqual([]);
  });

  it('should record a quiz attempt and update stars', () => {
    recordQuizAttempt('math-algebra-1', 'math', 'Algebra Basics', 'Math', 8, 10);
    const up = getUserProgress();
    expect(up.totalStars).toBe(2); // 80% → 2 stars
    expect(up.currentStreakDays).toBe(1);
    const all = getAllTopicProgress();
    expect(all).toHaveLength(1);
    expect(all[0].attempts).toHaveLength(1);
    expect(all[0].attempts[0].correctCount).toBe(8);
  });

  it('should calculate recent average score', () => {
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 5, 10);
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 9, 10);
    const all = getAllTopicProgress();
    const avg = getRecentAverageScore(all[0].attempts);
    expect(avg).toBe(0.7); // (0.5 + 0.9) / 2 = 0.7
  });

  it('should return correct star ratings', () => {
    expect(getStarRating(0.95)).toBe(3);
    expect(getStarRating(0.75)).toBe(2);
    expect(getStarRating(0.45)).toBe(1);
    expect(getStarRating(0.35)).toBe(0);
    expect(getStarRating(0)).toBe(0);
  });

  it('should update streak correctly', () => {
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 5, 10);
    expect(getUserProgress().currentStreakDays).toBe(1);
    recordQuizAttempt('t2', 'math', 'Test 2', 'Math', 5, 10);
    // Same day, streak stays at 1
    expect(getUserProgress().currentStreakDays).toBe(1);
  });

  it('should load legacy payloads without the new fields (additive defaults)', () => {
    // Legacy shape: no version, no examResults, no ladderProgress.
    store['iblearn_progress'] = JSON.stringify({
      userProgress: { totalStars: 5, currentStreakDays: 2, lastStudyDate: '2026-07-01' },
      topicProgress: {},
    });
    expect(getExamResults()).toEqual([]);
    expect(getLadderProgress()).toEqual({});
    expect(getUserProgress().totalStars).toBe(5);
    // Saving stamps the version without losing data.
    recordExamResult({ examId: 'math-y7:paper-1', date: new Date().toISOString(), correctCount: 10, totalCount: 20, secondsUsed: 600 });
    const raw = JSON.parse(store['iblearn_progress']);
    expect(raw.version).toBe(1);
    expect(raw.userProgress.totalStars).toBe(6); // 5 + 1 star for 50%
    expect(raw.examResults).toHaveLength(1);
  });

  it('should record exam results with rewards, without touching topicProgress', () => {
    recordExamResult({ examId: 'math-y7:paper-1', date: new Date().toISOString(), correctCount: 18, totalCount: 20, secondsUsed: 1200 });
    const results = getExamResults();
    expect(results).toHaveLength(1);
    expect(results[0].correctCount).toBe(18);
    expect(getUserProgress().totalStars).toBe(3); // 90% → 3 stars
    expect(getUserProgress().currentStreakDays).toBe(1);
    expect(getAllTopicProgress()).toEqual([]); // no weak-area pollution
  });

  it('should keep the best ladder score per level', () => {
    recordLadderResult('math-y7', 1, 0.5);
    recordLadderResult('math-y7', 1, 0.8);
    recordLadderResult('math-y7', 2, 0.6);
    const progress = getLadderProgress();
    expect(progress['math-y7'][1].bestScore).toBe(0.8);
    expect(progress['math-y7'][2].bestScore).toBe(0.6);
    expect(progress['math-y7'][1].completedAt).toBeTruthy();
  });
});
