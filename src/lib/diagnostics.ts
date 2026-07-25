import { COURSES, getCourseTopics } from '@/lib/courses';
import { buildQuestionSet } from '@/lib/question-sets';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

// One short cross-topic diagnostic per course grouping. Results are recorded
// as per-topic quiz attempts so the weak-areas system is seeded immediately
// (see revised-implementation-plan.md Phase 2). Course definitions live in
// src/lib/courses.ts (shared with exams and the revision ladder).

export const DIAGNOSTIC_LENGTH = 15;
// Band targets for a 15-question diagnostic (≈30/40/30, sums to DIAGNOSTIC_LENGTH).
export const DIAGNOSTIC_BAND_TARGETS = { easy: 4, medium: 7, hard: 4 } as const;

export interface DiagnosticCourseInfo {
  id: string;
  title: string;
  topicCount: number;
  questionCount: number; // actual set length (capped at DIAGNOSTIC_LENGTH)
}

export function getDiagnosticCourse(id: string) {
  return COURSES.find((c) => c.id === id);
}

export function getDiagnosticCourses(): DiagnosticCourseInfo[] {
  return COURSES.map((course) => ({
    id: course.id,
    title: course.title,
    topicCount: getCourseTopics(course).length,
    questionCount: buildDiagnosticQuestions(course.id).length,
  }));
}

// Deterministic (seeded) so server and client renders match and a retake sees
// the same set. Diagnostics sample the full pool (calculator-tagged included);
// the non-calculator policy applies to exams and the ladder, not here.
export function buildDiagnosticQuestions(courseId: string): MixedReviewQuestion[] {
  return buildQuestionSet({
    courseId,
    targets: { ...DIAGNOSTIC_BAND_TARGETS },
    seed: `diagnostic:${courseId}`,
  });
}
