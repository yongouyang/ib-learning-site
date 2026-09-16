import { buildQuestionSet } from '@/lib/question-sets.server';
import { getExamPaper } from '@/lib/exams';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

/**
 * Composition for mock papers — SERVER-ONLY (Phase 1a, docs/premium-content-protection-plan.md §4.4):
 * it reads the topic content bank, so the runner page calls this at build time and passes the
 * resulting array to ExamRunnerClient as a prop. The paper *definitions* stay in exams.ts, which is
 * client-safe.
 *
 * Deterministic per (course, paper) — retakes see the same set (v1 policy, same as diagnostics).
 * Non-calculator questions only.
 */
export function buildExamQuestions(courseId: string, paperId: string): MixedReviewQuestion[] {
  const paper = getExamPaper(courseId, paperId);
  if (!paper) return [];
  return buildQuestionSet({
    courseId,
    targets: { ...paper.targets },
    seed: `exam:${courseId}:${paperId}`,
    excludeCalculator: true,
  });
}
