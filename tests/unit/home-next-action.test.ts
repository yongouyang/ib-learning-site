import { describe, it, expect } from 'vitest';
import { getNextAction } from '@/lib/home-next-action';
import type { DueTopic } from '@/lib/flashcard-scheduler';
import type { TopicProgress } from '@/content/types';

function dueTopic(overrides: Partial<DueTopic> = {}): DueTopic {
  return { topicId: 'topic-1', subjectId: 'math', topicTitle: 'Test', dueCount: 3, ...overrides };
}

function weakTopic(overrides: Partial<TopicProgress> = {}): TopicProgress {
  return {
    topicId: 'topic-1',
    subjectId: 'math',
    topicTitle: 'Test',
    subjectTitle: 'Math',
    attempts: [{ date: '2026-07-25T12:00:00Z', correctCount: 1, totalCount: 5 }], // 20% < 70%
    ...overrides,
  };
}

describe('getNextAction', () => {
  it('prioritises due flashcards over weak topics', () => {
    const action = getNextAction([dueTopic({ topicId: 'bio-cell-1', subjectId: 'biology', dueCount: 2 })], [weakTopic()]);
    expect(action.href).toBe('/subjects/biology/bio-cell-1/flashcards?filter=due');
    expect(action.summary).toBe('2 flashcards due');
    expect(action.label).toBe('Review flashcards');
  });

  it('pluralises the due summary', () => {
    expect(getNextAction([dueTopic({ dueCount: 1 })], []).summary).toBe('1 flashcard due');
    expect(getNextAction([dueTopic({ dueCount: 5 })], []).summary).toBe('5 flashcards due');
  });

  it('falls back to weak areas when nothing is due', () => {
    const action = getNextAction([], [weakTopic(), weakTopic({ topicId: 'topic-2' })]);
    expect(action.href).toBe('/mixed-review?mode=weak');
    expect(action.summary).toBe('2 topics to strengthen');
  });

  it('falls back to a mock exam when nothing is due or weak', () => {
    const action = getNextAction([], []);
    expect(action.href).toBe('/exams');
    expect(action.label).toBe('Try a mock exam');
    expect(action.summary).toBeNull();
  });
});
