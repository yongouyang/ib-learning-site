import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { PaperMeta } from '@/content/types';

// Phase 1b — the premium shell (docs/premium-content-protection-plan.md §4.2). The states, in the
// order that matters: no lock may flash while entitlements resolve, no request may be made when the
// session is not entitled, and a 401/403 from the server must degrade to the sign-in prompt / tease
// rather than an error.
let loadedState = false;
let entitled = false;

vi.mock('@/context/EntitlementsContext', () => ({
  useEntitlements: () => ({ has: () => entitled, loaded: loadedState }),
}));
// The runner itself is exercised elsewhere; here it is a marker so the shell's states are the subject.
vi.mock('../../src/app/papers/[courseId]/[setId]/PaperRunnerClient', () => ({
  default: ({ paper }: { paper: { id: string } }) => <div data-testid="paper-runner">{paper.id}</div>,
}));

// usePathname drives the 401 card's return path (loginHref), so it needs a value here.
vi.mock('next/navigation', () => ({
  usePathname: () => '/papers/math-y9/math-y9-set-2',
}));

import PremiumPaperShell from '@/app/papers/[courseId]/[setId]/PremiumPaperShell';

const META: PaperMeta = {
  id: 'math-y9-set-2',
  courseId: 'math-y9',
  title: 'Practice Set 2',
  durationMinutes: 45,
  questionCount: 8,
  totalMarks: 20,
};

let fetchCalls: string[] = [];
let fetchStatus = 200;

describe('PremiumPaperShell', () => {
  beforeEach(() => {
    loadedState = false;
    entitled = false;
    fetchCalls = [];
    fetchStatus = 200;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetchCalls.push(String(url));
        return {
          ok: fetchStatus === 200,
          status: fetchStatus,
          json: async () => ({ paper: { id: META.id, questions: [] } }),
        } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a neutral skeleton while entitlements resolve, and makes no request', () => {
    const view = render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    expect(view.container.querySelector('[aria-busy="true"]')).toBeTruthy();
    // The no-flash rule: no lock over content the user may be entitled to.
    expect(screen.queryByText(/Full exam sets/)).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  it('teases an unentitled session over public metadata and makes NO request', async () => {
    loadedState = true;
    const view = render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    await waitFor(() => expect(screen.getByText(/Full exam sets/)).toBeTruthy());
    expect(screen.getByText(/See Premium plans/)).toBeTruthy();
    // The inert preview is built from metadata the page already has — never from the paper.
    expect(view.container.textContent).toContain('8 questions');
    expect(view.container.textContent).toContain('20 marks');
    expect(fetchCalls).toHaveLength(0);
  });

  it('fetches once and renders the runner for an entitled session', async () => {
    loadedState = true;
    entitled = true;
    render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    await waitFor(() => expect(screen.getByTestId('paper-runner')).toBeTruthy());
    expect(fetchCalls).toEqual(['/api/content/premium/papers/math-y9/math-y9-set-2']);
    expect(screen.getByTestId('paper-runner').textContent).toBe('math-y9-set-2');
  });

  it('degrades a 401 to a sign-in prompt that RETURNS the user here (the server is the gate)', async () => {
    loadedState = true;
    entitled = true;
    fetchStatus = 401;
    render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    await waitFor(() => expect(screen.getByText(/Sign in to open this set/)).toBeTruthy());
    expect(screen.queryByTestId('paper-runner')).toBeNull();
    // A bare /login would drop an expired session on the home page after signing in.
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
      '/login?next=%2Fpapers%2Fmath-y9%2Fmath-y9-set-2'
    );
  });

  // The reviewer's P1: the premium page had no h1, no breadcrumb and never named the course, while the
  // free set-1 page (the control) had all three. Every state must carry the same chrome.
  it.each([
    ['unresolved (skeleton)', false, false],
    ['not entitled (tease)', true, false],
    ['entitled but fetching', true, true],
  ])('renders the breadcrumb chrome and exactly one h1 in the %s state', async (_name, loaded, isEntitled) => {
    loadedState = loaded;
    entitled = isEntitled;
    render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Math — Year 9 Practice Set 2');
    expect(screen.getByRole('link', { name: 'Practice Papers' })).toBeTruthy();
  });

  it('shows the public metadata preview as readable text, outside any aria-hidden wrapper', async () => {
    loadedState = true;
    entitled = false;
    render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    await waitFor(() => expect(screen.getByText(/Full exam sets/)).toBeTruthy());
    // Dimming it measured ~1.7:1 contrast AND put it inside aria-hidden, so AT heard no evidence of
    // value at all. Nothing here needs protecting: it is the page's own public metadata.
    const stats = screen.getByText(/8 questions · 20 marks/);
    expect(stats.closest('[aria-hidden="true"]')).toBeNull();
    expect(stats.closest('[inert]')).toBeNull();
  });

  it('degrades a 403 to an honest "not in your plan" card (a stale client tier must not read as an error)', async () => {
    loadedState = true;
    entitled = true;
    fetchStatus = 403;
    render(<PremiumPaperShell courseId="math-y9" setId="math-y9-set-2" meta={META} />);
    // LockedFeature cannot express this state (it re-reads the SAME stale client entitlements and
    // would render the paper unlocked), which is exactly why this branch is separate.
    await waitFor(() => expect(screen.getByText(/Not included in your plan/)).toBeTruthy());
    expect(screen.getByText(/See Premium plans/)).toBeTruthy();
    expect(screen.queryByTestId('paper-runner')).toBeNull();
  });
});
