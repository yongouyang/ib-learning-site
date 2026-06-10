import { describe, it, expect } from 'vitest';
import { getSubjects, getSubject, getTopic } from '@/content/registry';

describe('content-registry', () => {
  it('should have 5 subjects', () => {
    const subjects = getSubjects();
    expect(subjects).toHaveLength(5);
    expect(subjects.map(s => s.id).sort()).toEqual(['biology', 'chemistry', 'english', 'math', 'physics']);
  });

  it('should get a subject by id', () => {
    const math = getSubject('math');
    expect(math).toBeDefined();
    expect(math!.name).toBe('Math');
  });

  it('should get a topic by subject and topic id', () => {
    const topic = getTopic('math', 'math-yr7-calculations');
    expect(topic).toBeDefined();
    expect(topic!.title).toBe('Written Calculations');
    expect(topic!.notes.length).toBeGreaterThan(0);
    expect(topic!.flashcards.length).toBeGreaterThan(0);
    expect(topic!.questions.length).toBeGreaterThan(0);
  });

  it('should return undefined for unknown subject', () => {
    expect(getSubject('xyz' as any)).toBeUndefined();
  });

  it('should return undefined for unknown topic', () => {
    expect(getTopic('math', 'nonexistent')).toBeUndefined();
  });
});
