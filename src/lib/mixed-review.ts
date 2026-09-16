import { Question, SubjectId } from '@/content/types';

/**
 * Constants and types for mixed review — deliberately content-free, because five other modules
 * import this file for `MixedReviewQuestion` alone (exams, ladder, diagnostics, question-sets, and
 * the mixed-review client). The draw itself lives in
 * `src/app/mixed-review/build-mixed-review.ts`, which is reached only through a dynamic import so
 * the content bank stays out of the shared chunks (docs/premium-content-protection-plan.md §4.4).
 */
export const MIXED_REVIEW_TOPIC_ID = 'mixed-review';
export const MIXED_REVIEW_SUBJECT_ID: SubjectId = 'math';
export const MIXED_REVIEW_TITLE = 'Mixed Review';
export const MIXED_REVIEW_COUNT = 10;
// Per-band targets for each mixed-review set (sums to MIXED_REVIEW_COUNT).
export const MIXED_REVIEW_BAND_TARGETS = { easy: 3, medium: 4, hard: 3 } as const;

export interface MixedReviewQuestion {
  question: Question;
  topicId: string;
  subjectId: SubjectId;
  topicTitle: string;
}
