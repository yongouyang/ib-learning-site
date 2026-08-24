import { z } from 'zod';
import type { SessionRecord, UserRecord } from '../auth/types';

// Request/response contract for POST /api/feedback (Phase 5).
export const MAX_STUDENT_ANSWER_LENGTH = 2000;
export const MAX_MARKS_PER_QUESTION = 10;

export const markRequestSchema = z.object({
  stem: z.string().min(1),
  markscheme: z.array(z.string().min(1)).min(1).max(MAX_MARKS_PER_QUESTION),
  modelAnswer: z.string().min(1),
  studentAnswer: z.string().min(1).max(MAX_STUDENT_ANSWER_LENGTH),
  maxMarks: z.number().int().min(1).max(MAX_MARKS_PER_QUESTION),
});

export const markResultSchema = z.object({
  marks: z.number().int().min(0),
  perPoint: z.array(
    z.object({
      point: z.string(),
      awarded: z.boolean(),
      comment: z.string().max(280),
    })
  ),
  feedback: z.string().max(1000),
});

export type MarkRequest = z.infer<typeof markRequestSchema>;
export type MarkResult = z.infer<typeof markResultSchema>;

export interface FeedbackProvider {
  markAnswer(req: MarkRequest): Promise<MarkResult>;
}

/** Thrown when no usable provider is configured (route maps this to 501). */
export class FeedbackNotConfiguredError extends Error {
  constructor(message = 'AI feedback is not configured') {
    super(message);
    this.name = 'FeedbackNotConfiguredError';
  }
}

/** Recompute marks from perPoint — the LLM (or a test injection) can't inflate scores. */
export function marksFromPerPoint(result: MarkResult): number {
  return result.perPoint.filter((p) => p.awarded).length;
}

// --- Phase E2 — durable monthly AI-mark quota ----------------------------------
// 30 marks per calendar month per account (free) / 1000 safety cap (premium) —
// the tier→limit numbers live in src/lib/entitlements/features.ts (single
// source of truth). The counter is a fixed-window bucket in octav-rate-limits
// keyed `aimark:<userId>:<YYYY-MM>` — the calendar month is IN the key, so the
// quota resets atomically when the month rolls (same pattern as
// incrementOtpRequestCount / incrementProgressSyncCount). TTL is ~40 days: the
// bucket is never read after its month ends, so TTL is cleanup only.

/** TTL for the monthly bucket item (~40 days — covers the month + slack). */
export const AI_MARK_BUCKET_TTL_SECONDS = 40 * 86_400;

export function aiMarkBucket(userId: string, monthKey: string): string {
  return `aimark:${userId}:${monthKey}`;
}

/** Calendar-month window key (UTC), e.g. "2026-08". */
export function aiMarkMonthKey(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

/** Start of the next calendar month (UTC) — when the quota resets. */
export function aiMarkResetAt(now: number): string {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Storage the feedback handler needs (Phase E2): the session-validation
 * subset (one source of truth: src/lib/auth/session.ts) plus the durable
 * monthly quota counter. The DynamoDB adapter composes DynamoSessionStorage;
 * the dummy joins the SHARED in-memory auth→progress→analytics universe so a
 * dummy-OTP session resolves end-to-end in dev/e2e.
 */
export interface FeedbackStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Durable monthly quota: ONE conditional increment on bucket
   * `aimark:<userId>:<monthKey>` — true = within quota (count charged),
   * false = quota exhausted (the handler 429s BEFORE any LLM call, so an
   * exhausted quota never spends money).
   */
  incrementAiMarkCount(userId: string, limit: number, monthKey: string): Promise<boolean>;
  /** Current usage for the month (0 when no bucket exists) — the GET quota state. */
  getAiMarkCount(userId: string, monthKey: string): Promise<number>;
  /**
   * Test hook — dummy-only: the handler calls it ONLY under
   * FEEDBACK_TEST_MODE=1 + dummy storage (the _testCode precedent), so e2e can
   * force a quota-exhausted state without 30 real marks. The DynamoDB adapter
   * deliberately does not implement it.
   */
  setAiMarkCount?(userId: string, monthKey: string, count: number): Promise<void>;
}
