import { describe, it, expect } from 'vitest';
import { OpenAICompatibleProvider } from '@/lib/feedback/openai-compatible';
import { markResultSchema, marksFromPerPoint } from '@/lib/feedback/types';

// LIVE contract test — hits the real LLM provider (costs tokens).
// Skipped unless BOTH FEEDBACK_LIVE=1 and FEEDBACK_API_KEY are set:
//   FEEDBACK_LIVE=1 FEEDBACK_API_KEY=... npx vitest run tests/live/feedback-live.test.ts --config vitest.live.config.ts
// (vitest.config only includes tests/unit; run this file with an explicit config or by pointing --include at it.)
const LIVE = process.env.FEEDBACK_LIVE === '1' && Boolean(process.env.FEEDBACK_API_KEY);

describe.skipIf(!LIVE)('live AI feedback provider (costs tokens)', () => {
  it('marks a trivial question with a valid response shape', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: process.env.FEEDBACK_API_KEY!,
      model: process.env.FEEDBACK_MODEL ?? 'moonshot-v1-8k',
      baseUrl: process.env.FEEDBACK_BASE_URL ?? 'https://api.moonshot.ai/v1',
    });

    const started = Date.now();
    const result = await provider.markAnswer({
      stem: 'Write down the value of $2 + 2$.',
      markscheme: ['B1: 4'],
      modelAnswer: '2 + 2 = 4.',
      studentAnswer: 'The answer is 4.',
      maxMarks: 1,
    });
    const elapsed = Date.now() - started;
    console.log(`live provider responded in ${elapsed}ms`);

    expect(markResultSchema.safeParse(result).success).toBe(true);
    expect(result.perPoint).toHaveLength(1);
    expect(result.perPoint[0].awarded).toBe(true); // obviously correct answer
    expect(marksFromPerPoint(result)).toBe(1);
  }, 60000);
});
