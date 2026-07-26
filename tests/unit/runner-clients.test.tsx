import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiagnosticRunnerClient from '@/app/diagnostics/[courseId]/DiagnosticRunnerClient';
import ExamRunnerClient from '@/app/exams/[courseId]/[paperId]/ExamRunnerClient';
import LadderRunnerClient from '@/app/exams/[courseId]/ladder/[level]/LadderRunnerClient';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

// --- framer-motion mock (same pattern as quiz-game.test.tsx) ---
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

// --- shared fixture: 2 questions from different topics ---
const QUESTIONS: MixedReviewQuestion[] = [
  {
    question: { id: 'q1', stem: 'Q one?', choices: ['A1', 'B1', 'C1', 'D1'], correctIndex: 0, explanation: 'Expl one.', difficulty: 'easy' },
    topicId: 'topic-one',
    subjectId: 'math',
    topicTitle: 'Topic One',
  },
  {
    question: { id: 'q2', stem: 'Q two?', choices: ['A2', 'B2', 'C2', 'D2'], correctIndex: 1, explanation: 'Expl two.', difficulty: 'hard' },
    topicId: 'topic-two',
    subjectId: 'math',
    topicTitle: 'Topic Two',
  },
];

// --- lib mocks: deterministic small sets ---
vi.mock('@/lib/diagnostics', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/diagnostics')>()),
  buildDiagnosticQuestions: () => QUESTIONS,
}));
vi.mock('@/lib/exams', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/exams')>()),
  buildExamQuestions: () => QUESTIONS,
}));
vi.mock('@/lib/ladder', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/ladder')>()),
  buildLadderQuestions: () => QUESTIONS,
}));

// --- progress context mock (per-test spies) ---
const recordAttempt = vi.fn();
const recordExam = vi.fn();
const recordLadder = vi.fn();
let ladderProgressState: Record<string, Record<number, { bestScore: number; completedAt: string }>> = {};
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({
    recordAttempt,
    recordExam,
    recordLadder,
    ladderProgress: ladderProgressState,
  }),
}));

// Questions are shuffled by QuizGame's seed, so read the current stem to know
// which fixture question is on screen: q1's correct choice is index 0, q2's is 1.
function currentCorrectIndex(): number {
  const stem = screen.getByRole('heading', { level: 2 }).textContent ?? '';
  return stem.includes('one') ? 0 : 1;
}

async function answerCurrentCorrectly() {
  const user = userEvent.setup();
  const choices = screen.getAllByRole('button').filter((b) => /^[A-D]\./.test(b.textContent ?? ''));
  await user.click(choices[currentCorrectIndex()]);
  await user.click(screen.getByRole('button', { name: /Next Question|See Results/ }));
}

async function answerCurrentWrongly() {
  const user = userEvent.setup();
  const choices = screen.getAllByRole('button').filter((b) => /^[A-D]\./.test(b.textContent ?? ''));
  await user.click(choices[(currentCorrectIndex() + 1) % 4]);
  await user.click(screen.getByRole('button', { name: /Next Question|See Results/ }));
}

describe('DiagnosticRunnerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans results out into one attempt per topic', async () => {
    render(<DiagnosticRunnerClient courseId="math-y7" />);

    // First question correct, second wrong (whichever order the shuffle gives).
    await answerCurrentCorrectly();
    await answerCurrentWrongly();

    expect(recordAttempt).toHaveBeenCalledTimes(2);
    const topics = recordAttempt.mock.calls.map((c) => c[0]).sort();
    expect(topics).toEqual(['topic-one', 'topic-two']);
    // One topic got 1/1 (answered correctly), the other 0/1 — regardless of shuffle order.
    const correctCounts = recordAttempt.mock.calls.map((c) => c[4]).sort();
    expect(correctCounts).toEqual([0, 1]);
    for (const call of recordAttempt.mock.calls) {
      expect(call[1]).toBe('math');
      expect(call[3]).toBe('Math'); // subject name resolved via registry
      expect(call[5]).toBe(1); // one question per topic
    }
  });
});

describe('ExamRunnerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the result once, even after Try Again', async () => {
    const user = userEvent.setup();
    render(<ExamRunnerClient courseId="math-y7" paperId="paper-1" />);

    await answerCurrentCorrectly();
    await answerCurrentCorrectly();

    expect(recordExam).toHaveBeenCalledTimes(1);
    expect(recordExam).toHaveBeenCalledWith(
      expect.objectContaining({ examId: 'math-y7:paper-1', correctCount: 2, totalCount: 2 })
    );
    expect((recordExam.mock.calls[0][0] as { secondsUsed: number }).secondsUsed).toBeGreaterThanOrEqual(0);

    // Try Again resets the quiz but must not double-record.
    await user.click(screen.getByRole('button', { name: /Try Again/i }));
    await answerCurrentWrongly();
    await answerCurrentWrongly();
    expect(recordExam).toHaveBeenCalledTimes(1);
  });
});

describe('LadderRunnerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ladderProgressState = {};
  });

  it('blocks locked levels from direct access', () => {
    render(<LadderRunnerClient courseId="math-y7" level={3} />);
    expect(screen.getByText(/This level is locked/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /A1/ })).not.toBeInTheDocument();
  });

  it('records the score fraction on completion when unlocked', async () => {
    render(<LadderRunnerClient courseId="math-y7" level={1} />);

    await answerCurrentCorrectly();
    await answerCurrentWrongly();

    expect(recordLadder).toHaveBeenCalledTimes(1);
    expect(recordLadder).toHaveBeenCalledWith('math-y7', 1, 0.5);
  });

  it('unlocks when the previous level meets the threshold', () => {
    ladderProgressState = { 'math-y7': { 2: { bestScore: 0.8, completedAt: 'x' } } };
    render(<LadderRunnerClient courseId="math-y7" level={3} />);
    expect(screen.queryByText(/This level is locked/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Q (one|two)/i })).toBeInTheDocument();
  });
});
