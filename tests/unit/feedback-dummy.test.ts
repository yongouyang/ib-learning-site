import { describe, it, expect, afterEach, vi } from 'vitest';
import { DummyFeedbackProvider, InMemoryFeedbackStorage, dummyDefaultFromEnv } from '@/lib/feedback/dummy';
import { markResultSchema, marksFromPerPoint } from '@/lib/feedback/types';

const REQ = {
  stem: 'Work out $347 + 586$.',
  markscheme: ['M1: correct column-addition method', 'A1: 933'],
  modelAnswer: 'Column addition gives 933.',
  studentAnswer: '933',
  maxMarks: 2,
};

describe('DummyFeedbackProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a schema-valid default with all points awarded', async () => {
    const result = await new DummyFeedbackProvider().markAnswer(REQ);
    expect(markResultSchema.safeParse(result).success).toBe(true);
    expect(result.perPoint).toHaveLength(REQ.markscheme.length);
    expect(marksFromPerPoint(result)).toBe(REQ.maxMarks);
    expect(result.feedback).toContain('Dummy marker');
  });

  it('uses a custom default from FEEDBACK_DUMMY_RESPONSE', async () => {
    const custom = {
      marks: 0,
      perPoint: [
        { point: 'M1: correct column-addition method', awarded: false, comment: 'custom' },
        { point: 'A1: 933', awarded: false, comment: 'custom' },
      ],
      feedback: 'custom default',
    };
    vi.stubEnv('FEEDBACK_DUMMY_RESPONSE', JSON.stringify(custom));
    const result = await new DummyFeedbackProvider(dummyDefaultFromEnv()).markAnswer(REQ);
    expect(result).toEqual(custom);
  });

  it('falls back to the built-in default when the env JSON is invalid', () => {
    vi.stubEnv('FEEDBACK_DUMMY_RESPONSE', '{broken');
    expect(dummyDefaultFromEnv()).toBeUndefined();
  });
});

describe('InMemoryFeedbackStorage — monthly AI-mark quota (E2)', () => {
  it('allows up to the limit, then denies; the month key separates windows', async () => {
    const storage = new InMemoryFeedbackStorage();
    expect(await storage.incrementAiMarkCount('u1', 2, '2026-08')).toBe(true);
    expect(await storage.incrementAiMarkCount('u1', 2, '2026-08')).toBe(true);
    expect(await storage.incrementAiMarkCount('u1', 2, '2026-08')).toBe(false); // August spent
    expect(await storage.getAiMarkCount('u1', '2026-08')).toBe(2);
    // The month key is IN the bucket — September is a fresh window.
    expect(await storage.incrementAiMarkCount('u1', 2, '2026-09')).toBe(true);
    expect(await storage.getAiMarkCount('u1', '2026-09')).toBe(1);
    expect(await storage.getAiMarkCount('u1', '2026-10')).toBe(0);
  });

  it('setAiMarkCount forces the counter (test hook for quota-exhaustion e2e)', async () => {
    const storage = new InMemoryFeedbackStorage();
    await storage.setAiMarkCount('u1', '2026-08', 30);
    expect(await storage.getAiMarkCount('u1', '2026-08')).toBe(30);
    expect(await storage.incrementAiMarkCount('u1', 30, '2026-08')).toBe(false);
    await storage.setAiMarkCount('u1', '2026-08', 0);
    expect(await storage.incrementAiMarkCount('u1', 30, '2026-08')).toBe(true);
  });
});
