import { describe, it, expect } from 'vitest';
import {
  LADDER_LEVELS,
  LADDER_LENGTH,
  LADDER_UNLOCK_SCORE,
  buildLadderQuestions,
  getLadderLevel,
  isLevelUnlocked,
} from '@/lib/ladder';

describe('ladder definitions', () => {
  it('has 5 levels, each summing to the ladder length', () => {
    expect(LADDER_LEVELS).toHaveLength(5);
    for (const level of LADDER_LEVELS) {
      const total = level.targets.easy + level.targets.medium + level.targets.hard;
      expect(total).toBe(LADDER_LENGTH);
    }
  });

  it('ramps difficulty monotonically (hard count never decreases)', () => {
    for (let i = 1; i < LADDER_LEVELS.length; i++) {
      expect(LADDER_LEVELS[i].targets.hard).toBeGreaterThanOrEqual(LADDER_LEVELS[i - 1].targets.hard);
    }
    expect(LADDER_LEVELS[4].targets.hard).toBeGreaterThan(LADDER_LEVELS[0].targets.hard);
  });
});

describe('isLevelUnlocked', () => {
  it('level 1 is always unlocked', () => {
    expect(isLevelUnlocked({}, 'math-y7', 1)).toBe(true);
  });

  it('level N+1 requires the unlock score on level N', () => {
    const progress = { 'math-y7': { 1: { bestScore: LADDER_UNLOCK_SCORE, completedAt: 'x' } } };
    expect(isLevelUnlocked(progress, 'math-y7', 2)).toBe(true);

    const below = { 'math-y7': { 1: { bestScore: LADDER_UNLOCK_SCORE - 0.1, completedAt: 'x' } } };
    expect(isLevelUnlocked(below, 'math-y7', 2)).toBe(false);
  });

  it('higher levels need the immediately previous level', () => {
    const progress = { 'math-y7': { 1: { bestScore: 1, completedAt: 'x' } } };
    expect(isLevelUnlocked(progress, 'math-y7', 3)).toBe(false); // level 2 not done
  });
});

describe('buildLadderQuestions', () => {
  it('builds a deterministic non-calculator set of ladder length', () => {
    const a = buildLadderQuestions('chem-ks3', 3);
    expect(a).toHaveLength(LADDER_LENGTH);
    expect(a.every((q) => !q.question.calculator)).toBe(true);
    const b = buildLadderQuestions('chem-ks3', 3);
    expect(a.map((q) => q.question.id)).toEqual(b.map((q) => q.question.id));
  });

  it('hits the band targets per level', () => {
    const set = buildLadderQuestions('phys-ks3', 5);
    const count = (d: string) => set.filter((q) => (q.question.difficulty ?? 'medium') === d).length;
    expect(count('easy')).toBe(1);
    expect(count('medium')).toBe(3);
    expect(count('hard')).toBe(6);
  });

  it('different levels produce different sets', () => {
    const l1 = buildLadderQuestions('math-y7', 1).map((q) => q.question.id);
    const l5 = buildLadderQuestions('math-y7', 5).map((q) => q.question.id);
    expect(l1).not.toEqual(l5);
  });

  it('returns an empty set for an unknown level', () => {
    expect(buildLadderQuestions('math-y7', 9)).toEqual([]);
    expect(getLadderLevel(9)).toBeUndefined();
  });
});
