import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizGame from '@/components/QuizGame';
import type { Question } from '@/content/types';

const motionPropKeys = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'whileTap',
  'whileHover',
  'whileFocus',
  'whileDrag',
  'whileInView',
  'variants',
  'custom',
]);

function PlainElement({ tag, ...props }: { tag: string; [key: string]: unknown }) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionPropKeys.has(key)) {
      filtered[key] = value;
    }
  }
  return React.createElement(tag, filtered);
}

// Framer Motion animations don't run in jsdom; render plain elements instead.
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag: string) => (props: object) => <PlainElement tag={tag} {...props} />,
  }) as unknown as typeof import('framer-motion')['motion'],
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const questions: Question[] = [
  {
    id: 'q1',
    stem: 'What is 2 + 2?',
    choices: ['3', '4', '5', '6'],
    correctIndex: 1,
    explanation: 'Two plus two equals four.',
  },
  {
    id: 'q2',
    stem: 'What is the capital of France?',
    choices: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctIndex: 2,
    explanation: 'Paris is the capital of France.',
  },
];

describe('QuizGame', () => {
  beforeAll(() => {
    // Freeze shuffle so the first question in the array is always shown first.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('renders the question and Lucide icons', () => {
    render(<QuizGame questions={questions} backHref="/back" onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /What is 2 \+ 2\?/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back/i }).querySelector('svg')).toBeInTheDocument();
  });

  it('shows the timer and clock icon when enabled', () => {
    render(<QuizGame questions={questions} backHref="/back" onComplete={vi.fn()} enableTimer timerSeconds={30} />);

    expect(screen.getByText(/Time remaining/i)).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('moves to the next question after selecting an answer', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<QuizGame questions={questions} backHref="/back" onComplete={onComplete} />);

    const choices = screen.getAllByRole('button');
    // Choice B (index 1) is the correct answer for the first question.
    await user.click(choices[1]);
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next Question/i }));
    expect(screen.getByRole('heading', { name: /capital of France/i })).toBeInTheDocument();
  });

  it('calls onComplete after the final question', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<QuizGame questions={questions} backHref="/back" onComplete={onComplete} />);

    const firstQuestionChoices = screen.getAllByRole('button');
    await user.click(firstQuestionChoices[1]);
    await user.click(screen.getByRole('button', { name: /Next Question/i }));

    const secondQuestionChoices = screen.getAllByRole('button');
    await user.click(secondQuestionChoices[2]);
    await user.click(screen.getByRole('button', { name: /See Results/i }));

    expect(onComplete).toHaveBeenCalledWith(2, 2);
    expect(screen.getByRole('heading', { name: /Quiz Complete!/i })).toBeInTheDocument();
  });

  it('shows difficulty and calculator badges when the question has tags', () => {
    const tagged: Question[] = [
      {
        id: 'q1',
        stem: 'Hard calculator question?',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: 'Explanation.',
        difficulty: 'hard',
        calculator: true,
      },
    ];
    render(<QuizGame questions={tagged} backHref="/back" onComplete={vi.fn()} />);

    expect(screen.getByText('hard')).toBeInTheDocument();
    expect(screen.getByText('Calculator')).toBeInTheDocument();
  });

  it('renders no badges for untagged questions', () => {
    render(<QuizGame questions={questions} backHref="/back" onComplete={vi.fn()} />);

    expect(screen.queryByText('easy')).not.toBeInTheDocument();
    expect(screen.queryByText('medium')).not.toBeInTheDocument();
    expect(screen.queryByText('hard')).not.toBeInTheDocument();
    expect(screen.queryByText('Calculator')).not.toBeInTheDocument();
  });

  it('overall timer mode shows a single mm:ss countdown', () => {
    render(
      <QuizGame questions={questions} backHref="/back" onComplete={vi.fn()} enableTimer timerMode="overall" timerSeconds={1500} />
    );
    expect(screen.getByText(/Exam time remaining/i)).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('overall timer expiry auto-completes with unanswered questions incorrect', async () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      const onQuestionResult = vi.fn();
      render(
        <QuizGame
          questions={questions}
          backHref="/back"
          onComplete={onComplete}
          onQuestionResult={onQuestionResult}
          enableTimer
          timerMode="overall"
          timerSeconds={3}
        />
      );

      // Answer the first question correctly (2 questions total).
      const choices = screen.getAllByRole('button');
      await React.act(async () => {
        choices[1].click();
      });

      // Let the 3-second countdown expire.
      await React.act(async () => {
        vi.advanceTimersByTime(3500);
      });

      expect(onComplete).toHaveBeenCalledWith(1, 2);
      expect(onQuestionResult).toHaveBeenCalledWith('q1', true);
      expect(onQuestionResult).toHaveBeenCalledWith('q2', false);
      expect(screen.getByRole('heading', { name: /Quiz Complete!/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
