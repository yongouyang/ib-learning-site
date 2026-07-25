import { COURSES } from '@/lib/courses';
import { buildQuestionSet } from '@/lib/question-sets';
import type { Difficulty } from '@/content/types';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

// Mock exam papers per course grouping (Phase 3). ALL papers are
// non-calculator (user decision): the sampler excludes calculator-tagged
// questions. Paper variants split by difficulty lean, not by calculator.
export interface ExamPaper {
  courseId: string;
  paperId: string; // 'paper-1' | 'paper-2'
  title: string;
  targets: Record<Difficulty, number>;
  durationMinutes: number;
}

const STANDARD_MIX: Record<Difficulty, number> = { easy: 5, medium: 9, hard: 6 };
const HARD_MIX: Record<Difficulty, number> = { easy: 3, medium: 8, hard: 9 };

function papersFor(courseId: string): ExamPaper[] {
  const isMath = courseId.startsWith('math');
  const isDp = courseId === 'math-dp-ai';

  const paper1: ExamPaper = {
    courseId,
    paperId: 'paper-1',
    title: isDp ? 'Paper 1 — short response' : 'Paper 1',
    targets: isDp ? { easy: 6, medium: 10, hard: 4 } : { ...STANDARD_MIX },
    durationMinutes: isDp ? 30 : isMath ? 30 : 25,
  };

  if (!isMath) return [paper1];

  const paper2: ExamPaper = {
    courseId,
    paperId: 'paper-2',
    title: isDp ? 'Paper 2 — extended response' : 'Paper 2',
    targets: { ...HARD_MIX },
    durationMinutes: isDp ? 35 : 30,
  };
  return [paper1, paper2];
}

export function getExamPapers(courseId: string): ExamPaper[] {
  if (!COURSES.some((c) => c.id === courseId)) return [];
  return papersFor(courseId);
}

export function getExamPaper(courseId: string, paperId: string): ExamPaper | undefined {
  return getExamPapers(courseId).find((p) => p.paperId === paperId);
}

export function getExamCourses(): { id: string; title: string; papers: ExamPaper[] }[] {
  return COURSES.map((course) => ({
    id: course.id,
    title: course.title,
    papers: papersFor(course.id),
  }));
}

export function examId(courseId: string, paperId: string): string {
  return `${courseId}:${paperId}`;
}

// Deterministic per (course, paper) — retakes see the same set (v1 policy,
// same as diagnostics). Non-calculator questions only.
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
