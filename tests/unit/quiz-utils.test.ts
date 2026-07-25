import { describe, it, expect } from 'vitest';
import {
  orderQuestionsByDifficulty,
  filterQuestionsByDifficulty,
  parseDifficultyFilter,
  seededShuffle,
} from '@/lib/quiz-utils';
import type { Question } from '@/content/types';

function makeQuestion(id: string, difficulty?: 'easy' | 'medium' | 'hard'): Question {
  return {
    id,
    stem: `Stem ${id}`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `Explanation ${id}`,
    ...(difficulty ? { difficulty } : {}),
  };
}

const pool: Question[] = [
  makeQuestion('h1', 'hard'),
  makeQuestion('e1', 'easy'),
  makeQuestion('m1', 'medium'),
  makeQuestion('e2', 'easy'),
  makeQuestion('h2', 'hard'),
  makeQuestion('m2', 'medium'),
  makeQuestion('untagged'),
];

describe('orderQuestionsByDifficulty', () => {
  it('orders easy -> medium -> hard, treating untagged as medium', () => {
    const ordered = orderQuestionsByDifficulty(pool, 'seed');
    expect(ordered.map((q) => q.difficulty ?? 'medium')).toEqual([
      'easy', 'easy',
      'medium', 'medium', 'medium',
      'hard', 'hard',
    ]);
    expect(ordered).toHaveLength(pool.length);
  });

  it('is deterministic for the same seed', () => {
    const a = orderQuestionsByDifficulty(pool, 'topic-x');
    const b = orderQuestionsByDifficulty(pool, 'topic-x');
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('shuffles within bands (does not preserve input order)', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeQuestion(`e${i}`, 'easy'));
    const ordered = orderQuestionsByDifficulty(many, 'seed-1');
    expect(ordered.map((q) => q.id)).not.toEqual(many.map((q) => q.id));
    expect(new Set(ordered.map((q) => q.id))).toEqual(new Set(many.map((q) => q.id)));
  });

  it('handles an empty pool', () => {
    expect(orderQuestionsByDifficulty([], 'seed')).toEqual([]);
  });
});

describe('filterQuestionsByDifficulty', () => {
  it('returns all questions for "all"', () => {
    expect(filterQuestionsByDifficulty(pool, 'all')).toHaveLength(pool.length);
  });

  it('filters to the requested band', () => {
    expect(filterQuestionsByDifficulty(pool, 'easy').map((q) => q.id)).toEqual(['e1', 'e2']);
    expect(filterQuestionsByDifficulty(pool, 'hard').map((q) => q.id)).toEqual(['h1', 'h2']);
  });

  it('treats untagged questions as medium', () => {
    const medium = filterQuestionsByDifficulty(pool, 'medium');
    expect(medium.map((q) => q.id)).toEqual(['m1', 'm2', 'untagged']);
  });
});

describe('parseDifficultyFilter', () => {
  it('parses valid bands', () => {
    expect(parseDifficultyFilter('easy')).toBe('easy');
    expect(parseDifficultyFilter('medium')).toBe('medium');
    expect(parseDifficultyFilter('hard')).toBe('hard');
  });

  it('falls back to "all" for missing or invalid values', () => {
    expect(parseDifficultyFilter(null)).toBe('all');
    expect(parseDifficultyFilter('extreme')).toBe('all');
    expect(parseDifficultyFilter('')).toBe('all');
  });
});

describe('seededShuffle (moved from QuizGame)', () => {
  it('leaves order unchanged without a seed', () => {
    expect(seededShuffle([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('is deterministic for a given seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(items, 's')).toEqual(seededShuffle(items, 's'));
  });
});
