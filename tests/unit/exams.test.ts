import { describe, it, expect } from 'vitest';
import { getExamPapers, getExamPaper, getExamCourses, buildExamQuestions, examId } from '@/lib/exams';
import { COURSES } from '@/lib/courses';

describe('exam paper definitions', () => {
  it('every course has at least one paper, math courses have two', () => {
    for (const course of COURSES) {
      const papers = getExamPapers(course.id);
      expect(papers.length).toBe(course.id.startsWith('math') ? 2 : 1);
      for (const paper of papers) {
        const total = paper.targets.easy + paper.targets.medium + paper.targets.hard;
        expect(total).toBe(20);
        expect(paper.durationMinutes).toBeGreaterThan(0);
      }
    }
  });

  it('math papers 2 lean harder than papers 1', () => {
    for (const courseId of ['math-y7', 'math-y8', 'math-y9', 'math-dp-ai']) {
      const p1 = getExamPaper(courseId, 'paper-1')!;
      const p2 = getExamPaper(courseId, 'paper-2')!;
      expect(p2.targets.hard).toBeGreaterThan(p1.targets.hard);
    }
  });

  it('returns undefined for unknown papers and empty for unknown courses', () => {
    expect(getExamPaper('math-y7', 'paper-9')).toBeUndefined();
    expect(getExamPapers('nope')).toEqual([]);
  });
});

describe('buildExamQuestions', () => {
  it('builds a full deterministic non-calculator set', () => {
    const a = buildExamQuestions('math-y7', 'paper-1');
    expect(a).toHaveLength(20);
    expect(a.every((q) => !q.question.calculator)).toBe(true);
    const b = buildExamQuestions('math-y7', 'paper-1');
    expect(a.map((q) => q.question.id)).toEqual(b.map((q) => q.question.id));
  });

  it('hits the band targets for a standard paper', () => {
    const set = buildExamQuestions('eng-ks3', 'paper-1');
    const count = (d: string) => set.filter((q) => (q.question.difficulty ?? 'medium') === d).length;
    expect(count('easy')).toBe(5);
    expect(count('medium')).toBe(9);
    expect(count('hard')).toBe(6);
  });

  it('differs between papers of the same course', () => {
    const p1 = buildExamQuestions('math-y8', 'paper-1').map((q) => q.question.id);
    const p2 = buildExamQuestions('math-y8', 'paper-2').map((q) => q.question.id);
    expect(p1).not.toEqual(p2);
  });

  it('returns an empty set for an unknown paper', () => {
    expect(buildExamQuestions('math-y7', 'paper-9')).toEqual([]);
  });

  it('examId composes course and paper', () => {
    expect(examId('math-y7', 'paper-1')).toBe('math-y7:paper-1');
  });
});

describe('getExamCourses', () => {
  it('lists all 13 courses with their papers', () => {
    const courses = getExamCourses();
    expect(courses).toHaveLength(13);
    expect(courses.every((c) => c.papers.length >= 1)).toBe(true);
  });
});
