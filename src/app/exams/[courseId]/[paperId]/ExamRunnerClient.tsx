'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import QuizGame from '@/components/QuizGame';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import { LockedQuizPreview } from '@/components/LockedQuizPreview';
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
  const { has, loaded } = useEntitlements();

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

  const breadcrumbs = [
    { href: '/', label: 'Home' },
    { href: '/exams', label: 'Mock Exams' },
    { label: `${course.title} ${paper.title}` },
  ];

  // Phase E3 — timed mock mode is Premium (entitlement-policy §Tier 2). When
  // locked, render a STATIC summary instead of the live QuizGame: a countdown
  // ticking behind the lock reads as "the exam started without you", and the
  // tease card needs the quiz's max-w-lg container (it has none of its own).
  if (loaded && !has('exam-sets-full')) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{course.title} · {paper.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
            {paper.durationMinutes} min · {questions.length} questions · Non-calculator
          </p>
        </div>
        <LockedFeature
          feature="exam-sets-full"
          title="Timed mock mode"
          benefit="Premium unlocks timed mock exams for every course — one countdown for the whole paper, just like the real thing."
        >
          <LockedQuizPreview questions={questions.map((q) => q.question)} />
        </LockedFeature>
      </div>
    );
  }

  return (
    <QuizGame
      subtitle={`${course.title} · ${paper.title} · Non-calculator`}
      backHref="/exams"
      backLabel="Back to Exams"
      breadcrumbs={breadcrumbs}
      questions={questions.map((q) => q.question)}
      shuffleSeed={examId(courseId, paperId)}
      enableTimer={true}
      timerMode="overall"
      timerSeconds={paper.durationMinutes * 60}
      onComplete={handleComplete}
    />
  );
}
