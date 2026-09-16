import { COURSES, getCourseTopics } from '@/lib/courses';
import { getSubjects } from '@/content/registry';
import { buildQuestionSet } from '@/lib/question-sets.server';
import { DIAGNOSTIC_BAND_TARGETS, type DiagnosticCourseInfo } from '@/lib/diagnostics';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

/**
 * Composition and inventory for diagnostics — SERVER-ONLY (Phase 1a,
 * docs/premium-content-protection-plan.md §4.4). `topicCount` comes from the metadata registry, so
 * this file is the only place that needs the content bank. Diagnostics themselves stay free and
 * indexable: the runner page composes at build time and passes the questions to the client.
 */
export function getDiagnosticCourses(): DiagnosticCourseInfo[] {
  const metaTopics = getSubjects().flatMap((s) => s.topics);
  return COURSES.map((course) => ({
    id: course.id,
    title: course.title,
    topicCount: getCourseTopics(metaTopics, course).length,
    questionCount: buildDiagnosticQuestions(course.id).length,
  }));
}

/**
 * Deterministic (seeded) so server and client renders match and a retake sees the same set.
 * Diagnostics sample the full pool (calculator-tagged included); the non-calculator policy applies
 * to exams and the ladder, not here.
 */
export function buildDiagnosticQuestions(courseId: string): MixedReviewQuestion[] {
  return buildQuestionSet({
    courseId,
    targets: { ...DIAGNOSTIC_BAND_TARGETS },
    seed: `diagnostic:${courseId}`,
  });
}
