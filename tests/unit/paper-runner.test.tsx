import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('PaperRunnerClient', () => {
  it('runs the self-marking flow and records marks achieved', async () => {
    const user = userEvent.setup();
    render(<PaperRunnerClient paper={paper} />);

    // First question is the easy one (easy -> hard ordering).
    expect(screen.getByRole('heading', { name: /What is 2 \+ 2\?/i })).toBeInTheDocument();
    expect(screen.getByText('1 mark')).toBeInTheDocument();

    // Check button is disabled until an answer is written.
    expect(screen.getByRole('button', { name: /Check answer/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/Your answer/i), '4');
    const checkBtn = screen.getByRole('button', { name: /Check answer/i });
    expect(checkBtn).toBeEnabled();
    await user.click(checkBtn);

    // Mark stage: model answer + one markscheme point; tick it.
    expect(screen.getByText(/Model answer/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /B1: 4/i }));
    expect(screen.getByRole('button', { name: /B1: 4/i })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Next Question \(1\/1 marks\)/i }));

    // Second question: leave both points unticked.
    expect(screen.getByRole('heading', { name: /15% of 48/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Your answer/i), '7.00');
    await user.click(screen.getByRole('button', { name: /Check answer/i }));
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
});
