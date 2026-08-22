import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExamRunnerClient from '@/app/exams/[courseId]/[paperId]/ExamRunnerClient';
import LadderRunnerClient from '@/app/exams/[courseId]/ladder/[level]/LadderRunnerClient';
import LadderOverviewClient from '@/app/exams/[courseId]/ladder/LadderOverviewClient';
import PaperRunnerClient from '@/app/papers/[courseId]/[setId]/PaperRunnerClient';
import type { MixedReviewQuestion } from '@/lib/mixed-review';
import type { Paper } from '@/content/types';

// Phase E3 — lock/unlock rendering for the gated exam surfaces
// (docs/entitlement-implementation-plan.md). Entitlements are injected via the
// context mock below; the dummy auth universe has no premium-tier injection
// for e2e, so the premium-side coverage lives here.

// --- framer-motion mock (same pattern as runner-clients.test.tsx) ---
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

// --- deterministic question fixture ---
const QUESTIONS: MixedReviewQuestion[] = [
  {
    question: { id: 'q1', stem: 'Q one?', choices: ['A1', 'B1', 'C1', 'D1'], correctIndex: 0, explanation: 'Expl one.', difficulty: 'easy' },
    topicId: 'topic-one',
    subjectId: 'math',
    topicTitle: 'Topic One',
  },
];
vi.mock('@/lib/exams', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/exams')>()),
  buildExamQuestions: () => QUESTIONS,
}));
vi.mock('@/lib/ladder', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/ladder')>()),
  buildLadderQuestions: () => QUESTIONS,
}));

// --- per-test entitlement + progress state ---
let grantedFeatures: string[] = [];
let entitlementsLoaded = true;
vi.mock('@/context/EntitlementsContext', () => ({
  useEntitlements: () => ({
    has: (feature: string) => grantedFeatures.includes(feature),
    loaded: entitlementsLoaded,
  }),
}));

let ladderProgressState: Record<string, Record<number, { bestScore: number; completedAt: string }>> = {};
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({
    recordAttempt: vi.fn(),
    recordExam: vi.fn(),
    recordLadder: vi.fn(),
    ladderProgress: ladderProgressState,
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, loaded: true }),
}));

const PREMIUM = ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'];

const SET_2: Paper = {
  id: 'math-y7-set-2',
  courseId: 'math-y7',
  title: 'Practice Set 2',
  durationMinutes: 30,
  questions: [
    {
      id: 'q-easy',
      stem: 'What is 2 + 2?',
      marks: 1,
      markscheme: ['B1: 4'],
      modelAnswer: 'Four.',
      difficulty: 'easy',
    },
  ],
};

beforeEach(() => {
  grantedFeatures = [];
  entitlementsLoaded = true;
  ladderProgressState = {};
});

describe('ExamRunnerClient (timed mock mode)', () => {
  it('shows the premium tease when exam-sets-full is missing', () => {
    render(<ExamRunnerClient courseId="math-y7" paperId="paper-1" />);
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Timed mock mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Premium plans' })).toHaveAttribute('href', '/pricing');
    // The locked view is a STATIC summary (exam title + sample rows), not the
    // live QuizGame: no interactive choices, no ticking countdown.
    expect(screen.getByRole('heading', { level: 1, name: /Math — Year 7 · Paper 1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /A1/ })).toBeNull();
    expect(screen.queryByText(/Exam time remaining/)).toBeNull();
    // Sample rows are inert: hidden from assistive tech.
    expect(screen.getByText('Q one?').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the quiz untouched for premium sessions', () => {
    grantedFeatures = PREMIUM;
    render(<ExamRunnerClient courseId="math-y7" paperId="paper-1" />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('button', { name: /A1/ })).toBeInTheDocument();
  });

  it('never flashes the lock while entitlements are still resolving', () => {
    entitlementsLoaded = false;
    render(<ExamRunnerClient courseId="math-y7" paperId="paper-1" />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('button', { name: /A1/ })).toBeInTheDocument();
  });
});

describe('LadderOverviewClient (upper levels)', () => {
  it('free sessions see levels 1–2 live and 3–5 behind one tease card', () => {
    render(<LadderOverviewClient courseId="math-y7" />);
    expect(screen.getByRole('link', { name: /Level 1 — Warm-up/ })).toBeInTheDocument();
    expect(screen.getByText(/Score ≥60% on Level 1 to unlock/)).toBeInTheDocument();
    expect(screen.getByText('Upper ladder levels')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Premium plans' })).toHaveAttribute('href', '/pricing');
    // Levels 3–5 are premium-gated AND score-gated — the locked rows name both.
    expect(screen.getByText(/Premium · unlock with ≥60% on Level 2/)).toBeInTheDocument();
  });

  it('premium sessions get no tease; the score-unlock logic still applies', () => {
    grantedFeatures = PREMIUM;
    ladderProgressState = { 'math-y7': { 1: { bestScore: 0.8, completedAt: 'x' }, 2: { bestScore: 0.8, completedAt: 'x' } } };
    render(<LadderOverviewClient courseId="math-y7" />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('link', { name: /Level 3 — Steady/ })).toBeInTheDocument();
    // Level 4 stays score-locked until level 3 is passed — and for a premium
    // session the hint is the score gate alone (they already have Premium).
    expect(screen.queryByRole('link', { name: /Level 4/ })).toBeNull();
    expect(screen.getByText(/Score ≥60% on Level 3 to unlock/)).toBeInTheDocument();
  });
});

describe('LadderRunnerClient (upper levels)', () => {
  it('shows the premium tease on a score-unlocked upper level when the feature is missing', () => {
    ladderProgressState = { 'math-y7': { 2: { bestScore: 0.8, completedAt: 'x' } } };
    render(<LadderRunnerClient courseId="math-y7" level={3} />);
    expect(screen.getByText('Upper ladder levels')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Premium plans' })).toBeInTheDocument();
    // Score status shows LIVE above the tease (never ghosted in the preview).
    const status = screen.getByText(/Your Level 2 score unlocked this level/);
    expect(status.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /A1/ })).toBeNull();
  });

  it('names both gates when an upper level is premium-gated AND score-locked', () => {
    render(<LadderRunnerClient courseId="math-y7" level={3} />);
    expect(screen.getByText(/Premium level — you'll also need 60% or more on Level 2/)).toBeInTheDocument();
    expect(screen.getByText('Upper ladder levels')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /A1/ })).toBeNull();
  });

  it('premium sessions run a score-unlocked upper level', () => {
    grantedFeatures = PREMIUM;
    ladderProgressState = { 'math-y7': { 2: { bestScore: 0.8, completedAt: 'x' } } };
    render(<LadderRunnerClient courseId="math-y7" level={3} />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('button', { name: /A1/ })).toBeInTheDocument();
  });

  it('free levels are never premium-gated', () => {
    render(<LadderRunnerClient courseId="math-y7" level={2} />);
    expect(screen.queryByText('Premium')).toBeNull();
    // Score-gate still applies on free levels.
    expect(screen.getByText(/This level is locked/)).toBeInTheDocument();
  });
});

describe('PaperRunnerClient (sets beyond the first)', () => {
  it('shows the premium tease for set 2 when the feature is missing', () => {
    render(<PaperRunnerClient paper={SET_2} />);
    expect(screen.getByText('Full exam sets')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Premium plans' })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('textbox', { name: /Your answer/i })).toBeNull();
  });

  it('premium sessions run set 2', () => {
    grantedFeatures = PREMIUM;
    render(<PaperRunnerClient paper={SET_2} />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('textbox', { name: /Your answer/i })).toBeInTheDocument();
  });

  it('set 1 is never premium-gated', () => {
    render(<PaperRunnerClient paper={{ ...SET_2, id: 'math-y7-set-1', title: 'Practice Set 1' }} />);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.getByRole('textbox', { name: /Your answer/i })).toBeInTheDocument();
  });
});
