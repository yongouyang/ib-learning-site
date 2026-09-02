import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { TopicProgress } from '@/content/types';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

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

const PROGRESS: TopicProgress[] = [];
let loadedState = false;
const buildMixedReviewQuestions = vi.fn(
  (
    _progress: TopicProgress[],
    _mode: 'random' | 'weak',
    _seed?: string
  ) => ({
    questions: QUESTIONS,
    usedWeakTopics: true,
    weakTopicCount: 1,
  })
);
vi.mock('@/lib/mixed-review', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/mixed-review')>()),
  buildMixedReviewQuestions: (
    progress: TopicProgress[],
    mode: 'random' | 'weak',
    seed?: string
  ) => buildMixedReviewQuestions(progress, mode, seed),
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({ topicProgress: PROGRESS, recordAttempt: vi.fn(), loaded: loadedState }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('mode=weak'),
}));

import MixedReviewClient from '@/app/mixed-review/MixedReviewClient';
import { userEvent } from '@testing-library/user-event';

// /mixed-review is prerendered (static export) and hydrated, so the draw that
// happens during RENDER must be reproducible on both sides: an unseeded
// Math.random() sample made the server and client disagree and React threw the
// whole tree away ("Hydration failed because the server rendered text didn't
// match the client" — seen in the CI e2e console). The freshness draw belongs in
// an effect, after hydration.
describe('MixedReviewClient render-phase purity (hydration safety)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadedState = false;
  });

  it('draws with a deterministic seed on the first render (what SSR renders too)', () => {
    render(<MixedReviewClient />);
    const [progress, mode, seed] = buildMixedReviewQuestions.mock.calls[0];
    expect(progress).toBe(PROGRESS);
    expect(mode).toBe('weak');
    expect(seed).toBe('weak'); // === the mode, no per-session randomness
  });
  it('reseeds once after mount so each visit still gets a fresh mix', async () => {
    render(<MixedReviewClient />);
    const firstSeed = buildMixedReviewQuestions.mock.calls[0][2];
    // Deterministic for hydration first, then a per-session seed from an effect.
    await waitFor(() => {
      const seeds = buildMixedReviewQuestions.mock.calls.map((c) => c[2]);
      expect(seeds.some((s) => s !== firstSeed && /^weak:.+/.test(s ?? ''))).toBe(true);
    });
  });

  it('does not clobber an in-progress session when the profile progress lands late', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(buildMixedReviewQuestions.mock.calls.length).toBeGreaterThan(1));
    // Answer the first question — the session is now live.
    await userEvent.click(view.container.querySelectorAll('button')[0]);
    const callsBefore = buildMixedReviewQuestions.mock.calls.length;
    // …then the (slow) auth/progress resolution arrives.
    loadedState = true;
    view.rerender(<MixedReviewClient />);
    expect(buildMixedReviewQuestions.mock.calls).toHaveLength(callsBefore);
  });

  it('draws the weak-topic set again when progress arrives before any answer', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(buildMixedReviewQuestions.mock.calls.length).toBeGreaterThan(1));
    const callsBefore = buildMixedReviewQuestions.mock.calls.length;
    loadedState = true;
    view.rerender(<MixedReviewClient />);
    expect(buildMixedReviewQuestions.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
