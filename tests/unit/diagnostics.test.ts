import { describe, it, expect } from 'vitest';
import {
  buildDiagnosticQuestions,
  getDiagnosticCourse,
  getDiagnosticCourses,
  DIAGNOSTIC_LENGTH,
} from '@/lib/diagnostics';

describe('getDiagnosticCourses', () => {
  it('exposes the 13 course groupings with topics and questions', () => {
    const courses = getDiagnosticCourses();
    expect(courses.map((c) => c.id)).toEqual([
      'math-y7',
      'math-y8',
      'math-y9',
      'math-dp-ai',
      'eng-ks3',
      'bio-ks3',
      'chem-ks3',
      'phys-ks3',
      'geog-ks3',
      'hist-ks3',
      'ict-ks3',
      'chin-ks3',
      'germ-ks3',
    ]);
    for (const course of courses) {
      expect(course.topicCount).toBeGreaterThan(0);
      expect(course.questionCount).toBeGreaterThan(0);
      expect(course.questionCount).toBeLessThanOrEqual(DIAGNOSTIC_LENGTH);
    }
  });
});

describe('buildDiagnosticQuestions', () => {
  it('builds a 15-question set for a large course (math-y7)', () => {
    const questions = buildDiagnosticQuestions('math-y7');
    expect(questions).toHaveLength(DIAGNOSTIC_LENGTH);
  });

  it('meets the band targets when the pool allows it', () => {
    const questions = buildDiagnosticQuestions('math-y7');
    const count = (d: string) =>
      questions.filter((q) => (q.question.difficulty ?? 'medium') === d).length;
    expect(count('easy')).toBe(4);
    expect(count('medium')).toBe(7);
    expect(count('hard')).toBe(4);
  });

  it('spreads across topics (at most one question per topic when topics allow)', () => {
    const questions = buildDiagnosticQuestions('math-y7');
    const topicIds = new Set(questions.map((q) => q.topicId));
    expect(topicIds.size).toBe(questions.length);
  });

  it('is deterministic for the same course', () => {
    const a = buildDiagnosticQuestions('eng-ks3').map((q) => q.question.id);
    const b = buildDiagnosticQuestions('eng-ks3').map((q) => q.question.id);
    expect(a).toEqual(b);
  });

  it('only includes questions from the course grouping', () => {
    const questions = buildDiagnosticQuestions('math-y9');
    expect(questions.every((q) => q.subjectId === 'math')).toBe(true);
    expect(questions.some((q) => q.topicId === 'math-yr7-calculations')).toBe(false);
  });

  it('caps the set at DIAGNOSTIC_LENGTH even when topics exceed it', () => {
    // math-y7 has 26 topics — more than the 15-question cap.
    expect(getDiagnosticCourse('math-y7')).toBeDefined();
    expect(buildDiagnosticQuestions('math-y7').length).toBe(DIAGNOSTIC_LENGTH);
  });

  it('returns an empty set for an unknown course', () => {
    expect(buildDiagnosticQuestions('nope')).toEqual([]);
  });
});
