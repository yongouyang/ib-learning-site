import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ProgressProvider, useProgress } from '@/context/ProgressContext';

// Probe component that exposes the context value to assertions.
let probe: ReturnType<typeof useProgress>;
function Probe() {
  probe = useProgress();
  return (
    <div>
      <span data-testid="loaded">{String(probe.loaded)}</span>
      <span data-testid="stars">{probe.userProgress.totalStars}</span>
      <span data-testid="cards">{Object.keys(probe.flashcardProgress).length}</span>
    </div>
  );
}

// Mock localStorage (same pattern as progress-store.test.ts).
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
});

function renderProvider() {
  return render(
    <ProgressProvider>
      <Probe />
    </ProgressProvider>
  );
}

describe('ProgressContext', () => {
  it('starts with SSR defaults, then loads storage after mount (loaded flips)', async () => {
    store['iblearn_progress'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 7, currentStreakDays: 2, lastStudyDate: '2026-07-25' },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    });
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('stars').textContent).toBe('7');
  });

  it('recordFlashcard writes through and refreshes context state', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    act(() => {
      probe.recordFlashcard('card-1', 'known');
    });
    expect(screen.getByTestId('cards').textContent).toBe('1');
    expect(probe.flashcardProgress['card-1'].status).toBe('known');
    expect(JSON.parse(store['iblearn_progress']).flashcardProgress['card-1'].knownStreak).toBe(1);
  });

  it('recordExam stores the result and updates stars via refresh', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    act(() => {
      probe.recordExam({ examId: 'math-y7-set-1', date: new Date().toISOString(), correctCount: 9, totalCount: 10, secondsUsed: 300 });
    });
    expect(probe.examResults).toHaveLength(1);
    expect(screen.getByTestId('stars').textContent).toBe('3'); // 90% → 3 stars
  });

  it('recordAttempt feeds topicProgress used by weak-area analysis', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    act(() => {
      probe.recordAttempt('bio-cell-1', 'biology', 'Cells', 'Biology', 2, 10);
    });
    expect(probe.topicProgress).toHaveLength(1);
    expect(probe.topicProgress[0].topicId).toBe('bio-cell-1');
    expect(probe.topicProgress[0].attempts[0].correctCount).toBe(2);
  });
});
