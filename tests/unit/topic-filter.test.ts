import { describe, it, expect } from 'vitest';
import { filterTopics } from '@/lib/topic-filter';
import type { Stage, Topic } from '@/content/types';

function makeTopic(id: string, title: string, description: string, stage: Stage): Topic {
  return {
    id,
    subjectId: 'math',
    title,
    description,
    stage,
    notes: [],
    flashcards: [],
    questions: [],
  };
}

const topics = [
  makeTopic('t1', 'Algebra Basics', 'Introduction to algebra', 'ks3'),
  makeTopic('t2', 'Sequences & Series', 'DP sequences and series', 'dp'),
  makeTopic('t3', 'Calculus', 'Differentiation and integration', 'dp'),
  makeTopic('t4', 'Geometry', 'Shapes and angles', 'ks3'),
];

describe('filterTopics', () => {
  it('returns all topics when query and stage are empty/all', () => {
    const result = filterTopics(topics, { query: '', stage: 'all' });
    expect(result).toHaveLength(4);
  });

  it('filters by query in title (case-insensitive)', () => {
    const result = filterTopics(topics, { query: 'ALGEBRA', stage: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by query in description', () => {
    const result = filterTopics(topics, { query: 'differentiation', stage: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t3');
  });

  it('filters by stage', () => {
    const result = filterTopics(topics, { query: '', stage: 'dp' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('combines query and stage filters', () => {
    const result = filterTopics(topics, { query: 'series', stage: 'dp' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('returns empty array when nothing matches', () => {
    const result = filterTopics(topics, { query: 'quantum', stage: 'all' });
    expect(result).toHaveLength(0);
  });

  it('ignores leading/trailing whitespace in query', () => {
    const result = filterTopics(topics, { query: '  geometry  ', stage: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t4');
  });
});
