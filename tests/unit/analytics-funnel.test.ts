import { describe, expect, it } from 'vitest';
import { buildQuizFunnel, type FunnelEvent } from '@/lib/analytics/funnel';

function event(name: string, props: Record<string, unknown>, overrides: Partial<FunnelEvent> = {}): FunnelEvent {
  return {
    name,
    props,
    sessionId: 'tab-1',
    ua: 'Mozilla/5.0 (iPhone)',
    s: '2026-11-09#1000#event',
    ...overrides,
  };
}

describe('quiz funnel', () => {
  it('joins start, question positions and completion by attempt id', () => {
    const result = buildQuizFunnel([
      event('quiz_started', { attemptId: 'a1', source: 'custom_test', topicId: 'custom-test' }),
      event('quiz_question_answered', { attemptId: 'a1', source: 'custom_test', questionNumber: 1 }),
      event('quiz_question_answered', { attemptId: 'a1', source: 'custom_test', questionNumber: 3 }),
      event('quiz_completed', { attemptId: 'a1', topicId: 'custom-test' }),
      event('quiz_started', { attemptId: 'a2', source: 'custom_test', topicId: 'custom-test' }, { sessionId: 'tab-2', ua: 'Desktop' }),
      event('quiz_question_answered', { attemptId: 'a2', source: 'custom_test', questionNumber: 1 }, { sessionId: 'tab-2', ua: 'Desktop' }),
    ]);
    expect(result.attempts).toBe(2);
    expect(result.bySource.custom_test).toEqual({
      attempts: 2,
      startEvents: 2,
      reachedFirstQuestion: 2,
      completed: 1,
      completionRate: 50,
      furthestQuestion: { '1': 1, '3': 1 },
    });
    expect(result.byDevice.iPhone.completed).toBe(1);
    expect(result.byDevice['Desktop/other'].completed).toBe(0);
  });

  it('keeps legacy tab/topic groups separate from attempt-linked data and exposes duplicate starts', () => {
    const result = buildQuizFunnel([
      event('quiz_started', { source: 'topic_page', topicId: 'math-1' }),
      event('quiz_started', { source: 'topic_page', topicId: 'math-1' }),
      event('quiz_question_answered', { source: 'topic_page', topicId: 'math-1', questionNumber: 2 }),
    ]);
    expect(result).toMatchObject({ attempts: 1, legacyAttempts: 1 });
    expect(result.bySource.topic_page).toMatchObject({ startEvents: 2, reachedFirstQuestion: 1, completed: 0 });
  });
});
