import { LEADERBOARD_DAILY_XP_CAP } from './types';

// Phase D — XP scoring (docs/leaderboard-plan.md §4.1). PURE and unit-tested.
// XP is awarded server-side only, for accepted (non-replayed) sync writes —
// the applied/replay plumbing that feeds these inputs is D4; this module is
// just the math.
//
// Tables (locked in plan §12 Q1):
//   quiz attempt        10 × correctCount   (+ 20 bonus if 100%)
//   exam/paper attempt  20 × correctCount   (+ 40 bonus if 100%)
//   ladder level pass   30 × level
//   flashcard "known"    2 per newly-known card
// No diagnostic line (no diagnostic sync event exists — plan §4.1).

export const XP_QUIZ_PER_CORRECT = 10;
export const XP_QUIZ_PERFECT_BONUS = 20;
export const XP_EXAM_PER_CORRECT = 20;
export const XP_EXAM_PERFECT_BONUS = 40;
export const XP_LADDER_PER_LEVEL = 30;
export const XP_FLASHCARD_PER_NEWLY_KNOWN = 2;

/**
 * Diminishing repeats (plan §4.1): re-attempting the SAME topic quiz in the
 * same week earns half XP from the 3rd attempt and zero from the 6th —
 * mastery, not grinding. `ordinal` is the 1-based attempt number returned by
 * the conditional increment on the xp-topic bucket.
 */
export function repeatMultiplier(ordinal: number): number {
  if (ordinal <= 2) return 1;
  if (ordinal <= 5) return 0.5;
  return 0;
}

/**
 * One XP-earning unit, already reduced by the caller from an accepted sync
 * event:
 * - quiz:    correctCount/totalCount from the attempt + its weekly ordinal
 * - exam:    correctCount/totalCount (exams are not repeat-discounted — a
 *            paper set is 20 marks of distinct work)
 * - ladder:  only reached when updateLadderLevel reported an IMPROVEMENT
 * - flashcard: `newlyKnown` counts only not-known → known transitions
 *            (the putFlashcard ALL_OLD signal)
 */
export type XpEventInput =
  | { kind: 'quiz'; correctCount: number; totalCount: number; topicAttemptOrdinal: number }
  | { kind: 'exam'; correctCount: number; totalCount: number }
  | { kind: 'ladder'; level: number }
  | { kind: 'flashcard'; newlyKnown: number };

/** Raw XP before the daily cap. Always an integer ≥ 0. */
export function rawXp(input: XpEventInput): number {
  switch (input.kind) {
    case 'quiz': {
      const base =
        XP_QUIZ_PER_CORRECT * input.correctCount +
        (isPerfect(input.correctCount, input.totalCount) ? XP_QUIZ_PERFECT_BONUS : 0);
      return Math.floor(base * repeatMultiplier(input.topicAttemptOrdinal));
    }
    case 'exam':
      return (
        XP_EXAM_PER_CORRECT * input.correctCount +
        (isPerfect(input.correctCount, input.totalCount) ? XP_EXAM_PERFECT_BONUS : 0)
      );
    case 'ladder':
      return XP_LADDER_PER_LEVEL * input.level;
    case 'flashcard':
      return XP_FLASHCARD_PER_NEWLY_KNOWN * input.newlyKnown;
  }
}

function isPerfect(correctCount: number, totalCount: number): boolean {
  return totalCount > 0 && correctCount === totalCount;
}

/**
 * Daily soft cap (plan §4.1): work beyond LEADERBOARD_DAILY_XP_CAP per profile
 * per UTC day still records progress but earns no leaderboard XP. Returns how
 * much of `xp` is still awardable given what the profile already earned today.
 */
export function applyDailyCap(xp: number, dayXpSoFar: number): number {
  return Math.max(0, Math.min(xp, LEADERBOARD_DAILY_XP_CAP - dayXpSoFar));
}

/** Full scoring for one accepted event: raw XP clamped by the daily cap. */
export function scoreEvent(input: XpEventInput, dayXpSoFar: number): number {
  return applyDailyCap(rawXp(input), dayXpSoFar);
}
