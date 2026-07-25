'use client';

import { useMemo, useRef } from 'react';
import { getSubject } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import { buildDiagnosticQuestions, getDiagnosticCourse } from '@/lib/diagnostics';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

interface DiagnosticRunnerClientProps {
  courseId: string;
}

export default function DiagnosticRunnerClient({ courseId }: DiagnosticRunnerClientProps) {
  const course = getDiagnosticCourse(courseId);
  const { recordAttempt } = useProgress();

  // Deterministic build (seeded by courseId) — safe to compute during SSR.
  const questions: MixedReviewQuestion[] = useMemo(
    () => buildDiagnosticQuestions(courseId),
    [courseId]
  );
  const byId = useMemo(() => new Map(questions.map((q) => [q.question.id, q])), [questions]);

  // Per-question outcomes, fanned out into per-topic attempts on completion so
  // the diagnostic seeds the weak-areas system immediately.
  const outcomes = useRef(new Map<string, boolean>());
  const recorded = useRef(false);

  const handleQuestionResult = (questionId: string, correct: boolean) => {
    outcomes.current.set(questionId, correct);
  };

  const handleComplete = () => {
    if (recorded.current) return;
    recorded.current = true;

    const perTopic = new Map<string, MixedReviewQuestion & { correct: number; total: number }>();
    for (const [questionId, correct] of outcomes.current) {
      const entry = byId.get(questionId);
      if (!entry) continue;
      const key = `${entry.subjectId}:${entry.topicId}`;
      const agg = perTopic.get(key) ?? { ...entry, correct: 0, total: 0 };
      agg.total += 1;
      if (correct) agg.correct += 1;
      perTopic.set(key, agg);
    }
    for (const agg of perTopic.values()) {
      recordAttempt(
        agg.topicId,
        agg.subjectId,
        agg.topicTitle,
        getSubject(agg.subjectId)?.name ?? agg.subjectId,
        agg.correct,
        agg.total
      );
    }
  };

  if (!course || questions.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Diagnostic not found.</div>;
  }

  return (
    <QuizGame
      subtitle={`${course.title} diagnostic`}
      backHref="/diagnostics"
      backLabel="Back to Diagnostics"
      breadcrumbs={[{ href: '/', label: 'Home' }, { href: '/diagnostics', label: 'Diagnostics' }, { label: course.title }]}
      questions={questions.map((q) => q.question)}
      shuffleSeed={`diagnostic:${courseId}`}
      enableTimer={false}
      onQuestionResult={handleQuestionResult}
      onComplete={handleComplete}
    />
  );
}
