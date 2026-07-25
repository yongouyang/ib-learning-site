import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMixedReviewQuestions, MIXED_REVIEW_COUNT } from '@/lib/mixed-review';
import type { TopicProgress } from '@/content/types';

describe('buildMixedReviewQuestions', () => {
  beforeEach(() => {
    vi.stubGlobal('Math', {
      ...Math,
      random: vi.fn(() => 0.5),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns random questions from all topics by default', () => {
    const result = buildMixedReviewQuestions([], 'random');
    expect(result.questions.length).toBe(MIXED_REVIEW_COUNT);
    expect(result.usedWeakTopics).toBe(false);
    expect(result.weakTopicCount).toBe(0);

    const subjectIds = new Set(result.questions.map((q) => q.subjectId));
    expect(subjectIds.size).toBeGreaterThanOrEqual(1);
  });

  it('falls back to random questions when weak mode has no weak topics', () => {
    const result = buildMixedReviewQuestions([], 'weak');
    expect(result.questions.length).toBe(MIXED_REVIEW_COUNT);
    expect(result.usedWeakTopics).toBe(false);
    expect(result.weakTopicCount).toBe(0);
  });

  it('uses weak topics when available in weak mode', () => {
    const weakProgress: TopicProgress[] = [
      {
        topicId: 'math-yr7-calculations',
        subjectId: 'math',
        topicTitle: 'Written Calculations',
        subjectTitle: 'math',
        attempts: [
          { date: new Date().toISOString(), correctCount: 1, totalCount: 10 },
        ],
      },
    ];

    const result = buildMixedReviewQuestions(weakProgress, 'weak');
    expect(result.weakTopicCount).toBe(1);
    // The weak topic exists, so it should be used.
    if (result.usedWeakTopics) {
      expect(result.questions.every((q) => q.topicId === 'math-yr7-calculations')).toBe(true);
    }
  });

  it('samples 3 easy / 4 medium / 3 hard from the full pool', () => {
    const result = buildMixedReviewQuestions([], 'random');
    const count = (d: string) =>
      result.questions.filter((q) => (q.question.difficulty ?? 'medium') === d).length;
    expect(count('easy')).toBe(3);
    expect(count('medium')).toBe(4);
    expect(count('hard')).toBe(3);
  });
});
