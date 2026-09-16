import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const WEAK: TopicProgress = {
  topicId: 'math-yr7-calculations',
  subjectId: 'math',
  topicTitle: 'Written Calculations',
  subjectTitle: 'Math',
  attempts: [{ date: '2026-09-01T10:00:00.000Z', correctCount: 1, totalCount: 10 }],
};
let progressState: TopicProgress[] = [];
let loadedState = false;
let modeParam = 'random';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({ topicProgress: progressState, recordAttempt: vi.fn(), loaded: loadedState }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`mode=${modeParam}`),
}));

import MixedReviewClient from '@/app/mixed-review/MixedReviewClient';
import { userEvent } from '@testing-library/user-event';

// /mixed-review is prerendered (static export) and hydrated. Phase 1b moved the draw to the public
// content endpoint, so: nothing is drawn during render (server and first client paint are the same
// loading state — this used to be a hydration bug), the request carries the weak-topic ids + the
// session seed in the PATH (so the edge cache key covers every response-varying input), and a late
// progress load re-draws only when the user has not answered yet.
const optionLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].map((b) => b.textContent ?? '').slice(0, 4);

const fetchUrls: string[] = [];

describe('MixedReviewClient — server draw, hydration safety and session stability', () => {
  beforeEach(() => {
    loadedState = false;
    progressState = [];
    modeParam = 'random';
    fetchUrls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetchUrls.push(String(url));
        return { ok: true, status: 200, json: async () => ({ questions: QUESTIONS }) } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws nothing during render: the prerendered paint is the loading state, twice over', () => {
    const first = render(<MixedReviewClient />);
    const firstPaint = first.container.innerHTML;
    expect(screen.getByText(/Loading mixed review/)).toBeTruthy();

    const second = render(<MixedReviewClient />);
    expect(second.container.innerHTML).toBe(firstPaint);
  });

  it('renders a real question set once the endpoint answers', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(optionLabels(view.container).length).toBe(4), { timeout: 5_000 });
    expect(screen.queryByText(/Loading mixed review/)).toBeNull();
  });

  it('asks the public endpoint for all topics in random mode, with the seed in the path', async () => {
    const view = render(<MixedReviewClient />);
    // Before progress resolves the seed is the deterministic mode string — no per-session randomness
    // is drawn during (or before) hydration.
    await waitFor(() => expect(fetchUrls).toContain('/api/content/public/mixed-review/random'), {
      timeout: 5_000,
    });

    // Once progress lands, the mount effect reseeds and the request carries the per-session seed.
    loadedState = true;
    view.rerender(<MixedReviewClient />);
    await waitFor(() => expect(fetchUrls.some((u) => /\/mixed-review\/random:[\w.-]+$/.test(u))).toBe(true), {
      timeout: 5_000,
    });
  });

  it('sends the weak-topic ids (bounded) when the mode is weak and progress exists', async () => {
    modeParam = 'weak';
    progressState = [WEAK];
    render(<MixedReviewClient />);
    await waitFor(
      () => expect(fetchUrls.some((u) => u.endsWith('/weak/math-yr7-calculations'))).toBe(true),
      { timeout: 5_000 }
    );
    expect(screen.getByText(/Focused on your weak areas/)).toBeTruthy();
  });

  it('keeps an in-progress session when the profile progress lands late', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(optionLabels(view.container).length).toBe(4), { timeout: 5_000 });
    const before = optionLabels(view.container);

    // Answer the first question — the session is now live.
    await userEvent.click(view.container.querySelectorAll('button')[0]);
    // …then the (slow) auth/progress resolution arrives.
    loadedState = true;
    view.rerender(<MixedReviewClient />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(optionLabels(view.container)).toEqual(before);
  });

  it('re-draws from the weak topics when progress arrives before any answer', async () => {
    modeParam = 'weak';
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(fetchUrls.length).toBeGreaterThan(0), { timeout: 5_000 });
    // First draw ran before progress existed, so weak mode fell back to all topics.
    expect(view.container.textContent).toMatch(/No weak areas found yet/);

    loadedState = true;
    progressState = [WEAK];
    view.rerender(<MixedReviewClient />);

    await waitFor(() => expect(view.container.textContent).toMatch(/Focused on your weak areas/), {
      timeout: 5_000,
    });
    expect(fetchUrls.at(-1)).toContain('/math-yr7-calculations');
  });
});
