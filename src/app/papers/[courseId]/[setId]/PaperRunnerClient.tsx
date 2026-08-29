'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, RotateCcw, CheckSquare, Square, Sparkles } from 'lucide-react';
import type { FreeResponseQuestion, Paper } from '@/content/types';
import { useProgress } from '@/context/ProgressContext';
import { useAuth } from '@/context/AuthContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { AI_MARK_FREE_MONTHLY_QUOTA } from '@/lib/entitlements/features';
import { isFreePaperSet } from '@/lib/entitlements/exam-access';
import { loginHref } from '@/lib/safe-redirect';
import { getCourse } from '@/lib/courses';
import { orderQuestionsByDifficulty } from '@/lib/quiz-utils';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import InlineMath from '@/components/InlineMath';
import { DIFFICULTY_CHIP_CLASSES } from '@/components/difficulty-chip';
import { trackEvent } from '@/lib/analytics';

interface PaperRunnerClientProps {
  paper: Paper;
}

interface QuestionOutcome {
  questionId: string;
  studentAnswer: string;
  /** Ticked markscheme points — the Phase 5 AI-marking payload shape. */
  ticks: boolean[];
  /** Phase 5 AI-marking details, present after "Mark with AI" succeeded. */
  aiComments?: string[];
  aiFeedback?: string;
}

// Phase E3 — "first set per course free" (entitlement-policy §Tier 2): later
// sets stay visible behind the LockedFeature premium tease (UX-only gate). The
// wrapper keeps every hook inside the runner itself.
export default function PaperRunnerClient({ paper }: PaperRunnerClientProps) {
  if (isFreePaperSet(paper.id)) return <PaperRunner paper={paper} />;
  return (
    <LockedFeature
      feature="exam-sets-full"
      title="Full exam sets"
      benefit="Set 1 is free — Premium unlocks every set for this course, upper ladder levels and timed mock mode."
    >
      <PaperRunner paper={paper} />
    </LockedFeature>
  );
}

// Two phases, like a real exam: a TIMED answering phase (free navigation,
// answers editable until submit) followed by an UNTIMED review phase (model
// answer, AI marking, self-ticks). The clock never runs during review, so
// reading feedback and self-marking don't eat exam time.
function PaperRunner({ paper }: PaperRunnerClientProps) {
  const course = getCourse(paper.courseId);
  const { recordExam } = useProgress();
  const { user, loaded: authLoaded } = useAuth();
  const { has } = useEntitlements();
  // Return-URL for the AI-marking sign-in prompt — after signing in the user
  // lands back on THIS paper, not at `/`.
  const pathname = usePathname();

  // Easy -> hard with deterministic intra-band shuffle (same rule as MC quizzes).
  const ordered = useMemo(
    () => orderQuestionsByDifficulty(paper.questions, paper.id),
    [paper]
  );
  const totalMarks = useMemo(
    () => paper.questions.reduce((sum, q) => sum + q.marks, 0),
    [paper]
  );

  const [phase, setPhase] = useState<'answering' | 'review'>('answering');
  const [isComplete, setIsComplete] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => ordered.map(() => ''));
  // Review-phase data, keyed by question id — created lazily on first visit.
  const [outcomes, setOutcomes] = useState<Record<string, QuestionOutcome>>({});
  const [timeLeft, setTimeLeft] = useState((paper.durationMinutes ?? 0) * 60);
  const [timeExpired, setTimeExpired] = useState(false);

  // Phase 5 — AI marking (review phase only). The button only appears when
  // the route reports a configured provider; students can always override
  // the AI's ticks.
  // Phase E2 — login gate + monthly quota: logged-out sessions get a sign-in
  // prompt, an exhausted quota gets the premium tease, and a logged-in free
  // session sees "N marks left this month" from the GET quota state.
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiResetAt, setAiResetAt] = useState<string | null>(null);
  // Account-level gate discovered from a POST (401/429-quota) — persists
  // across questions within the review (it's not per-question state).
  const [aiGate, setAiGate] = useState<'login' | 'quota' | null>(null);

  useEffect(() => {
    fetch('/api/feedback')
      .then((res) => res.json())
      .then((json) => {
        setAiConfigured(Boolean(json.configured));
        if (typeof json.remaining === 'number') setAiRemaining(json.remaining);
        if (typeof json.resetAt === 'string') setAiResetAt(json.resetAt);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    trackEvent('exam_started', { courseId: paper.courseId, paperId: paper.id });
  }, [paper.courseId, paper.id]);

  const startedAt = useRef(Date.now());
  const recorded = useRef(false);
  const answeringSeconds = useRef(0);

  const question: FreeResponseQuestion | undefined = ordered[currentIndex];

  const blankOutcome = useCallback(
    (index: number): QuestionOutcome => ({
      questionId: ordered[index].id,
      studentAnswer: answers[index],
      ticks: new Array(ordered[index].marks).fill(false),
    }),
    [ordered, answers]
  );

  const currentOutcome: QuestionOutcome | undefined = question
    ? outcomes[question.id] ?? blankOutcome(currentIndex)
    : undefined;

  // Quota-reset date for the exhausted-state tease ("They reset on 1 September").
  const aiResetLabel = useMemo(() => {
    if (!aiResetAt) return null;
    const d = new Date(aiResetAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  }, [aiResetAt]);

  const updateOutcome = (qid: string, updater: (o: QuestionOutcome) => QuestionOutcome) => {
    setOutcomes((prev) => {
      const idx = ordered.findIndex((q) => q.id === qid);
      const base = prev[qid] ?? blankOutcome(idx);
      return { ...prev, [qid]: updater(base) };
    });
  };

  const marksAchieved = ordered.reduce(
    (sum, q) => sum + (outcomes[q.id]?.ticks.filter(Boolean).length ?? 0),
    0
  );

  // Lock the answers and enter the untimed review phase — either from the
  // student's submit or from the clock running out.
  const submitAnswers = useCallback((expired: boolean) => {
    answeringSeconds.current = Math.round((Date.now() - startedAt.current) / 1000);
    setTimeExpired(expired);
    setPhase('review');
    setCurrentIndex(0);
    setAiState('idle');
    setAiError(null);
  }, []);

  // Overall countdown, answering phase only; on expiry answers lock as-is.
  useEffect(() => {
    if (!paper.durationMinutes || phase !== 'answering' || isComplete) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [paper.durationMinutes, phase, isComplete]);

  useEffect(() => {
    if (paper.durationMinutes && phase === 'answering' && timeLeft <= 0) {
      submitAnswers(true);
    }
  }, [paper.durationMinutes, phase, timeLeft, submitAnswers]);

  const finishReview = useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    const achieved = ordered.reduce(
      (sum, q) => sum + (outcomes[q.id]?.ticks.filter(Boolean).length ?? 0),
      0
    );
    recordExam({
      examId: paper.id,
      date: new Date().toISOString(),
      correctCount: achieved,
      totalCount: totalMarks,
      secondsUsed: answeringSeconds.current,
    });
    trackEvent('exam_completed', {
      courseId: paper.courseId,
      paperId: paper.id,
      correctCount: achieved,
      totalCount: totalMarks,
      secondsUsed: answeringSeconds.current,
      timedOut: timeExpired,
    });
    setIsComplete(true);
  }, [ordered, outcomes, paper.id, paper.courseId, recordExam, totalMarks, timeExpired]);

  const handleMarkWithAi = async () => {
    if (!question || aiState === 'loading') return;
    const studentAnswer = (outcomes[question.id] ?? blankOutcome(currentIndex)).studentAnswer;
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
          studentAnswer,
          maxMarks: question.marks,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          // Session missing/expired mid-review — swap to the sign-in prompt.
          setAiGate('login');
          setAiState('idle');
          return;
        }
        if (res.status === 429) {
          const body = (await res.json().catch(() => null)) as { error?: string; resetAt?: string } | null;
          if (body?.error === 'quota_exceeded') {
            // Monthly quota spent — upgrade tease (not "try again later").
            if (body.resetAt) setAiResetAt(body.resetAt);
            setAiRemaining(0);
            setAiGate('quota');
            setAiState('idle');
            return;
          }
        }
        setAiError(
          res.status === 429
            ? 'The AI marker is busy — try again in a minute, or mark yourself below.'
            : 'The AI marker is unavailable right now — mark yourself below.'
        );
        setAiState('error');
        return;
      }
      const json = await res.json();
      // The server charged one mark — reflect it without a refetch.
      setAiRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
      updateOutcome(question.id, (o) => ({
        ...o,
        ticks: json.perPoint.map((p: { awarded: boolean }) => p.awarded),
        aiComments: json.perPoint.map((p: { comment: string }) => p.comment),
        aiFeedback: json.feedback,
      }));
      setAiState('idle');
      trackEvent('paper_marked_with_ai', {
        courseId: paper.courseId,
        paperId: paper.id,
        questionCount: 1,
        totalMarks: question.marks,
      });
    } catch {
      setAiError('The AI marker is unavailable right now — mark yourself below.');
      setAiState('error');
    }
  };

  const handleToggle = (index: number) => {
    if (!question) return;
    updateOutcome(question.id, (o) => ({
      ...o,
      ticks: o.ticks.map((t, i) => (i === index ? !t : t)),
    }));
  };

  const handleRetry = () => {
    setPhase('answering');
    setCurrentIndex(0);
    setAnswers(ordered.map(() => ''));
    setOutcomes({});
    setIsComplete(false);
    setTimeLeft((paper.durationMinutes ?? 0) * 60);
    setTimeExpired(false);
    startedAt.current = Date.now();
    answeringSeconds.current = 0;
    recorded.current = false;
    setAiState('idle');
    setAiError(null);
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

  const progress = ((currentIndex + 1) / ordered.length) * 100;
  const answeredCount = answers.filter((a) => a.trim().length > 0).length;
  const isLast = currentIndex === ordered.length - 1;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <Breadcrumbs items={[
        { href: '/', label: 'Home' },
        { href: '/papers', label: 'Practice Papers' },
        { label: `${course?.title ?? paper.courseId} ${paper.title}` },
      ]} currentAsHeading />

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

      {phase === 'review' && timeExpired && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
          Time&apos;s up — your answers were locked as-is. Review each question below.
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${phase}-${question.id}`}
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

          {phase === 'answering' && paper.durationMinutes && (
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

          {phase === 'answering' ? (
            <>
              <textarea
                value={answers[currentIndex]}
                onChange={(e) =>
                  setAnswers((prev) => prev.map((a, i) => (i === currentIndex ? e.target.value : a)))
                }
                rows={5}
                placeholder="Write your answer here — show your working."
                aria-label="Your answer"
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none resize-y"
              />
              {isLast && answeredCount < ordered.length && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {ordered.length - answeredCount} question{ordered.length - answeredCount !== 1 ? 's' : ''} still unanswered.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Your answer</p>
                {currentOutcome!.studentAnswer.trim() ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{currentOutcome!.studentAnswer}</p>
                ) : (
                  <p className="text-sm italic text-gray-400 dark:text-gray-500">(no answer)</p>
                )}
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Model answer</p>
                <p className="text-sm text-gray-700 dark:text-gray-300"><InlineMath text={question.modelAnswer} /></p>
              </div>

              {aiConfigured && (
                <div className="mb-4">
                  {currentOutcome!.aiFeedback ? (
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 text-sm text-purple-900 dark:text-purple-200">
                      <p className="font-semibold inline-flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-4 h-4" /> AI feedback
                      </p>
                      <p>{currentOutcome!.aiFeedback}</p>
                    </div>
                  ) : aiGate === 'login' || (authLoaded && !user) ? (
                    // E2 login gate — the prompt is the whole AI row; self-marking below is untouched.
                    <Link
                      href={loginHref(pathname ?? '/')}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Sign in to use AI marking — {AI_MARK_FREE_MONTHLY_QUOTA} free marks/month
                    </Link>
                  ) : aiGate === 'quota' || (aiRemaining === 0 && !has('ai-marking-unlimited')) ? (
                    // E2 quota exhausted — premium tease in the LockedFeature copy style.
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 text-sm text-purple-900 dark:text-purple-200 text-center">
                      <p className="font-semibold mb-1">You&apos;ve used all {AI_MARK_FREE_MONTHLY_QUOTA} free AI marks this month</p>
                      <p>
                        {aiResetLabel ? <>They reset on {aiResetLabel}. </> : null}
                        Premium gives you unlimited AI marking.
                      </p>
                      <Link
                        href="/pricing"
                        className="mt-2 inline-flex items-center justify-center rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                      >
                        See Premium plans
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleMarkWithAi}
                      disabled={aiState === 'loading'}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Sparkles className="w-4 h-4" />
                      {aiState === 'loading' ? 'Marking…' : 'Mark with AI'}
                    </button>
                  )}
                  {/* E2 quota state — under the button AND the feedback card,
                      so a successful mark visibly decrements it. (aiRemaining is
                      only ever set from an authenticated GET.) */}
                  {aiRemaining !== null &&
                    !has('ai-marking-unlimited') &&
                    aiGate === null &&
                    aiRemaining > 0 && (
                      <p className="mt-1.5 text-xs text-center text-gray-500 dark:text-gray-400">
                        {aiRemaining === 1 ? '1 mark' : `${aiRemaining} marks`} left this month
                      </p>
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
                        aria-pressed={currentOutcome!.ticks[i] ?? false}
                        className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border-2 transition-colors text-sm ${
                          currentOutcome!.ticks[i]
                            ? 'border-green-500 bg-green-50 dark:bg-green-950 text-gray-900 dark:text-gray-100'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {currentOutcome!.ticks[i]
                          ? <CheckSquare className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                          : <Square className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />}
                        <span><InlineMath text={point} /></span>
                      </button>
                      {currentOutcome!.aiComments?.[i] && (
                        <p className="mt-1 ml-1 text-xs text-purple-700 dark:text-purple-300">
                          <Sparkles className="w-3 h-3 inline mr-1" aria-hidden="true" />
                          {currentOutcome!.aiComments[i]}
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

      {/* Navigation — outside the animated card so buttons stay put. */}
      <div className="flex gap-3">
        {currentIndex > 0 && (
          <button
            onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setAiState('idle'); setAiError(null); }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
        )}
        {phase === 'answering' ? (
          isLast ? (
            <button
              onClick={() => submitAnswers(false)}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
            >
              Submit &amp; Review
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(i + 1, ordered.length - 1))}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                Next Question <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          )
        ) : (
          <button
            onClick={() => {
              if (isLast) {
                finishReview();
              } else {
                setCurrentIndex((i) => Math.min(i + 1, ordered.length - 1));
                setAiState('idle');
                setAiError(null);
              }
            }}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            {isLast ? (
              `See Results (${currentOutcome!.ticks.filter(Boolean).length}/${question.marks} marks)`
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                Next Question ({currentOutcome!.ticks.filter(Boolean).length}/{question.marks} marks) <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
