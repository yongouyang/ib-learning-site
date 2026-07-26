'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, RotateCcw, CheckSquare, Square, Sparkles } from 'lucide-react';
import type { FreeResponseQuestion, Paper } from '@/content/types';
import { useProgress } from '@/context/ProgressContext';
import { getCourse } from '@/lib/courses';
import { orderQuestionsByDifficulty } from '@/lib/quiz-utils';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import InlineMath from '@/components/InlineMath';
import { DIFFICULTY_CHIP_CLASSES } from '@/components/difficulty-chip';

interface PaperRunnerClientProps {
  paper: Paper;
}

interface QuestionOutcome {
  questionId: string;
  studentAnswer: string;
  /** Ticked markscheme points — the Phase 5 AI-marking payload shape. */
  ticks: boolean[];
}

export default function PaperRunnerClient({ paper }: PaperRunnerClientProps) {
  const course = getCourse(paper.courseId);
  const { recordExam } = useProgress();

  // Easy -> hard with deterministic intra-band shuffle (same rule as MC quizzes).
  const ordered = useMemo(
    () => orderQuestionsByDifficulty(paper.questions, paper.id),
    [paper]
  );
  const totalMarks = useMemo(
    () => paper.questions.reduce((sum, q) => sum + q.marks, 0),
    [paper]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<'answer' | 'mark'>('answer');
  const [answer, setAnswer] = useState('');
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [outcomes, setOutcomes] = useState<QuestionOutcome[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState((paper.durationMinutes ?? 0) * 60);

  // Phase 5 — AI marking. The button only appears when the route reports a
  // configured provider; students can always override the AI's ticks.
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiComments, setAiComments] = useState<string[] | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/feedback')
      .then((res) => res.json())
      .then((json) => setAiConfigured(Boolean(json.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  const startedAt = useRef(Date.now());
  const recorded = useRef(false);
  const outcomesRef = useRef<QuestionOutcome[]>([]);
  outcomesRef.current = outcomes;

  const question: FreeResponseQuestion | undefined = ordered[currentIndex];
  const marksAchieved = outcomesRef.current.reduce(
    (sum, o) => sum + o.ticks.filter(Boolean).length,
    0
  );

  const finish = useCallback(
    (finalOutcomes: QuestionOutcome[]) => {
      if (recorded.current) return;
      recorded.current = true;
      const achieved = finalOutcomes.reduce((sum, o) => sum + o.ticks.filter(Boolean).length, 0);
      recordExam({
        examId: paper.id,
        date: new Date().toISOString(),
        correctCount: achieved,
        totalCount: totalMarks,
        secondsUsed: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setIsComplete(true);
    },
    [paper.id, recordExam, totalMarks]
  );

  // Overall countdown (papers with a duration); on expiry unattempted
  // questions score zero.
  useEffect(() => {
    if (!paper.durationMinutes || isComplete) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finish(outcomesRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paper.durationMinutes, isComplete, finish]);

  const handleCheck = () => {
    setTicks(new Array(question!.marks).fill(false));
    setStage('mark');
  };

  const resetAiState = () => {
    setAiState('idle');
    setAiError(null);
    setAiComments(null);
    setAiFeedback(null);
  };

  const handleMarkWithAi = async () => {
    if (!question || aiState === 'loading') return;
    setAiState('loading');
    setAiError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stem: question.stem,
          markscheme: question.markscheme,
          modelAnswer: question.modelAnswer,
          studentAnswer: answer,
          maxMarks: question.marks,
        }),
      });
      if (!res.ok) {
        setAiError(
          res.status === 429
            ? 'The AI marker is busy — try again in a minute, or mark yourself below.'
            : 'The AI marker is unavailable right now — mark yourself below.'
        );
        setAiState('error');
        return;
      }
      const json = await res.json();
      setTicks(json.perPoint.map((p: { awarded: boolean }) => p.awarded));
      setAiComments(json.perPoint.map((p: { comment: string }) => p.comment));
      setAiFeedback(json.feedback);
      setAiState('idle');
    } catch {
      setAiError('The AI marker is unavailable right now — mark yourself below.');
      setAiState('error');
    }
  };

  const handleToggle = (index: number) => {
    setTicks((prev) => prev.map((t, i) => (i === index ? !t : t)));
  };

  const handleNext = () => {
    const outcome: QuestionOutcome = { questionId: question!.id, studentAnswer: answer, ticks };
    const nextOutcomes = [...outcomes, outcome];
    setOutcomes(nextOutcomes);
    if (currentIndex < ordered.length - 1) {
      setCurrentIndex((i) => i + 1);
      setStage('answer');
      setAnswer('');
      setTicks([]);
      resetAiState();
    } else {
      finish(nextOutcomes);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setStage('answer');
    setAnswer('');
    setTicks([]);
    setOutcomes([]);
    setIsComplete(false);
    setTimeLeft((paper.durationMinutes ?? 0) * 60);
    startedAt.current = Date.now();
    recorded.current = false;
    resetAiState();
  };

  const backHref = '/papers';

  if (!question) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No questions available.</p>
        <Link href={backHref} className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    );
  }

  if (isComplete) {
    const percent = totalMarks > 0 ? Math.round((marksAchieved / totalMarks) * 100) : 0;
    const stars = percent >= 90 ? 3 : percent >= 70 ? 2 : percent >= 40 ? 1 : 0;
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">{stars >= 3 ? '🎉' : stars >= 2 ? '👍' : stars >= 1 ? '📚' : '💪'}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Paper Complete!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{course?.title} · {paper.title}</p>
        <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">{percent}%</div>
        <div className="flex justify-center gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`text-2xl ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
              {i < stars ? '★' : '☆'}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {marksAchieved} out of {totalMarks} marks
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          <Link href={backHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Back to Papers
          </Link>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + (stage === 'mark' ? 0.5 : 0)) / ordered.length) * 100;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <Breadcrumbs items={[
        { href: '/', label: 'Home' },
        { href: '/papers', label: 'Practice Papers' },
        { label: `${course?.title ?? paper.courseId} ${paper.title}` },
      ]} />

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{ordered.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="card p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50"><InlineMath text={question.stem} /></h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {question.marks} mark{question.marks !== 1 ? 's' : ''}
              </span>
              {question.difficulty && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${DIFFICULTY_CHIP_CLASSES[question.difficulty]}`}>
                  {question.difficulty}
                </span>
              )}
            </div>
          </div>

          {paper.durationMinutes && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" /> Time remaining
                </span>
                <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timeLeft / ((paper.durationMinutes ?? 1) * 60)) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>
          )}

          {stage === 'answer' ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="Write your answer here — show your working."
                aria-label="Your answer"
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none resize-y"
              />
              <button
                onClick={handleCheck}
                disabled={answer.trim().length === 0}
                className="mt-3 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check answer
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Model answer</p>
                <p className="text-sm text-gray-700 dark:text-gray-300"><InlineMath text={question.modelAnswer} /></p>
              </div>

              {aiConfigured && (
                <div className="mb-4">
                  {aiFeedback ? (
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 text-sm text-purple-900 dark:text-purple-200">
                      <p className="font-semibold inline-flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-4 h-4" /> AI feedback
                      </p>
                      <p>{aiFeedback}</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleMarkWithAi}
                      disabled={aiState === 'loading'}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Sparkles className="w-4 h-4" />
                      {aiState === 'loading' ? 'Marking…' : 'Mark with AI'}
                    </button>
                  )}
                  {aiState === 'error' && aiError && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{aiError}</p>
                  )}
                </div>
              )}

              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Mark yourself — tick each point you achieved
                </p>
                <div className="space-y-1.5">
                  {question.markscheme.map((point, i) => (
                    <div key={i}>
                      <button
                        onClick={() => handleToggle(i)}
                        aria-pressed={ticks[i]}
                        className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border-2 transition-colors text-sm ${
                          ticks[i]
                            ? 'border-green-500 bg-green-50 dark:bg-green-950 text-gray-900 dark:text-gray-100'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {ticks[i]
                          ? <CheckSquare className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                          : <Square className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />}
                        <span><InlineMath text={point} /></span>
                      </button>
                      {aiComments?.[i] && (
                        <p className="mt-1 ml-1 text-xs text-purple-700 dark:text-purple-300">
                          <Sparkles className="w-3 h-3 inline mr-1" aria-hidden="true" />
                          {aiComments[i]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {stage === 'mark' && (
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          {currentIndex < ordered.length - 1 ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              Next Question ({ticks.filter(Boolean).length}/{question.marks} marks) <ArrowRight className="w-4 h-4" />
            </span>
          ) : (
            `See Results (${ticks.filter(Boolean).length}/${question.marks} marks)`
          )}
        </button>
      )}
    </div>
  );
}
