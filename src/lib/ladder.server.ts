import { buildQuestionSet } from '@/lib/question-sets.server';
import { getLadderLevel } from '@/lib/ladder';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

/**
 * Composition for the revision ladder — SERVER-ONLY (Phase 1a,
 * docs/premium-content-protection-plan.md §4.4). The level definitions, `getLadderLevel` and
 * `isLevelUnlocked` stay in ladder.ts, which is client-safe.
 *
 * Deterministic per (course, level); non-calculator policy applies.
 */
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
