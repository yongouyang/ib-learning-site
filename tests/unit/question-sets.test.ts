import { describe, it, expect } from 'vitest';
import { buildQuestionSet } from '@/lib/question-sets';

describe('buildQuestionSet', () => {
  it('builds a set with the requested length and band counts', () => {
    const set = buildQuestionSet({
      courseId: 'math-y7',
      targets: { easy: 5, medium: 9, hard: 6 },
      seed: 'test:standard',
    });
    expect(set).toHaveLength(20);
    const count = (d: string) => set.filter((q) => (q.question.difficulty ?? 'medium') === d).length;
    expect(count('easy')).toBe(5);
    expect(count('medium')).toBe(9);
    expect(count('hard')).toBe(6);
  });

  it('is deterministic per seed', () => {
    const a = buildQuestionSet({ courseId: 'bio-ks3', targets: { easy: 3, medium: 4, hard: 3 }, seed: 's1' });
    const b = buildQuestionSet({ courseId: 'bio-ks3', targets: { easy: 3, medium: 4, hard: 3 }, seed: 's1' });
    expect(a.map((q) => q.question.id)).toEqual(b.map((q) => q.question.id));
  });

  it('varies with the seed', () => {
    const a = buildQuestionSet({ courseId: 'bio-ks3', targets: { easy: 3, medium: 4, hard: 3 }, seed: 's1' });
    const b = buildQuestionSet({ courseId: 'bio-ks3', targets: { easy: 3, medium: 4, hard: 3 }, seed: 's2' });
    expect(a.map((q) => q.question.id)).not.toEqual(b.map((q) => q.question.id));
  });

  it('excludes calculator-tagged questions when asked', () => {
    const withCalc = buildQuestionSet({
      courseId: 'math-y8',
      targets: { easy: 5, medium: 9, hard: 6 },
      seed: 'calc-test',
      excludeCalculator: false,
    });
    const withoutCalc = buildQuestionSet({
      courseId: 'math-y8',
      targets: { easy: 5, medium: 9, hard: 6 },
      seed: 'calc-test',
      excludeCalculator: true,
    });
    expect(withoutCalc.every((q) => !q.question.calculator)).toBe(true);
    expect(withoutCalc).toHaveLength(20); // pool is deep enough without calc questions
    // The unrestricted pool does contain calc-tagged questions somewhere.
    expect(withCalc.some((q) => q.question.calculator)).toBe(true);
  });

  it('spreads across topics (one question per topic while topics allow)', () => {
    const set = buildQuestionSet({
      courseId: 'math-y7',
      targets: { easy: 5, medium: 9, hard: 6 },
      seed: 'test:spread',
    });
    expect(new Set(set.map((q) => q.topicId)).size).toBe(set.length);
  });

  it('returns an empty set for an unknown course', () => {
    expect(buildQuestionSet({ courseId: 'nope', targets: { easy: 1, medium: 1, hard: 1 }, seed: 'x' })).toEqual([]);
  });
});
