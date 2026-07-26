import { describe, it, expect, afterEach, vi } from 'vitest';
import { DummyFeedbackProvider, dummyDefaultFromEnv } from '@/lib/feedback/dummy';
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
