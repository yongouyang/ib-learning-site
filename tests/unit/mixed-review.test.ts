import { describe, it, expect, vi, afterEach } from 'vitest';
import { MIXED_REVIEW_COUNT, MIXED_REVIEW_BAND_TARGETS } from '@/lib/mixed-review';
import { drawMixedReviewQuestions } from '@/lib/mixed-review-draw';

// Phase 1b: the draw moved server-side (src/lib/mixed-review-draw.ts) — it is what the public
// content endpoint calls, and it is the reason the client no longer bundles the content bank. The
// caller chooses the pool (its own weak topics, or everything), so "weak mode" no longer appears in
// this API: the ids ARE the mode.
describe('drawMixedReviewQuestions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws a full mixed set from every topic when no ids are given', () => {
    const questions = drawMixedReviewQuestions({ topicIds: null, seed: 'seed-1' });
    expect(questions).toHaveLength(MIXED_REVIEW_COUNT);
    // Every question carries the topic context the results screen needs.
    for (const q of questions) {
      expect(q.topicId).toBeTruthy();
      expect(q.topicTitle).toBeTruthy();
      expect(q.subjectId).toBeTruthy();
    }
  });

  it('restricts the pool to the ids it is given', () => {
    const all = drawMixedReviewQuestions({ topicIds: null, seed: 'seed-2' });
    const oneTopic = all[0].topicId;
    const restricted = drawMixedReviewQuestions({ topicIds: [oneTopic], seed: 'seed-3' });
    expect(restricted.length).toBeGreaterThan(0);
    expect(new Set(restricted.map((q) => q.topicId))).toEqual(new Set([oneTopic]));
  });

  it('returns nothing for ids that match no topic (the endpoint 404s on this)', () => {
    expect(drawMixedReviewQuestions({ topicIds: ['not-a-real-topic'], seed: 'seed-4' })).toEqual([]);
  });

  it('is deterministic for the same seed and does not touch Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const a = drawMixedReviewQuestions({ topicIds: null, seed: 'same' }).map((q) => q.question.id);
    const b = drawMixedReviewQuestions({ topicIds: null, seed: 'same' }).map((q) => q.question.id);
    expect(b).toEqual(a);
    expect(random).not.toHaveBeenCalled();
    // …and a different seed is a different draw, so a retake is not the same set.
    const c = drawMixedReviewQuestions({ topicIds: null, seed: 'different' }).map((q) => q.question.id);
    expect(c).not.toEqual(a);
  });

  it('hits the band targets when the pool allows it', () => {
    const questions = drawMixedReviewQuestions({ topicIds: null, seed: 'bands' });
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const q of questions) byDifficulty[q.question.difficulty ?? 'medium'] += 1;
    expect(byDifficulty).toEqual({ ...MIXED_REVIEW_BAND_TARGETS });
  });
});
