'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { Question } from '@/content/types';

interface QuizGameProps {
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  questions: Question[];
  enableTimer?: boolean;
  timerSeconds?: number;
  onComplete: (correctCount: number, totalCount: number) => void;
}

export default function QuizGame({
  subtitle,
  backHref,
  backLabel = 'Back',
  questions,
  enableTimer = false,
  timerSeconds = 60,
  onComplete,
}: QuizGameProps) {
  const [shuffledQuestions] = useState(() =>
    questions.length > 0 ? [...questions].sort(() => Math.random() - 0.5) : []
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
    } else {
      setAnswerState('incorrect');
    }
    setShowExplanation(true);
  }, [answerState, currentQuestion]);

  const handleTimeout = useCallback(() => {
    if (answerState !== 'unanswered' || !currentQuestion) return;
    setSelectedIndex(-1);
    setAnswerState('incorrect');
    setShowExplanation(true);
  }, [answerState, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentIndex < shuffledQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAnswerState('unanswered');
      setShowExplanation(false);
      setTimeLeft(timerSeconds);
    } else if (!isComplete) {
      onComplete(correctCount, shuffledQuestions.length);
      setIsComplete(true);
    }
  }, [currentIndex, isComplete, correctCount, shuffledQuestions.length, timerSeconds, onComplete]);

  // Timer effect
  useEffect(() => {
    if (!enableTimer || answerState !== 'unanswered' || isComplete || !currentQuestion) return;

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
  }, [enableTimer, timerSeconds, currentIndex, answerState, isComplete, currentQuestion, handleTimeout]);

  if (shuffledQuestions.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">No questions available.</p>
        <Link href={backHref} className="mt-4 inline-block text-sm text-blue-600">← Back</Link>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="text-5xl mb-4">{stars >= 3 ? '🎉' : stars >= 2 ? '👍' : stars >= 1 ? '📚' : '💪'}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
        {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}
        <div className="text-4xl font-black text-blue-600 mb-2">{scorePercent}%</div>
        <div className="flex justify-center gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`text-2xl ${i < stars ? 'text-yellow-500' : 'text-gray-300'}`}>
              {i < stars ? '★' : '☆'}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {correctCount} out of {shuffledQuestions.length} correct
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setCurrentIndex(0); setSelectedIndex(null); setAnswerState('unanswered'); setCorrectCount(0); setIsComplete(false); setShowExplanation(false); setTimeLeft(timerSeconds); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            Try Again
          </button>
          <Link href={backHref}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-sm text-blue-600 shrink-0">← Back</Link>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{currentIndex + 1}/{shuffledQuestions.length}</span>
      </div>

      {/* Question */}
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{currentQuestion.stem}</h2>
        </div>

        {/* Timer */}
        {enableTimer && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Time remaining</span>
              <span className={`font-semibold ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-700'}`}>{timeLeft}s</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {currentQuestion.choices.map((choice, i) => {
            let borderColor = 'border-gray-200';
            let bgColor = 'bg-white hover:bg-gray-50';
            if (answerState !== 'unanswered') {
              if (i === currentQuestion.correctIndex) {
                borderColor = 'border-green-500';
                bgColor = 'bg-green-50';
              } else if (i === selectedIndex && answerState === 'incorrect') {
                borderColor = 'border-red-500';
                bgColor = 'bg-red-50';
              }
            }
            return (
              <button key={i} onClick={() => handleSelect(i)}
                disabled={answerState !== 'unanswered'}
                className={`w-full text-left p-3 rounded-xl border-2 ${borderColor} ${bgColor} transition-all text-sm ${answerState === 'unanswered' ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}>
                <span className="font-medium text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                {choice}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className={`card p-4 mb-4 ${answerState === 'correct' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm font-semibold mb-1">{answerState === 'correct' ? '✅ Correct!' : '❌ Incorrect'}</p>
          <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
        </div>
      )}

      {/* Next button */}
      {showExplanation && (
        <button onClick={handleNext}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]">
          {currentIndex < shuffledQuestions.length - 1 ? 'Next Question →' : 'See Results'}
        </button>
      )}
    </div>
  );
}
