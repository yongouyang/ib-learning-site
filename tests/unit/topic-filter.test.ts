import { describe, it, expect } from 'vitest';
import { filterTopics } from '@/lib/topic-filter';
import type { Topic } from '@/content/types';

function makeTopic(id: string, title: string, description: string, ibLevel: 'MYP' | 'DP'): Topic {
  return {
    id,
    subjectId: 'math',
    title,
    description,
    ibLevel,
    notes: [],
    flashcards: [],
    questions: [],
  };
}

const topics = [
  makeTopic('t1', 'Algebra Basics', 'Introduction to algebra', 'MYP'),
  makeTopic('t2', 'Sequences & Series', 'DP sequences and series', 'DP'),
  makeTopic('t3', 'Calculus', 'Differentiation and integration', 'DP'),
  makeTopic('t4', 'Geometry', 'Shapes and angles', 'MYP'),
];

describe('filterTopics', () => {
  it('returns all topics when query and level are empty/all', () => {
    const result = filterTopics(topics, { query: '', level: 'all' });
    expect(result).toHaveLength(4);
  });

  it('filters by query in title (case-insensitive)', () => {
    const result = filterTopics(topics, { query: 'ALGEBRA', level: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by query in description', () => {
    const result = filterTopics(topics, { query: 'differentiation', level: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t3');
  });

  it('filters by level', () => {
    const result = filterTopics(topics, { query: '', level: 'DP' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('combines query and level filters', () => {
    const result = filterTopics(topics, { query: 'series', level: 'DP' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('returns empty array when nothing matches', () => {
    const result = filterTopics(topics, { query: 'quantum', level: 'all' });
    expect(result).toHaveLength(0);
  });

  it('ignores leading/trailing whitespace in query', () => {
    const result = filterTopics(topics, { query: '  geometry  ', level: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t4');
  });
});
