import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initSyncManager,
  purgeQueue,
  enqueueEvent,
  flush,
  flushNow,
} from '@/lib/sync-manager';
import { recordQuizAttempt, setActiveNamespace, setSyncEventHook } from '@/lib/progress-store';
import type { ProgressEvent } from '@/lib/progress/types';

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
  // Reset progress-store module state between tests.
  setActiveNamespace(null, null);
  setSyncEventHook(null);
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function flashcardEvent(cardId: string, profileId = 'p1'): ProgressEvent {
  return {
    type: 'flashcardResult',
    profileId,
    cardId,
    status: 'known',
    knownStreak: 1,
    date: '2026-01-01T00:00:00.000Z',
  };
}

function seedQueue(entries: Array<{ userId: string; profileId: string; event: ProgressEvent }>): void {
  store['octav_sync_queue'] = JSON.stringify(entries);
}

function readQueue(): Array<{ userId: string; profileId: string; event: ProgressEvent }> {
  const raw = store['octav_sync_queue'];
  return raw ? JSON.parse(raw) : [];
}

function fetchBody(): { events: ProgressEvent[]; clientMeta: unknown } {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(init?.body as string);
}

describe('sync-manager enqueue', () => {
  it('stamps the current identity onto the queue entry (record → hook → queue)', () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    setActiveNamespace('u1', 'p1');
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);

    const queue = readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ userId: 'u1', profileId: 'p1' });
    expect(queue[0].event.type).toBe('quizAttempt');
    expect(queue[0].event.profileId).toBe('p1');
    expect((queue[0].event as { attemptId: string }).attemptId).toBeTruthy();
  });

  it('drops the event when there is no identity', () => {
    initSyncManager(() => null);
    enqueueEvent(flashcardEvent('c1'));
    expect(readQueue()).toEqual([]);
  });
});

describe('sync-manager flush', () => {
  it('sends ONLY the current identity\'s events', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') },
      { userId: 'u2', profileId: 'p2', event: flashcardEvent('c2', 'p2') },
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c3', 'p1') },
    ]);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ synced: 2 }) });

    await flushNow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/progress/sync');
    const body = fetchBody();
    expect(body.events.map((e) => (e as { cardId: string }).cardId)).toEqual(['c1', 'c3']);
    expect(body.clientMeta).toBeDefined();
  });

  it('removes exactly `synced` matching entries on 200, preserving others', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') },
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c2', 'p1') },
      { userId: 'u2', profileId: 'p2', event: flashcardEvent('c4', 'p2') },
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c3', 'p1') },
    ]);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ synced: 2 }) });

    await flushNow();

    const remaining = readQueue();
    expect(remaining.map((e) => (e.event as { cardId: string }).cardId)).toEqual(['c4', 'c3']); // first 2 matching removed
  });

  it('purges the queue on 401 (dead session)', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([{ userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') }]);
    fetchMock.mockResolvedValue({ status: 401, json: async () => ({ error: 'Not authenticated.' }) });

    await flushNow();

    expect(store['octav_sync_queue']).toBeUndefined();
  });

  it('does nothing when there is no identity', async () => {
    initSyncManager(() => null);
    seedQueue([{ userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') }]);

    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readQueue()).toHaveLength(1); // untouched
  });

  it('does nothing when offline', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([{ userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') }]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await flushNow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readQueue()).toHaveLength(1); // untouched

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('purgeQueue clears the queue', () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([{ userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') }]);
    purgeQueue();
    expect(store['octav_sync_queue']).toBeUndefined();
  });
});

describe('sync-manager chunking (round 2)', () => {
  function seedN(n: number): void {
    seedQueue(
      Array.from({ length: n }, (_, i) => ({
        userId: 'u1',
        profileId: 'p1',
        event: flashcardEvent(`c${i}`, 'p1'),
      }))
    );
  }

  it('splits a 250-event queue into 3 POSTs (100/100/50) and drains it', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedN(250);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ synced: 100 }) });

    await flushNow();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sizes = fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse((init as RequestInit).body as string) as { events: unknown[] };
      return body.events.length;
    });
    expect(sizes).toEqual([100, 100, 50]);
    expect(readQueue()).toEqual([]);
  });

  it('400 is terminal for a chunk: dropped once, never re-sent', async () => {
    vi.useFakeTimers();
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedN(150);
    fetchMock.mockResolvedValue({ status: 400, json: async () => ({ error: 'Bad request.' }) });

    await flushNow();

    // Chunk 1 (100) rejected → dropped; chunk 2 (50) also rejected → dropped.
    // Each payload is sent EXACTLY once — no retry loop on the identical body.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readQueue()).toEqual([]);
    expect(debug).toHaveBeenCalledWith('[sync] dropping chunk: server rejected the batch (400)');

    // No backoff retry was scheduled for the 400s — advancing time does nothing.
    await vi.advanceTimersByTimeAsync(400_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    debug.mockRestore();
  });

  it('stops mid-sequence on a transient 500 and keeps the REMAINING chunks queued', async () => {
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedN(250);
    fetchMock.mockResolvedValue({ status: 500, json: async () => ({ error: 'Server error.' }) });

    await flushNow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Nothing was removed — the failed chunk AND the two unsent chunks stay.
    expect(readQueue()).toHaveLength(250);
  });

  it('removes entries for the FLUSH-CAPTURED identity, not the live one (round 3)', async () => {
    // A logout→login-as-different-user completing within one chunk's
    // round-trip must not make the removal target the wrong identity's
    // entries (removeFirstMatching used to re-read the live getIdentity()).
    let identity: { userId: string; profileId: string } = { userId: 'u1', profileId: 'p1' };
    initSyncManager(() => identity);
    seedQueue([
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') },
      { userId: 'u2', profileId: 'p2', event: flashcardEvent('c2', 'p2') },
      { userId: 'u1', profileId: 'p1', event: flashcardEvent('c3', 'p1') },
    ]);
    fetchMock.mockImplementation(async (_url: unknown, init: unknown) => {
      identity = { userId: 'u2', profileId: 'p2' }; // identity switches mid-round-trip
      const body = JSON.parse((init as RequestInit).body as string) as { events: unknown[] };
      return { status: 200, json: async () => ({ synced: body.events.length }) };
    });

    await flushNow();

    // u1's two entries were sent and removed; u2's c2 must be untouched —
    // removing under the now-live u2 identity would have eaten c2 instead.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readQueue().map((e) => (e.event as { cardId: string }).cardId)).toEqual(['c2']);
  });
});

describe('sync-manager backoff', () => {
  it('is silent on network error, retains the queue, and retries with backoff', async () => {
    vi.useFakeTimers();
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    initSyncManager(() => ({ userId: 'u1', profileId: 'p1' }));
    seedQueue([{ userId: 'u1', profileId: 'p1', event: flashcardEvent('c1', 'p1') }]);
    fetchMock.mockRejectedValue(new Error('network down'));

    await flushNow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readQueue()).toHaveLength(1); // retained
    expect(debug).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000); // first backoff
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000); // second backoff
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(300_000); // cap
    expect(fetchMock).toHaveBeenCalledTimes(4);

    debug.mockRestore();
  });
});
