import { describe, it, expect } from 'vitest';
import {
  FREE_PAPER_SETS_PER_COURSE,
  FREE_LADDER_LEVELS,
  paperSetNumber,
  isFreePaperSet,
  isFreeLadderLevel,
  splitPaperSetsByAccess,
} from '@/lib/entitlements/exam-access';
import { LADDER_LEVELS } from '@/lib/ladder';

// Phase E3 — the free/premium split for the practice-exam tier
// (docs/entitlement-policy.md §Tier 2).

describe('paperSetNumber', () => {
  it('parses the -set-<n> suffix', () => {
    expect(paperSetNumber('math-y7-set-1')).toBe(1);
    expect(paperSetNumber('math-y7-set-2')).toBe(2);
    expect(paperSetNumber('math-dp-ai-set-10')).toBe(10);
  });

  it('treats ids without a set suffix as set 1 (fail-free)', () => {
    expect(paperSetNumber('math-y7')).toBe(1);
  });
});

describe('isFreePaperSet', () => {
  it('makes exactly the first set per course free', () => {
    expect(isFreePaperSet('math-y7-set-1')).toBe(true);
    expect(isFreePaperSet('bio-ks3-set-1')).toBe(true);
    expect(isFreePaperSet('math-y7-set-2')).toBe(false);
    expect(isFreePaperSet('math-y7-set-5')).toBe(false);
  });

  it('matches the FREE_PAPER_SETS_PER_COURSE constant', () => {
    expect(FREE_PAPER_SETS_PER_COURSE).toBe(1);
  });
});

describe('isFreeLadderLevel', () => {
  it('keeps levels 1–2 free and gates the upper levels', () => {
    expect(isFreeLadderLevel(1)).toBe(true);
    expect(isFreeLadderLevel(2)).toBe(true);
    expect(isFreeLadderLevel(3)).toBe(false);
    expect(isFreeLadderLevel(5)).toBe(false);
  });

  it('leaves at least one free and one premium level in the ladder definition', () => {
    expect(LADDER_LEVELS.some((l) => isFreeLadderLevel(l.level))).toBe(true);
    expect(LADDER_LEVELS.some((l) => !isFreeLadderLevel(l.level))).toBe(true);
    expect(FREE_LADDER_LEVELS).toBe(2);
  });
});

describe('splitPaperSetsByAccess', () => {
  it('sorts by set number and partitions free vs locked', () => {
    const sets = [
      { id: 'c-set-3' },
      { id: 'c-set-1' },
      { id: 'c-set-2' },
    ];
    const { free, locked } = splitPaperSetsByAccess(sets);
    expect(free.map((s) => s.id)).toEqual(['c-set-1']);
    expect(locked.map((s) => s.id)).toEqual(['c-set-2', 'c-set-3']);
  });

  it('returns an empty locked list when only set 1 exists', () => {
    const { free, locked } = splitPaperSetsByAccess([{ id: 'math-y7-set-1' }]);
    expect(free).toHaveLength(1);
    expect(locked).toHaveLength(0);
  });

  it('does not mutate the input', () => {
    const sets = [{ id: 'c-set-2' }, { id: 'c-set-1' }];
    splitPaperSetsByAccess(sets);
    expect(sets.map((s) => s.id)).toEqual(['c-set-2', 'c-set-1']);
  });
});
