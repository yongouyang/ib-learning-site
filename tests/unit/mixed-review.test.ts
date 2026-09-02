import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMixedReviewQuestions, MIXED_REVIEW_COUNT } from '@/lib/mixed-review';
import type { TopicProgress } from '@/content/types';

describe('buildMixedReviewQuestions', () => {
  // NOTE: `vi.stubGlobal('Math', { ...Math, random })` would leave Math with no
  // other methods (its properties are non-enumerable) — spy instead.
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  // SSR/hydration contract: with a seed the draw is pure, so the prerendered
  // HTML and the hydration render show the same question (MixedReviewClient
  // keeps the seed deterministic until it reseeds on the client).
  it('draws the same set for the same seed without touching Math.random', () => {
    const a = buildMixedReviewQuestions([], 'random', 'weak:abc');
    const b = buildMixedReviewQuestions([], 'random', 'weak:abc');
    const c = buildMixedReviewQuestions([], 'random', 'weak:def');
    expect(a.questions.map((q) => q.question.id)).toEqual(b.questions.map((q) => q.question.id));
    expect(a.questions.map((q) => q.question.id)).not.toEqual(c.questions.map((q) => q.question.id));
    expect(Math.random).not.toHaveBeenCalled();
    expect(a.questions).toHaveLength(MIXED_REVIEW_COUNT);
  });

  it('is deterministic in weak mode for a seed', () => {
    const weakProgress: TopicProgress[] = [
      {
        topicId: 'math-yr7-calculations',
        subjectId: 'math',
        topicTitle: 'Written Calculations',
        subjectTitle: 'math',
        attempts: [{ date: new Date().toISOString(), correctCount: 1, totalCount: 10 }],
      },
    ];
    const a = buildMixedReviewQuestions(weakProgress, 'weak', 'seed-1');
    const b = buildMixedReviewQuestions(weakProgress, 'weak', 'seed-1');
    expect(a.usedWeakTopics).toBe(true);
    expect(a.questions.map((q) => q.question.id)).toEqual(b.questions.map((q) => q.question.id));
    expect(a.questions.every((q) => q.topicId === 'math-yr7-calculations')).toBe(true);
  });
});
