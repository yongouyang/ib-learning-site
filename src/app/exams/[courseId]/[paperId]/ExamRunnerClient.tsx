'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import { buildExamQuestions, examId, getExamPaper } from '@/lib/exams';
import { getCourse } from '@/lib/courses';
import { trackEvent } from '@/lib/analytics';

interface ExamRunnerClientProps {
  courseId: string;
  paperId: string;
}

export default function ExamRunnerClient({ courseId, paperId }: ExamRunnerClientProps) {
  const course = getCourse(courseId);
  const paper = getExamPaper(courseId, paperId);
  const { recordExam } = useProgress();

  // Deterministic build (seeded by course+paper) — safe to compute during SSR.
  const questions = useMemo(() => buildExamQuestions(courseId, paperId), [courseId, paperId]);

  const startedAt = useRef(Date.now());
  const recorded = useRef(false);

  useEffect(() => {
    trackEvent('exam_started', { courseId, paperId });
  }, [courseId, paperId]);

  const handleComplete = (correctCount: number, totalCount: number, timedOut = false) => {
    if (recorded.current) return;
    recorded.current = true;
    const secondsUsed = Math.round((Date.now() - startedAt.current) / 1000);
    recordExam({
      examId: examId(courseId, paperId),
      date: new Date().toISOString(),
      correctCount,
      totalCount,
      secondsUsed,
    });
    trackEvent('exam_completed', { courseId, paperId, correctCount, totalCount, secondsUsed, timedOut });
  };

  if (!course || !paper || questions.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Exam not found.</div>;
  }

  return (
    <QuizGame
      subtitle={`${course.title} · ${paper.title} · Non-calculator`}
      backHref="/exams"
      backLabel="Back to Exams"
      breadcrumbs={[{ href: '/', label: 'Home' }, { href: '/exams', label: 'Mock Exams' }, { label: `${course.title} ${paper.title}` }]}
      questions={questions.map((q) => q.question)}
      shuffleSeed={examId(courseId, paperId)}
      enableTimer={true}
      timerMode="overall"
      timerSeconds={paper.durationMinutes * 60}
      onComplete={handleComplete}
    />
  );
}
