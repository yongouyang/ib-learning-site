import { InMemoryAnalyticsStorage } from '../analytics/dummy';
import { aiMarkBucket, type FeedbackProvider, type FeedbackStorage, type MarkRequest, type MarkResult } from './types';

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

// In-memory feedback dummy (Phase E2) — the controllable-dummy directive
// (AGENTS.md): dev and e2e run against this with zero AWS resources. It
// EXTENDS the analytics dummy (which extends progress, which extends auth), so
// the ONE shared in-memory universe serves auth sessions, progress items,
// analytics events AND the AI-mark quota — the dev/e2e stand-in for the shared
// DynamoDB tables: a dummy-OTP login resolves end-to-end for /api/feedback.
// The quota counter mirrors the DynamoDB adapter's semantics EXACTLY (the
// month key is IN the bucket key, so the counter resets atomically when the
// calendar month rolls) — the parity test drives both against a simulated
// DynamoDB implementation.

export class InMemoryFeedbackStorage extends InMemoryAnalyticsStorage implements FeedbackStorage {
  private readonly aiMarkCounts = new Map<string, number>(); // bucket key → count

  async incrementAiMarkCount(userId: string, limit: number, monthKey: string): Promise<boolean> {
    const key = aiMarkBucket(userId, monthKey);
    const count = this.aiMarkCounts.get(key) ?? 0;
    if (count >= limit) return false;
    this.aiMarkCounts.set(key, count + 1);
    return true;
  }

  async getAiMarkCount(userId: string, monthKey: string): Promise<number> {
    return this.aiMarkCounts.get(aiMarkBucket(userId, monthKey)) ?? 0;
  }

  // Test hook (the _testCode precedent): only reachable via the handler under
  // FEEDBACK_TEST_MODE=1 + dummy storage — lets e2e force a quota-exhausted
  // state without 30 real marks.
  async setAiMarkCount(userId: string, monthKey: string, count: number): Promise<void> {
    this.aiMarkCounts.set(aiMarkBucket(userId, monthKey), count);
  }
}
