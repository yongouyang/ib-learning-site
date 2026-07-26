import { z } from 'zod';

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
