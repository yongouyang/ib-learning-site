import { COURSES } from '@/lib/courses';

// One short cross-topic diagnostic per course grouping. Results are recorded
// as per-topic quiz attempts so the weak-areas system is seeded immediately
// (see docs/revised-implementation-plan.md Phase 2). Course definitions live in
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

// getDiagnosticCourses + buildDiagnosticQuestions live in diagnostics.server.ts: they read the
// topic content bank (docs/premium-content-protection-plan.md §4.4).
