import type { FeedbackProvider, MarkRequest, MarkResult } from './types';

// Dummy AI feedback provider (Phase 5 testing mindset): deterministic,
// zero-token, controllable. Used for local development, e2e, and
// production-issue reproduction — never a real marker.
//
// Default: every point awarded with a canned comment. A custom default can be
// supplied via FEEDBACK_DUMMY_RESPONSE (JSON). Per-request injection is
// handled by the API route (_testResponse, only when FEEDBACK_TEST_MODE=1 and
// this provider is active) — injected payloads still pass the same zod
// response validation as a real provider's output.
export class DummyFeedbackProvider implements FeedbackProvider {
  constructor(private readonly defaultResponse?: MarkResult) {}

  async markAnswer(req: MarkRequest): Promise<MarkResult> {
    if (this.defaultResponse) return this.defaultResponse;
    return {
      marks: req.maxMarks,
      perPoint: req.markscheme.map((point) => ({
        point,
        awarded: true,
        comment: 'Dummy marker: point awarded',
      })),
      feedback: 'Dummy marker — configure FEEDBACK_API_KEY for real AI feedback.',
    };
  }
}

/** Parse FEEDBACK_DUMMY_RESPONSE, returning undefined when absent/invalid. */
export function dummyDefaultFromEnv(env: NodeJS.ProcessEnv = process.env): MarkResult | undefined {
  const raw = env.FEEDBACK_DUMMY_RESPONSE;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as MarkResult;
  } catch {
    return undefined;
  }
}
