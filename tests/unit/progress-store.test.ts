import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserProgress,
  getAllTopicProgress,
  recordQuizAttempt,
  getRecentAverageScore,
  getStarRating,
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
});
