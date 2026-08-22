import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ProgressProvider, useProgress } from '@/context/ProgressContext';

// ProgressProvider now uses useAuth() (it is nested inside AuthProvider in the
// app), so the harness renders it inside AuthProvider with a logged-out session
// (me() → null) to keep exercising the anonymous-store path these tests cover.
const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
  me: meMock,
  verifyOtp: vi.fn(),
  logout: vi.fn(),
  updateAccount: vi.fn(),
  setOnUnauthorized: vi.fn(),
}));

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
  meMock.mockReset();
  meMock.mockResolvedValue(null); // logged out → anonymous store
});

function renderProvider() {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <Probe />
      </ProgressProvider>
    </AuthProvider>
  );
}

describe('ProgressContext — logged-in reconciliation (round 2)', () => {
  const USER = {
    userId: 'u1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'parent',
    childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }],
  } as const;

  const emptyBlob = () =>
    JSON.stringify({
      version: 2,
      userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    });

  const fetchMock = vi.fn();
  const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  beforeEach(() => {
    meMock.mockResolvedValue(USER);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function syncBodies(): Array<{ events: Array<Record<string, unknown>>; markMigrationComplete?: boolean }> {
    return fetchMock.mock.calls
      .filter(([url]) => url === '/api/progress/sync')
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));
  }

  it('does NOT purge the pending queue when a logged-in session reloads', async () => {
    // A reload of a signed-in session finds: a pending queue entry + a
    // (possibly empty) namespaced store. The mount-time identity effect used
    // to run as "logged out" and purge the queue before /me resolved.
    store['octav_sync_queue'] = JSON.stringify([
      {
        userId: 'u1',
        profileId: 'p1',
        event: {
          type: 'flashcardResult',
          profileId: 'p1',
          cardId: 'queued-1',
          status: 'known',
          knownStreak: 2,
          date: '2026-08-15T10:00:00.000Z',
        },
      },
    ]);
    store['octav_progress:u1:p1'] = emptyBlob();
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return Promise.resolve(okJson({ profiles: {} }));
      if (url === '/api/progress/sync') return Promise.resolve(okJson({ synced: 100 }));
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    // The queued event was SENT to the server (a purge would have sent nothing).
    await waitFor(() => {
      const bodies = syncBodies();
      expect(bodies).toHaveLength(1);
      expect(bodies[0].events).toHaveLength(1);
      expect(bodies[0].events[0].cardId).toBe('queued-1');
    });
    expect(store['octav_sync_queue']).toBeUndefined(); // drained by the flush
  });

  it('migrates a >100-event anonymous blob in chunks, marking completion only on the LAST chunk', async () => {
    const cards: Record<string, unknown> = {};
    for (let i = 0; i < 120; i++) {
      cards[`card-${i}`] = { status: 'known', lastReviewed: '2026-08-15T10:00:00.000Z', knownStreak: 2 };
    }
    store['iblearn_progress'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 1, currentStreakDays: 1, lastStudyDate: '2026-08-15' },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: cards,
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return Promise.resolve(okJson({ profiles: {} }));
      if (url === '/api/progress/sync') return Promise.resolve(okJson({ synced: 100 }));
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    renderProvider();

    await waitFor(() => expect(store['octav_anon_claimed']).toBe('1'));
    const bodies = syncBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies.map((b) => b.events.length)).toEqual([100, 20]);
    // A partial upload must never stamp the migration marker — only the final chunk.
    expect(bodies[0].markMigrationComplete).toBeUndefined();
    expect(bodies[1].markMigrationComplete).toBe(true);
    // On success the anonymous blob is cleared (at-most-once per device).
    expect(store['iblearn_progress']).toBeUndefined();
  });

  it('retries the migration with the SAME attempt ids and never writes anon content into the namespaced store', async () => {
    store['iblearn_progress'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-01-01' },
      topicProgress: {
        'math:math-yr7-equations': {
          topicId: 'math-yr7-equations',
          subjectId: 'math',
          topicTitle: 'Solving Equations',
          subjectTitle: 'Math',
          // Legacy attempt: no attemptId.
          attempts: [{ date: '2026-01-01T00:00:00.000Z', correctCount: 9, totalCount: 10 }],
        },
      },
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    });
    let failSync = true;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return Promise.resolve(okJson({ profiles: {} }));
      if (url === '/api/progress/sync') {
        if (failSync) return Promise.reject(new Error('network down'));
        return Promise.resolve(okJson({ synced: 100 }));
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    // First mount: the upload fails — the migration must NOT complete, but the
    // anon blob already carries the assigned id (persisted BEFORE uploading).
    const first = renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    const anonAfterFail = JSON.parse(store['iblearn_progress']);
    const assignedId = anonAfterFail.topicProgress['math:math-yr7-equations'].attempts[0].attemptId;
    expect(assignedId).toBeTruthy();
    expect(store['octav_anon_claimed']).toBeUndefined();
    first.unmount();

    // Second mount (reload / re-login): the upload succeeds and reuses THE
    // SAME id — the server's attribute_not_exists writes stay idempotent.
    failSync = false;
    renderProvider();
    await waitFor(() => expect(store['octav_anon_claimed']).toBe('1'));
    const bodies = syncBodies();
    const success = bodies[bodies.length - 1];
    expect(success.events[0].attemptId).toBe(assignedId);

    // The namespaced store never received the anon content (the merge writes
    // server+namespaced-local only).
    const namespaced = JSON.parse(store['octav_progress:u1:p1']);
    expect(namespaced.topicProgress['math:math-yr7-equations']).toBeUndefined();
  });

  it('retries a PARTIALLY-APPLIED chunked migration on the next login (round 3)', async () => {
    // 120 anon topic attempts → two chunks (100 + 20). Chunk 1 applies
    // server-side; chunk 2 fails. The profile is then NON-EMPTY — the old
    // `!profileHasProgress` gate would skip the retry forever, orphaning the
    // remaining events in the uncleared blob.
    const attempts = Array.from({ length: 120 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      correctCount: 8,
      totalCount: 10,
    }));
    store['iblearn_progress'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-01-01' },
      topicProgress: {
        'math:math-yr7-equations': {
          topicId: 'math-yr7-equations',
          subjectId: 'math',
          topicTitle: 'Solving Equations',
          subjectTitle: 'Math',
          attempts,
        },
      },
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    });

    let syncCalls = 0;
    let failChunkTwo = true;
    const profileWithProgress = {
      userProgress: { totalStars: 1, currentStreakDays: 1, lastStudyDate: null },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      // Simulates chunk 1 having landed: the profile now HAS progress.
      flashcardProgress: { 'card-0': { status: 'known', lastReviewed: '2026-08-15T10:00:00.000Z', knownStreak: 2 } },
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') {
        return Promise.resolve(okJson(syncCalls === 0 ? { profiles: {} } : { profiles: { p1: profileWithProgress } }));
      }
      if (url === '/api/progress/sync') {
        syncCalls += 1;
        if (failChunkTwo && syncCalls === 2) return Promise.reject(new Error('network down'));
        return Promise.resolve(okJson({ synced: 100 }));
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    // First login: chunk 1 (100) applies, chunk 2 (20) fails → migration
    // aborts. The blob keeps the assigned ids and the device is NOT claimed.
    const first = renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    await waitFor(() => expect(syncCalls).toBe(2));
    const firstChunkIds = (syncBodies()[0].events as Array<{ attemptId: string }>).map((e) => e.attemptId);
    expect(firstChunkIds).toHaveLength(100);
    expect(store['iblearn_progress']).toBeDefined();
    expect(store['octav_anon_claimed']).toBeUndefined();
    first.unmount();

    // Next login: the server profile now HAS progress (chunk 1 applied) — the
    // retry must still run, re-send chunk 1 under the SAME ids (server no-ops)
    // and finish chunk 2, stamping the marker on the LAST chunk.
    failChunkTwo = false;
    renderProvider();
    await waitFor(() => expect(store['octav_anon_claimed']).toBe('1'));

    const bodies = syncBodies();
    expect(bodies).toHaveLength(4); // 2 (mount 1) + 2 (mount 2)
    const retryChunk1 = bodies[2];
    const retryChunk2 = bodies[3];
    expect(retryChunk1.events).toHaveLength(100);
    expect(retryChunk2.events).toHaveLength(20);
    expect(retryChunk1.markMigrationComplete).toBeUndefined();
    expect(retryChunk2.markMigrationComplete).toBe(true);
    // SAME ids re-sent — replay-safe (the server's attribute_not_exists
    // writes make the replayed 100 no-ops, so nothing duplicates).
    expect((retryChunk1.events as Array<{ attemptId: string }>).map((e) => e.attemptId)).toEqual(firstChunkIds);
    const retryIds = new Set([
      ...(retryChunk1.events as Array<{ attemptId: string }>).map((e) => e.attemptId),
      ...(retryChunk2.events as Array<{ attemptId: string }>).map((e) => e.attemptId),
    ]);
    expect(retryIds.size).toBe(120); // no fresh ids minted on retry
    // Success ordering preserved: blob cleared AFTER the marker landed.
    expect(store['iblearn_progress']).toBeUndefined();
  });

  it('does NOT purge the queue when a superseded me() settles first (StrictMode reload race)', async () => {
    // StrictMode double-runs the AuthContext mount effect → two me() calls;
    // the FIRST is superseded by the second. Its finally used to settle
    // `loaded` while user was still null — the identity effect then ran the
    // "logged out" branch and purged the pending queue on a plain reload.
    const resolvers: Array<(v: unknown) => void> = [];
    meMock.mockImplementation(() => new Promise((res) => resolvers.push(res)));
    store['octav_sync_queue'] = JSON.stringify([
      {
        userId: 'u1',
        profileId: 'p1',
        event: {
          type: 'flashcardResult',
          profileId: 'p1',
          cardId: 'queued-race',
          status: 'known',
          knownStreak: 2,
          date: '2026-08-15T10:00:00.000Z',
        },
      },
    ]);
    store['octav_progress:u1:p1'] = emptyBlob();
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return Promise.resolve(okJson({ profiles: {} }));
      if (url === '/api/progress/sync') return Promise.resolve(okJson({ synced: 100 }));
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    render(
      <StrictMode>
        <AuthProvider>
          <ProgressProvider>
            <Probe />
          </ProgressProvider>
        </AuthProvider>
      </StrictMode>
    );
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The FIRST (superseded) me() resolves: loaded must NOT settle, and the
    // queue must survive.
    act(() => {
      resolvers[0](USER);
    });
    await act(async () => {}); // flush the superseded continuation
    expect(screen.getByTestId('loaded').textContent).toBe('false');
    expect(store['octav_sync_queue']).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    // The CURRENT me() resolves: identity effect runs logged-in and the queue
    // flushes to the server.
    act(() => {
      resolvers[1](USER);
    });
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    await waitFor(() => {
      const bodies = syncBodies();
      expect(bodies).toHaveLength(1);
      expect(bodies[0].events).toHaveLength(1);
      expect(bodies[0].events[0].cardId).toBe('queued-race');
    });
  });

  it('holds the loaded flag until the merge settles on a new device (no flash of zero)', async () => {
    let resolveGet!: (r: ReturnType<typeof okJson>) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return new Promise((res) => { resolveGet = res; });
      return Promise.resolve(okJson({ synced: 100 }));
    });

    renderProvider();

    // Auth has resolved and the merge GET is pending → still not loaded.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId('loaded').textContent).toBe('false');

    resolveGet(okJson({ profiles: {} }));
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
  });

  it('renders local data immediately when the namespaced store already has data', async () => {
    store['octav_progress:u1:p1'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 7, currentStreakDays: 2, lastStudyDate: '2026-08-15' },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {
        'card-1': { status: 'known', lastReviewed: '2026-08-15T10:00:00.000Z', knownStreak: 1 },
      },
    });
    let resolveGet!: (r: ReturnType<typeof okJson>) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/progress') return new Promise((res) => { resolveGet = res; });
      return Promise.resolve(okJson({ synced: 100 }));
    });

    renderProvider();

    // Local data renders BEFORE the server merge answers (offline-first).
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('stars').textContent).toBe('7');
    expect(screen.getByTestId('cards').textContent).toBe('1');

    // Settle the pending merge so the test ends cleanly.
    resolveGet(okJson({ profiles: {} }));
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toBe('1'));
  });
});

describe('ProgressContext — anonymous store (logged out)', () => {
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
