import { buildQuestionSet } from '@/lib/question-sets';
import type { Difficulty, LadderLevelResult } from '@/content/types';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

// Revision Ladder (Phase 3): 5 cross-topic sets of increasing difficulty per
// course. Level N+1 unlocks when level N is completed at >= LADDER_UNLOCK_SCORE.
export const LADDER_LENGTH = 10;
export const LADDER_UNLOCK_SCORE = 0.6;

export interface LadderLevel {
  level: number;
  title: string;
  targets: Record<Difficulty, number>;
}

export const LADDER_LEVELS: LadderLevel[] = [
  { level: 1, title: 'Level 1 — Warm-up', targets: { easy: 6, medium: 3, hard: 1 } },
  { level: 2, title: 'Level 2 — Getting going', targets: { easy: 4, medium: 4, hard: 2 } },
  { level: 3, title: 'Level 3 — Steady', targets: { easy: 3, medium: 4, hard: 3 } },
  { level: 4, title: 'Level 4 — Stretch', targets: { easy: 2, medium: 4, hard: 4 } },
  { level: 5, title: 'Level 5 — Challenge', targets: { easy: 1, medium: 3, hard: 6 } },
];

export function getLadderLevel(level: number): LadderLevel | undefined {
  return LADDER_LEVELS.find((l) => l.level === level);
}

export function isLevelUnlocked(
  ladderProgress: Record<string, Record<number, LadderLevelResult>>,
  courseId: string,
  level: number
): boolean {
  if (level <= 1) return true;
  const previous = ladderProgress[courseId]?.[level - 1];
  return (previous?.bestScore ?? 0) >= LADDER_UNLOCK_SCORE;
}

// Deterministic per (course, level); non-calculator policy applies.
export function buildLadderQuestions(courseId: string, level: number): MixedReviewQuestion[] {
  const def = getLadderLevel(level);
  if (!def) return [];
  return buildQuestionSet({
    courseId,
    targets: { ...def.targets },
    seed: `ladder:${courseId}:${level}`,
    excludeCalculator: true,
  });
}
