'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, RotateCcw, Calculator } from 'lucide-react';
import type { Question } from '@/content/types';
import { seededShuffle } from '@/lib/quiz-utils';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import InlineMath from './InlineMath';

const DIFFICULTY_CHIP_CLASSES: Record<string, string> = {
  easy: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
  medium: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  hard: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
};

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
  /**
   * 'per-question' (default): countdown resets each question, timeout marks the
   * current question incorrect. 'overall': one countdown for the whole quiz
   * (exam mode) — on expiry all unanswered questions count as incorrect and
   * the quiz auto-completes.
   */
  timerMode?: 'per-question' | 'overall';
  shuffleSeed?: string;
  onComplete: (correctCount: number, totalCount: number) => void;
  /** Called once per answered question (correct=false on timeout). */
  onQuestionResult?: (questionId: string, correct: boolean) => void;
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
}: QuizGameProps) {
  const [shuffledQuestions] = useState(() =>
    questions.length > 0 ? seededShuffle([...questions], shuffleSeed) : []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'unanswered' | 'correct' | 'incorrect'>('unanswered');
  const [correctCount, setCorrectCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  const currentQuestion = shuffledQuestions[currentIndex];
  const progress = shuffledQuestions.length > 0 ? ((currentIndex + (isComplete ? 1 : 0)) / shuffledQuestions.length) * 100 : 0;
  const scorePercent = shuffledQuestions.length > 0 ? Math.round((correctCount / shuffledQuestions.length) * 100) : 0;
  const stars = scorePercent >= 90 ? 3 : scorePercent >= 70 ? 2 : scorePercent >= 40 ? 1 : 0;

  const handleSelect = useCallback((index: number) => {
    if (answerState !== 'unanswered' || !currentQuestion) return;
    setSelectedIndex(index);
    if (index === currentQuestion.correctIndex) {
      setAnswerState('correct');
      setCorrectCount((c) => c + 1);
      onQuestionResult?.(currentQuestion.id, true);
    } else {
      setAnswerState('incorrect');
      onQuestionResult?.(currentQuestion.id, false);
    }
    setShowExplanation(true);
  }, [answerState, currentQuestion, onQuestionResult]);

  const handleTimeout = useCallback(() => {
    if (answerState !== 'unanswered' || !currentQuestion) return;
    setSelectedIndex(-1);
    setAnswerState('incorrect');
    onQuestionResult?.(currentQuestion.id, false);
    setShowExplanation(true);
  }, [answerState, currentQuestion, onQuestionResult]);

  const handleNext = useCallback(() => {
    if (currentIndex < shuffledQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAnswerState('unanswered');
      setShowExplanation(false);
      if (timerMode === 'per-question') setTimeLeft(timerSeconds);
    } else if (!isComplete) {
      onComplete(correctCount, shuffledQuestions.length);
      setIsComplete(true);
    }
  }, [currentIndex, isComplete, correctCount, shuffledQuestions.length, timerSeconds, timerMode, onComplete]);

  // Overall mode (exams): the countdown never resets; on expiry every
  // unanswered question counts as incorrect and the quiz auto-completes.
  const handleOverallTimeout = useCallback(() => {
    if (isComplete) return;
    for (let i = currentIndex; i < shuffledQuestions.length; i++) {
      onQuestionResult?.(shuffledQuestions[i].id, false);
    }
    onComplete(correctCount, shuffledQuestions.length);
    setIsComplete(true);
  }, [isComplete, currentIndex, shuffledQuestions, correctCount, onComplete, onQuestionResult]);

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

  if (shuffledQuestions.length === 0) {
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
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">{stars >= 3 ? '🎉' : stars >= 2 ? '👍' : stars >= 1 ? '📚' : '💪'}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Quiz Complete!</h1>
        {subtitle && <p className="text-gray-500 dark:text-gray-400 mb-6">{subtitle}</p>}
        <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">{scorePercent}%</div>
        <div className="flex justify-center gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`text-2xl ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
              {i < stars ? '★' : '☆'}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {correctCount} out of {shuffledQuestions.length} correct
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setCurrentIndex(0); setSelectedIndex(null); setAnswerState('unanswered'); setCorrectCount(0); setIsComplete(false); setShowExplanation(false); setTimeLeft(timerSeconds); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          <Link href={backHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        {!breadcrumbs && (
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 shrink-0">
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
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{currentIndex + 1}/{shuffledQuestions.length}</span>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      {showExplanation && (
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          {currentIndex < shuffledQuestions.length - 1 ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              Next Question <ArrowRight className="w-4 h-4" />
            </span>
          ) : 'See Results'}
        </button>
      )}
    </div>
  );
}
