import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { TopicProgress } from '@/content/types';

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

const WEAK: TopicProgress = {
  topicId: 'math-yr7-calculations',
  subjectId: 'math',
  topicTitle: 'Written Calculations',
  subjectTitle: 'Math',
  attempts: [{ date: '2026-09-01T10:00:00.000Z', correctCount: 1, totalCount: 10 }],
};
let progressState: TopicProgress[] = [];
let loadedState = false;

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/context/ProgressContext', () => ({
  useProgress: () => ({ topicProgress: progressState, recordAttempt: vi.fn(), loaded: loadedState }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('mode=weak'),
}));

import MixedReviewClient from '@/app/mixed-review/MixedReviewClient';
import { userEvent } from '@testing-library/user-event';

// /mixed-review is prerendered (static export) and hydrated. Phase 1a moved its draw into a lazily
// imported module (so the topic content bank stays out of the shared chunks) and seeds it from an
// effect, which makes the hydration story structural: NOTHING is drawn during render, so the server
// and the first client paint are the same loading state. An unseeded Math.random() sample in render
// used to make them disagree and React threw the whole tree away ("Hydration failed because the
// server rendered text didn't match the client"). No builder mock here on purpose — the real draw is
// the thing under test.
const optionLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].map((b) => b.textContent ?? '').slice(0, 4);

describe('MixedReviewClient — lazy draw, hydration safety and session stability', () => {
  beforeEach(() => {
    loadedState = false;
    progressState = [];
  });

  it('draws nothing during render: the prerendered paint is the loading state, twice over', () => {
    const first = render(<MixedReviewClient />);
    const firstPaint = first.container.innerHTML;
    expect(screen.getByText(/Loading mixed review/)).toBeTruthy();

    const second = render(<MixedReviewClient />);
    expect(second.container.innerHTML).toBe(firstPaint);
  });

  it('renders a real question set once the lazy module resolves', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(optionLabels(view.container).length).toBe(4), { timeout: 10_000 });
    expect(screen.queryByText(/Loading mixed review/)).toBeNull();
  });

  it('keeps an in-progress session when the profile progress lands late', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(optionLabels(view.container).length).toBe(4), { timeout: 10_000 });
    const before = optionLabels(view.container);

    // Answer the first question — the session is now live.
    await userEvent.click(view.container.querySelectorAll('button')[0]);
    // …then the (slow) auth/progress resolution arrives.
    loadedState = true;
    view.rerender(<MixedReviewClient />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(optionLabels(view.container)).toEqual(before);
  });

  it('draws the weak-topic set when progress arrives before any answer', async () => {
    const view = render(<MixedReviewClient />);
    await waitFor(() => expect(optionLabels(view.container).length).toBe(4), { timeout: 10_000 });
    // First draw ran before progress existed, so weak mode fell back to all topics.
    expect(view.container.textContent).toMatch(/No weak areas found yet/);

    loadedState = true;
    progressState = [WEAK];
    view.rerender(<MixedReviewClient />);

    // The late-arriving progress forces a fresh draw — visible as the focused description.
    await waitFor(() => expect(view.container.textContent).toMatch(/Focused on your weak areas/), { timeout: 10_000 });
    expect(optionLabels(view.container).length).toBe(4);
  });
});
