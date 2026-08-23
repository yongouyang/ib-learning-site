import { describe, it, expect } from 'vitest';
import {
  XP_QUIZ_PER_CORRECT,
  XP_QUIZ_PERFECT_BONUS,
  XP_EXAM_PER_CORRECT,
  XP_EXAM_PERFECT_BONUS,
  XP_LADDER_PER_LEVEL,
  XP_FLASHCARD_PER_NEWLY_KNOWN,
  applyDailyCap,
  rawXp,
  repeatMultiplier,
  scoreEvent,
} from '@/lib/leaderboard/xp';
import { LEADERBOARD_DAILY_XP_CAP } from '@/lib/leaderboard/types';

// XP tables locked in docs/leaderboard-plan.md §12 Q1; caps/diminishing
// repeats in §4.1.

describe('XP constants (plan §4.1)', () => {
  it('pins the locked tables', () => {
    expect(XP_QUIZ_PER_CORRECT).toBe(10);
    expect(XP_QUIZ_PERFECT_BONUS).toBe(20);
    expect(XP_EXAM_PER_CORRECT).toBe(20);
    expect(XP_EXAM_PERFECT_BONUS).toBe(40);
    expect(XP_LADDER_PER_LEVEL).toBe(30);
    expect(XP_FLASHCARD_PER_NEWLY_KNOWN).toBe(2);
  });
});

describe('repeatMultiplier (diminishing repeats)', () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 0.5],
    [4, 0.5],
    [5, 0.5],
    [6, 0],
    [10, 0],
  ])('attempt %i multiplies by %s', (ordinal, expected) => {
    expect(repeatMultiplier(ordinal)).toBe(expected);
  });
});

describe('rawXp', () => {
  it('scores quiz attempts at 10 × correctCount', () => {
    expect(rawXp({ kind: 'quiz', correctCount: 8, totalCount: 10, topicAttemptOrdinal: 1 })).toBe(80);
    expect(rawXp({ kind: 'quiz', correctCount: 0, totalCount: 10, topicAttemptOrdinal: 1 })).toBe(0);
  });

  it('adds the perfection bonus only for a genuine 100%', () => {
    expect(rawXp({ kind: 'quiz', correctCount: 10, totalCount: 10, topicAttemptOrdinal: 1 })).toBe(120);
    expect(rawXp({ kind: 'quiz', correctCount: 0, totalCount: 0, topicAttemptOrdinal: 1 })).toBe(0); // 0/0 is not perfect
    expect(rawXp({ kind: 'exam', correctCount: 20, totalCount: 20 })).toBe(20 * 20 + 40);
  });

  it('halves quiz XP from the 3rd repeat and zeroes it from the 6th', () => {
    const attempt = (ordinal: number) =>
      rawXp({ kind: 'quiz', correctCount: 10, totalCount: 10, topicAttemptOrdinal: ordinal });
    expect(attempt(1)).toBe(120);
    expect(attempt(2)).toBe(120);
    expect(attempt(3)).toBe(60); // (100 + 20) × 0.5 — the bonus is discounted too
    expect(attempt(5)).toBe(60);
    expect(attempt(6)).toBe(0);
  });

  it('keeps half-XP integers (odd correct counts)', () => {
    expect(rawXp({ kind: 'quiz', correctCount: 3, totalCount: 10, topicAttemptOrdinal: 4 })).toBe(15);
  });

  it('scores exams at 20 × correctCount with no repeat discount', () => {
    expect(rawXp({ kind: 'exam', correctCount: 15, totalCount: 20 })).toBe(300);
  });

  it('scores ladder passes at 30 × level', () => {
    expect(rawXp({ kind: 'ladder', level: 1 })).toBe(30);
    expect(rawXp({ kind: 'ladder', level: 5 })).toBe(150);
  });

  it('scores flashcards at 2 per newly-known card', () => {
    expect(rawXp({ kind: 'flashcard', newlyKnown: 5 })).toBe(10);
    expect(rawXp({ kind: 'flashcard', newlyKnown: 0 })).toBe(0);
  });
});

describe('applyDailyCap', () => {
  it('awards in full below the cap', () => {
    expect(applyDailyCap(80, 0)).toBe(80);
    expect(applyDailyCap(100, 400)).toBe(100);
  });

  it('clamps at the cap and zeroes beyond it', () => {
    expect(applyDailyCap(150, 400)).toBe(100);
    expect(applyDailyCap(50, LEADERBOARD_DAILY_XP_CAP)).toBe(0);
    expect(applyDailyCap(50, LEADERBOARD_DAILY_XP_CAP + 200)).toBe(0);
  });

  it('never returns a negative award', () => {
    expect(applyDailyCap(0, 0)).toBe(0);
  });
});

describe('scoreEvent', () => {
  it('combines raw XP with the daily cap', () => {
    expect(scoreEvent({ kind: 'quiz', correctCount: 8, totalCount: 10, topicAttemptOrdinal: 1 }, 490)).toBe(10);
    expect(scoreEvent({ kind: 'ladder', level: 2 }, 0)).toBe(60);
    expect(scoreEvent({ kind: 'exam', correctCount: 20, totalCount: 20 }, 480)).toBe(20);
  });
});
