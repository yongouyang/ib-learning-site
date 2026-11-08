'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, RotateCcw, Calculator, Shuffle } from 'lucide-react';
import type { Question, QuestionResult, SubjectId } from '@/content/types';
import AiHelpPanel from './AiHelpPanel';
import { seededShuffle } from '@/lib/quiz-utils';
import { DIFFICULTY_CHIP_CLASSES } from './difficulty-chip';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import InlineMath from './InlineMath';

function QuestionBadges({ question }: { question: Question }) {
  if (!question.difficulty && !question.calculator) return null;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {question.difficulty && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${DIFFICULTY_CHIP_CLASSES[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
      )}
      {question.calculator && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          <Calculator className="w-3 h-3" aria-hidden="true" />
          Calculator
        </span>
      )}
    </div>
  );
}

interface QuizGameProps {
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  questions: Question[];
  enableTimer?: boolean;
  timerSeconds?: number;
  timerMode?: 'per-question' | 'overall';
  shuffleSeed?: string;
  onComplete: (correctCount: number, totalCount: number, timedOut?: boolean) => void;
  onQuestionResult?: (questionId: string, correct: boolean, questionNumber: number, totalCount: number, result: QuestionResult) => void;
  onNewSet?: () => void;
  /** Draw new questions practising the same skills as the supplied mistakes. */
  onSimilarQuestions?: (mistakes: Question[]) => void;
  getHelpContext?: (question: Question) => { subjectId: SubjectId; topicId: string };
  onContinue?: { label: string; onClick: () => void };
  onBack?: () => void;
}

export default function QuizGame({
  subtitle,
  backHref,
  backLabel = 'Back',
  breadcrumbs,
  questions,
  enableTimer = false,
  timerSeconds = 60,
  timerMode = 'per-question',
  shuffleSeed,
  onComplete,
  onQuestionResult,
  onNewSet,
  onSimilarQuestions,
  getHelpContext,
  onContinue,
  onBack,
}: QuizGameProps) {
  const [sessionQuestions, setSessionQuestions] = useState(() =>
    questions.length > 0 ? seededShuffle([...questions], shuffleSeed) : []
  );
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'unanswered' | 'correct' | 'incorrect'>('unanswered');
  const [correctCount, setCorrectCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [isComplete, sessionQuestions]);

  useEffect(() => {
    if (!showExplanation) return;
    const timer = window.setTimeout(() => {
      nextButtonRef.current?.scrollIntoView?.({ block: 'end', behavior: 'auto' });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [showExplanation, currentIndex]);

  const currentQuestion = sessionQuestions[currentIndex];
  const progress = sessionQuestions.length > 0 ? ((currentIndex + (isComplete ? 1 : 0)) / sessionQuestions.length) * 100 : 0;
  const scorePercent = sessionQuestions.length > 0 ? Math.round((correctCount / sessionQuestions.length) * 100) : 0;
  const stars = scorePercent >= 90 ? 3 : scorePercent >= 70 ? 2 : scorePercent >= 40 ? 1 : 0;
  const mistakes = results.filter((result) => !result.correct && result.question);

  const recordResult = useCallback((question: Question, correct: boolean, choice: number, position: number) => {
    const result: QuestionResult = { questionId: question.id, correct, selectedIndex: choice, question };
    setResults((current) => [...current, result]);
    onQuestionResult?.(question.id, correct, position, sessionQuestions.length, result);
  }, [onQuestionResult, sessionQuestions.length]);

  const resetSession = (nextQuestions: Question[]) => {
    setSessionQuestions(nextQuestions);
    setResults([]);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswerState('unanswered');
    setCorrectCount(0);
    setIsComplete(false);
    setShowExplanation(false);
    setShowReview(false);
    setTimeLeft(timerSeconds);
  };

  const handleSelect = useCallback((index: number) => {
    if (answerState !== 'unanswered' || !currentQuestion) return;
    const correct = index === currentQuestion.correctIndex;
    setSelectedIndex(index);
    setAnswerState(correct ? 'correct' : 'incorrect');
    if (correct) setCorrectCount((c) => c + 1);
    recordResult(currentQuestion, correct, index, currentIndex + 1);
    setShowExplanation(true);
  }, [answerState, currentIndex, currentQuestion, recordResult]);

  const handleTimeout = useCallback(() => {
    if (answerState !== 'unanswered' || !currentQuestion) return;
    setSelectedIndex(-1);
    setAnswerState('incorrect');
    recordResult(currentQuestion, false, -1, currentIndex + 1);
    setShowExplanation(true);
  }, [answerState, currentIndex, currentQuestion, recordResult]);

  const handleNext = useCallback(() => {
    if (currentIndex < sessionQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAnswerState('unanswered');
      setShowExplanation(false);
      if (timerMode === 'per-question') setTimeLeft(timerSeconds);
    } else if (!isComplete) {
      onComplete(correctCount, sessionQuestions.length);
      setIsComplete(true);
    }
  }, [currentIndex, isComplete, correctCount, sessionQuestions.length, timerSeconds, timerMode, onComplete]);

  const handleOverallTimeout = useCallback(() => {
    if (isComplete) return;
    const firstUnanswered = answerState === 'unanswered' ? currentIndex : currentIndex + 1;
    for (let i = firstUnanswered; i < sessionQuestions.length; i++) {
      recordResult(sessionQuestions[i], false, -1, i + 1);
    }
    onComplete(correctCount, sessionQuestions.length, true);
    setIsComplete(true);
  }, [isComplete, answerState, currentIndex, sessionQuestions, correctCount, onComplete, recordResult]);

  // Timer effect — overall mode: single countdown for the whole quiz.
  useEffect(() => {
    if (!enableTimer || timerMode !== 'overall' || isComplete) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleOverallTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [enableTimer, timerMode, isComplete, handleOverallTimeout]);

  // Timer effect — per-question mode (default): countdown resets each question.
  useEffect(() => {
    if (!enableTimer || timerMode !== 'per-question' || answerState !== 'unanswered' || isComplete || !currentQuestion) return;

    setTimeLeft(timerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [enableTimer, timerMode, timerSeconds, currentIndex, answerState, isComplete, currentQuestion, handleTimeout]);

  if (sessionQuestions.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No questions available.</p>
        <Link href={backHref} onClick={onBack} className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 pb-8 md:py-8">
        <div className="text-center">
          <div aria-hidden="true" className="text-5xl mb-4">{stars >= 3 ? '🎉' : stars >= 2 ? '👍' : stars >= 1 ? '📚' : '💪'}</div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2 outline-none">Quiz Complete!</h1>
          {subtitle && <p className="text-gray-500 dark:text-gray-400 mb-6">{subtitle}</p>}
          <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">{scorePercent}%</div>
          <div aria-hidden="true" className="flex justify-center gap-1 mb-6">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`text-2xl ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
                {i < stars ? '★' : '☆'}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {correctCount} out of {sessionQuestions.length} correct
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {onContinue && (
              <button onClick={onContinue.onClick}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
                {onContinue.label} <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {mistakes.length > 0 && (
              <button onClick={() => resetSession(mistakes.map((result) => result.question!))}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
                <RotateCcw className="w-4 h-4" /> Retry mistakes ({mistakes.length})
              </button>
            )}
            {mistakes.length > 0 && onSimilarQuestions && (
              <button onClick={() => onSimilarQuestions(mistakes.map((result) => result.question!))}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
                <Shuffle className="w-4 h-4" /> Practise similar questions
              </button>
            )}
            <button onClick={() => resetSession(sessionQuestions)}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
            {onNewSet && (
              <button onClick={onNewSet}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <Shuffle className="w-4 h-4" /> New Question Set
              </button>
            )}
            <Link href={backHref} onClick={onBack}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {backLabel}
            </Link>
          </div>
        </div>

        <div className="mt-8 text-left">
          <button
            type="button"
            aria-expanded={showReview}
            onClick={() => setShowReview((visible) => !visible)}
            className="w-full card p-4 flex items-center justify-between font-semibold text-gray-900 dark:text-gray-50"
          >
            Review answers
            <span className="text-sm text-gray-500 dark:text-gray-400">{showReview ? 'Hide' : `${results.length} questions`}</span>
          </button>
          {showReview && (
            <div className="mt-3 space-y-3">
              <h2 className="sr-only">Review your answers</h2>
              {results.map((result, index) => {
                const question = result.question;
                if (!question) return null;
                return (
                  <article key={`${result.questionId}:${index}`} className="card p-4">
                    <div className="flex items-start gap-2 mb-3">
                      {result.correct
                        ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                        : <XCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />}
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                        <span className="text-gray-500 dark:text-gray-400">Question {index + 1}. </span>
                        <InlineMath text={question.stem} />
                      </h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className={result.correct ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        <span className="font-semibold">Your answer: </span>
                        {result.selectedIndex !== undefined && result.selectedIndex >= 0
                          ? <><span>{String.fromCharCode(65 + result.selectedIndex)}. </span><InlineMath text={question.choices[result.selectedIndex]} /></>
                          : 'No answer — time expired'}
                      </p>
                      {!result.correct && (
                        <p className="text-green-700 dark:text-green-300">
                          <span className="font-semibold">Correct answer: </span>
                          <span>{String.fromCharCode(65 + question.correctIndex)}. </span>
                          <InlineMath text={question.choices[question.correctIndex]} />
                        </p>
                      )}
                      <p className="pt-2 border-t border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                        <InlineMath text={question.explanation} />
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-16 pb-24 md:py-6 md:pb-6">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">Practice test</h1>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        {!breadcrumbs && (
          <Link href={backHref} onClick={onBack} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        )}
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{sessionQuestions.length}</span>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="card p-5 mb-4"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50"><InlineMath text={currentQuestion.stem} /></h2>
            <QuestionBadges question={currentQuestion} />
          </div>

          {/* Timer */}
          {enableTimer && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" /> {timerMode === 'overall' ? 'Exam time remaining' : 'Time remaining'}
                </span>
                <span className={`font-semibold ${timeLeft <= 10 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {timerMode === 'overall' ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : `${timeLeft}s`}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${timeLeft <= 10 ? 'bg-red-500' : 'bg-blue-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {currentQuestion.choices.map((choice, i) => {
              let borderColor = 'border-gray-200 dark:border-gray-700';
              let bgColor = 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800';
              if (answerState !== 'unanswered') {
                if (i === currentQuestion.correctIndex) {
                  borderColor = 'border-green-500';
                  bgColor = 'bg-green-50 dark:bg-green-950';
                } else if (i === selectedIndex && answerState === 'incorrect') {
                  borderColor = 'border-red-500';
                  bgColor = 'bg-red-50 dark:bg-red-950';
                }
              }
              return (
                <motion.button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={answerState !== 'unanswered'}
                  whileTap={answerState === 'unanswered' ? { scale: 0.98 } : undefined}
                  className={`w-full text-left p-3 rounded-xl border-2 ${borderColor} ${bgColor} transition-all text-sm ${answerState === 'unanswered' ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="font-medium text-gray-500 dark:text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                  <InlineMath text={choice} />
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Explanation */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`card p-4 mb-4 ${answerState === 'correct' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900'}`}
          >
            <p className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5">
              {answerState === 'correct' ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" /> Correct!</>
              ) : (
                <><XCircle className="w-4 h-4 text-red-600 dark:text-red-400" /> Incorrect</>
              )}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300"><InlineMath text={currentQuestion.explanation} /></p>
            {getHelpContext && (
              <AiHelpPanel key={currentIndex} question={currentQuestion} selectedIndex={selectedIndex} context={getHelpContext(currentQuestion)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      {showExplanation && (
        <button
          ref={nextButtonRef}
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          {currentIndex < sessionQuestions.length - 1 ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              Next Question <ArrowRight className="w-4 h-4" />
            </span>
          ) : 'See Results'}
        </button>
      )}
    </div>
  );
}
