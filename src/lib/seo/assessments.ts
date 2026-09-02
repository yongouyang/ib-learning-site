import type { Metadata } from 'next';
import { getSubject } from '@/content/registry';
import type { Paper, SubjectId } from '@/content/types';
import { COURSES, getCourse, getCourseTopics } from '@/lib/courses';
import { DIAGNOSTIC_LENGTH } from '@/lib/diagnostics';
import { getExamPaper } from '@/lib/exams';
import { getLadderLevel } from '@/lib/ladder';
import { isFreeLadderLevel, isFreePaperSet } from '@/lib/entitlements/exam-access';
import { titleQualifier } from './meta';
import { pageMeta } from './page-meta';

/**
 * Metadata for the assessment tier (diagnostics / revision ladder / timed mock papers /
 * free-response sets). Two rules this module enforces:
 *
 * 1. Curriculum naming comes from the SAME qualifier as the topic pages, so a course page
 *    and its topics never disagree about how the tier is written ("KS3 Year 7 Maths").
 * 2. Indexability is DERIVED from the entitlement helpers themselves (isFreePaperSet /
 *    isFreeLadderLevel, plus the fact that timed mocks are gated in ExamRunnerClient).
 *    Those pages are login walls for an anonymous crawler, so they get noindex,follow and
 *    never appear in a sitemap. Change the free/locked split in exam-access.ts and this
 *    file follows automatically — that is the point, not an accident.
 */

/** "math-y7" → "KS3 Year 7 Maths"; "math-dp-ai" → "IB DP Maths AI". */
export function courseQualifier(courseId: string): string | null {
  const course = getCourse(courseId);
  if (!course) return null;
  const [first] = getCourseTopics(course);
  if (!first) {
    // Defensive: with the order.json contract every course has topics.
    return pageCourseFallback(course.title);
  }
  const subject = getSubject(first.subjectId as SubjectId);
  // No SL/HL here: a course covers both, and the first topic's level is arbitrary.
  return titleQualifier(first, subject?.name ?? first.subjectId, false);
}

const pageCourseFallback = (title: string) => title.replace(/\s*—\s*/g, ' ');

/** /diagnostics/<courseId> — tier-0, free for everyone, so indexable. */
export function metaForDiagnostic(courseId: string): Metadata | null {
  const qualifier = courseQualifier(courseId);
  const course = getCourse(courseId);
  if (!qualifier || !course) return null;
  const topicCount = getCourseTopics(course).length;
  return pageMeta({
    path: `/diagnostics/${courseId}`,
    title: `${qualifier} diagnostic test`,
    description: `Find your ${qualifier} gaps in a few minutes: up to ${DIAGNOSTIC_LENGTH} questions sampled across ${topicCount} topics, scored with a topic-by-topic breakdown and a suggested starting point.`,
  });
}

/** /exams/<courseId>/ladder — the overview of all five levels (free page, teaser rows). */
export function metaForLadderOverview(courseId: string): Metadata | null {
  const qualifier = courseQualifier(courseId);
  if (!qualifier) return null;
  return pageMeta({
    path: `/exams/${courseId}/ladder`,
    title: `${qualifier} revision ladder`,
    description: `Five levels of ${qualifier} practice from warm-up to challenge, each mixing questions across every topic in the course. Score 60% to unlock the next level; levels 1 and 2 are free.`,
  });
}

/** /exams/<courseId>/ladder/<level> — levels 1–2 indexable, 3–5 behind the premium tease. */
export function metaForLadderLevel(courseId: string, level: number): Metadata | null {
  const qualifier = courseQualifier(courseId);
  const def = getLadderLevel(level);
  if (!qualifier || !def) return null;
  return pageMeta({
    path: `/exams/${courseId}/ladder/${level}`,
    // "revision ladder level 4" overran the templated-title budget for the longer subject
    // names and every level clipped to the same string (duplicate <title>s). The short form
    // keeps the level number, which is the part the learner is looking for.
    title: `${qualifier} ladder level ${level}`,
    description: `Level ${level} of the ${qualifier} revision ladder: 10 cross-topic questions, instantly marked with explanations. Clear 60% to unlock the next level.`,
    indexable: isFreeLadderLevel(level),
  });
}

/** /exams/<courseId>/paper-<n> — timed mocks are premium-gated, so never indexable. */
export function metaForMockPaper(courseId: string, paperId: string): Metadata | null {
  const qualifier = courseQualifier(courseId);
  const paper = getExamPaper(courseId, paperId);
  if (!qualifier || !paper) return null;
  // "Paper 1 — short response" reads badly inside a title, so only the number is used and
  // the paper's own name goes into the description.
  const number = /paper-(\d+)/.exec(paperId)?.[1] ?? '';
  return pageMeta({
    path: `/exams/${courseId}/${paperId}`,
    title: `${qualifier} timed mock paper ${number}`,
    description: `${paper.title}: a timed ${paper.durationMinutes}-minute ${qualifier} mock exam, auto-marked with an explanation for every question. Part of the Octav Learning exam tier.`,
    indexable: false,
  });
}

/** /papers/<courseId>/<setId> — set 1 per course is free (indexable); sets 2+ are not. */
export function metaForPaperSet(paper: Paper): Metadata {
  const qualifier = courseQualifier(paper.courseId) ?? pageCourseFallback(paper.courseId);
  const marks = paper.questions.reduce((sum, question) => sum + question.marks, 0);
  // The set number belongs in the title: without it set-1 and set-2 of a course are
  // byte-identical strings (caught by the duplicate-title check over out/*.html).
  const setNumber = /-set-(\d+)$/.exec(paper.id)?.[1] ?? '';
  return pageMeta({
    path: `/papers/${paper.courseId}/${paper.id}`,
    // Marks live in the description: with the brand suffix this title has ~43 cells, and
    // "— 20 marks" was what got clipped away (e2e seo.spec caught it).
    title: `${qualifier} practice paper set ${setNumber}`,
    description: `${paper.questions.length} free-response ${qualifier} questions worth ${marks} marks, with a tick-point mark scheme and a model answer for every question${paper.durationMinutes ? `, in ${paper.durationMinutes} minutes` : ''}.`,
    indexable: isFreePaperSet(paper.id),
  });
}

/** Convenience for callers that only have the course list. */
export const allCourseIds = () => COURSES.map((c) => c.id);
