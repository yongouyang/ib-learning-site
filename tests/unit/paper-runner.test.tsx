import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaperRunnerClient from '@/app/papers/[courseId]/[setId]/PaperRunnerClient';
import type { Paper } from '@/content/types';

const motionPropKeys = new Set([
  'initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover',
  'whileFocus', 'whileDrag', 'whileInView', 'variants', 'custom',
]);

function PlainElement({ tag, ...props }: { tag: string; [key: string]: unknown }) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionPropKeys.has(key)) filtered[key] = value;
  }
  return React.createElement(tag, filtered);
}

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag: string) => (props: object) => <PlainElement tag={tag} {...props} />,
  }) as unknown as typeof import('framer-motion')['motion'],
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const recordExam = vi.fn();
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({ recordExam }),
}));

// Phase E2: PaperRunnerClient reads auth + entitlements for the AI-marking
// gate (login prompt / quota tease / remaining count).
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, loaded: true }),
}));
vi.mock('@/context/EntitlementsContext', () => ({
  useEntitlements: () => ({ has: () => false, loaded: true }),
}));

const paper: Paper = {
  id: 'math-y7-set-1',
  courseId: 'math-y7',
  title: 'Practice Set 1',
  durationMinutes: 30,
  questions: [
    {
      id: 'q-easy',
      stem: 'What is 2 + 2?',
      marks: 1,
      markscheme: ['B1: 4'],
      modelAnswer: 'Two plus two is four.',
      difficulty: 'easy',
    },
    {
      id: 'q-hard',
      stem: 'Work out 15% of 48.',
      marks: 2,
      markscheme: ['M1: 10% = 4.80 and 5% = 2.40', 'A1: 7.20'],
      modelAnswer: '15% of 48 is 7.20.',
      difficulty: 'hard',
    },
  ],
};

const timedPaper: Paper = { ...paper, durationMinutes: 1 };

describe('PaperRunnerClient', () => {
  beforeEach(() => {
    recordExam.mockClear();
  });

  it('runs the two-phase flow and records marks achieved', async () => {
    const user = userEvent.setup();
    render(<PaperRunnerClient paper={paper} />);

    // Answering phase: first question is the easy one (easy -> hard ordering).
    expect(screen.getByRole('heading', { name: /What is 2 \+ 2\?/i })).toBeInTheDocument();
    expect(screen.getByText('1 mark')).toBeInTheDocument();
    expect(screen.getByText(/Time remaining/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Your answer/i), '4');
    await user.click(screen.getByRole('button', { name: /Next Question/i }));

    // Free navigation: the earlier answer persists when going back.
    expect(screen.getByRole('heading', { name: /15% of 48/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Your answer/i), '7.00');
    await user.click(screen.getByRole('button', { name: /Previous/i }));
    expect(screen.getByLabelText(/Your answer/i)).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: /Next Question/i }));

    // Submit -> untimed review phase, starting back at the first question.
    await user.click(screen.getByRole('button', { name: /Submit & Review/i }));
    expect(screen.queryByText(/Time remaining/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What is 2 \+ 2\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Model answer/i)).toBeInTheDocument();

    // Tick the single point; q2 review gets no ticks; then See Results.
    await user.click(screen.getByRole('button', { name: /B1: 4/i }));
    expect(screen.getByRole('button', { name: /B1: 4/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Next Question \(1\/1 marks\)/i }));
    expect(screen.getByRole('heading', { name: /15% of 48/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /See Results \(0\/2 marks\)/i }));

    // Results: 1 of 3 marks = 33%.
    expect(screen.getByRole('heading', { name: /Paper Complete!/i })).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(recordExam).toHaveBeenCalledTimes(1);
    expect(recordExam).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'math-y7-set-1',
        correctCount: 1,
        totalCount: 3,
      })
    );
  });

  it('locks answers and moves to untimed review when the timer expires', async () => {
    vi.useFakeTimers();
    try {
      render(<PaperRunnerClient paper={timedPaper} />);

      // Answer q1, then expire the 1-minute countdown mid-paper.
      // (fireEvent — userEvent's async delays hang under fake timers.)
      fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: '4' } });
      await React.act(async () => {
        vi.advanceTimersByTime(61_000);
      });

      // Review phase, NOT results: clock gone, expiry note shown, nothing
      // recorded yet — the student still self-marks in review.
      expect(screen.getByText(/Time's up/i)).toBeInTheDocument();
      expect(screen.queryByText(/Time remaining/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Model answer/i)).toBeInTheDocument();
      expect(recordExam).not.toHaveBeenCalled();

      // The expired paper can still be self-marked in review.
      fireEvent.click(screen.getByRole('button', { name: /B1: 4/i }));
      fireEvent.click(screen.getByRole('button', { name: /Next Question \(1\/1 marks\)/i }));
      fireEvent.click(screen.getByRole('button', { name: /See Results \(0\/2 marks\)/i }));

      expect(recordExam).toHaveBeenCalledTimes(1);
      expect(recordExam).toHaveBeenCalledWith(
        expect.objectContaining({ examId: 'math-y7-set-1', correctCount: 1, totalCount: 3 })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('records zero when the clock submits a fully unanswered paper', async () => {
    vi.useFakeTimers();
    try {
      render(<PaperRunnerClient paper={timedPaper} />);

      await React.act(async () => {
        vi.advanceTimersByTime(61_000);
      });

      // Straight through review with no ticks.
      fireEvent.click(screen.getByRole('button', { name: /Next Question \(0\/1 marks\)/i }));
      fireEvent.click(screen.getByRole('button', { name: /See Results \(0\/2 marks\)/i }));

      expect(screen.getByRole('heading', { name: /Paper Complete!/i })).toBeInTheDocument();
      expect(recordExam).toHaveBeenCalledTimes(1);
      expect(recordExam).toHaveBeenCalledWith(
        expect.objectContaining({ examId: 'math-y7-set-1', correctCount: 0, totalCount: 3 })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
