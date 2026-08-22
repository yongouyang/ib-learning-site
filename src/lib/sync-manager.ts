import type { ProgressEvent } from './progress/types';
import { PROGRESS_MAX_EVENTS_PER_SYNC } from './progress/types';
import { getUserProgress, setSyncEventHook } from './progress-store';
import { toSyncClientMeta } from './progress-merge';

// Phase C — background sync queue (module-level, NOT React-bound). Offline-first:
// record* functions enqueue events synchronously into localStorage; this module
// drains them to the server in the background, silently (no user-visible
// errors). The queue survives reloads and offline stretches; it only ever
// holds events for a signed-in account + profile.

export interface SyncIdentity {
  userId: string;
  profileId: string;
}

interface QueueEntry {
  userId: string;
  profileId: string;
  event: ProgressEvent;
}

const QUEUE_KEY = 'octav_sync_queue';
const DEBOUNCE_MS = 30_000;
const BACKOFF_MS = [30_000, 60_000, 300_000] as const;

type IdentityProvider = () => SyncIdentity | null;

let getIdentity: IdentityProvider | null = null;
let initialized = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let inFlight = false;
let boundOnline: (() => void) | null = null;
let boundVisibility: (() => void) | null = null;

function readQueue(): QueueEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: QueueEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (entries.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors (private mode) — sync is best-effort.
  }
}

/** Clear the queue (logout / identity change). */
export function purgeQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/** Enqueue a single event, stamping the CURRENT identity (no identity → drop). */
export function enqueueEvent(event: ProgressEvent): void {
  const id = getIdentity?.();
  if (!id) return;
  const entries = readQueue();
  entries.push({ userId: id.userId, profileId: id.profileId, event });
  writeQueue(entries);
  scheduleFlush();
}

/**
 * Register the identity provider, wire the window listeners (online +
 * visibilitychange-when-visible), and set the progress-store enqueue hook to
 * `enqueueEvent`. Idempotent — transient state (backoff, timers) resets so
 * tests and re-login always start clean.
 */
export function initSyncManager(provider: IdentityProvider): void {
  getIdentity = provider;
  retryCount = 0;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  setSyncEventHook((event) => enqueueEvent(event));

  if (initialized) return;
  initialized = true;

  if (typeof window !== 'undefined') {
    boundOnline = () => {
      void flushNow();
    };
    boundVisibility = () => {
      if (document.visibilityState === 'visible') void flushNow();
    };
    window.addEventListener('online', boundOnline);
    document.addEventListener('visibilitychange', boundVisibility);
  }
}

/** Debounce a flush 30s after an enqueue (each enqueue resets the timer). */
export function scheduleFlush(): void {
  if (typeof window === 'undefined') return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flush();
  }, DEBOUNCE_MS);
}

/** Alias for an immediate flush (clears the debounce). */
export async function flushNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return flush();
}

/**
 * Drain the queue for the current identity. Never throws; errors are silent
 * (console.debug) with exponential backoff (30s → 60s → 300s cap, reset on
 * success). 401 (dead session) purges the queue.
 *
 * Round 2: the queue is sent in CHUNKS of at most PROGRESS_MAX_EVENTS_PER_SYNC
 * events (the server rejects larger batches with 400 BEFORE any write — an
 * oversize single POST would retry the identical payload forever). Per chunk:
 *   200 → that chunk's entries are removed and the next chunk is sent;
 *   400 → TERMINAL for that chunk: a schema rejection after client-side
 *         chunking means a real bug (or a corrupted queue entry) — log + drop
 *         the chunk, never loop on the identical payload;
 *   other → transient: schedule backoff and STOP the sequence — the remaining
 *           chunks stay queued (server writes are idempotent, replay is safe).
 */
export async function flush(): Promise<void> {
  const id = getIdentity?.();
  if (!id) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (typeof window === 'undefined') return;
  if (inFlight) return;

  const entries = readQueue();
  const matching = entries.filter((e) => e.userId === id.userId && e.profileId === id.profileId);
  if (matching.length === 0) return;

  const clientMeta = toSyncClientMeta(getUserProgress());

  inFlight = true;
  try {
    let offset = 0;
    while (offset < matching.length) {
      const chunk = matching.slice(offset, offset + PROGRESS_MAX_EVENTS_PER_SYNC);
      const res = await fetch('/api/progress/sync', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: chunk.map((e) => e.event), clientMeta }),
      });

      if (res.status === 200) {
        const body = (await res.json()) as { synced?: number };
        const synced = Math.min(body.synced ?? chunk.length, chunk.length);
        removeFirstMatching(id, synced);
        offset += synced;
        if (synced < chunk.length) {
          // Server applied fewer than sent (shouldn't happen after validation)
          // — the rest stay queued; stop to avoid an infinite tight loop.
          scheduleRetry();
          return;
        }
        continue;
      }

      if (res.status === 400) {
        // Terminal: schema rejection. After client-side chunking this means a
        // corrupted queue entry or a real contract bug — drop this chunk, log,
        // and NEVER retry the identical payload.
        console.debug('[sync] dropping chunk: server rejected the batch (400)');
        removeFirstMatching(id, chunk.length);
        // The dropped chunk is gone from the queue — advance past it so the
        // remaining chunks (a DIFFERENT payload) still drain in this run.
        offset += chunk.length;
        continue;
      }

      if (res.status === 401) {
        purgeQueue();
        retryCount = 0;
        return;
      }

      console.debug('[sync] flush failed with status', res.status);
      scheduleRetry();
      return;
    }
    retryCount = 0;
  } catch (err) {
    console.debug('[sync] flush failed (network)', err instanceof Error ? err.message : err);
    scheduleRetry();
  } finally {
    inFlight = false;
  }
}

/**
 * Remove the first N queue entries that belong to the GIVEN identity (the
 * identity captured when the flush started — round 3: never re-read the live
 * getIdentity(), or a logout→login-as-different-user completing within one
 * chunk's round-trip would remove the WRONG identity's entries).
 * Order-preserving — the queue drains front-to-back per identity.
 */
function removeFirstMatching(id: SyncIdentity, count: number): void {
  if (count <= 0) return;
  const entries = readQueue();
  let removed = 0;
  const remaining = entries.filter((e) => {
    if (removed < count && e.userId === id.userId && e.profileId === id.profileId) {
      removed++;
      return false;
    }
    return true;
  });
  writeQueue(remaining);
}

function scheduleRetry(): void {
  if (typeof window === 'undefined') return;
  if (retryTimer) clearTimeout(retryTimer);
  const delay = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)];
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
  retryCount++;
}
