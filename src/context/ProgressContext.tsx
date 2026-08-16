'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { UserProgress, TopicProgress, SubjectId, ExamResult, LadderLevelResult, FlashcardProgress, QuestionResult } from '@/content/types';
import {
  getUserProgress,
  getAllTopicProgress,
  recordQuizAttempt,
  getRecentAverageScore,
  getExamResults,
  recordExamResult,
  getLadderProgress,
  recordLadderResult,
  getFlashcardProgress,
  recordFlashcardResult,
  setActiveNamespace,
  loadStoredData,
  saveStoredData,
  loadAnonymousData,
  saveAnonymousData,
  clearAnonymousData,
  isAnonymousClaimed,
  markAnonymousClaimed,
  assignMissingAttemptIds,
} from '@/lib/progress-store';
import {
  mergeProfileSnapshot,
  extractLocalEventsForProfile,
  toSyncClientMeta,
  EMPTY_PROFILE_SNAPSHOT,
  type StoredDataLike,
} from '@/lib/progress-merge';
import { initSyncManager, purgeQueue, enqueueEvent, flushNow, type SyncIdentity } from '@/lib/sync-manager';
import { PROGRESS_MAX_EVENTS_PER_SYNC, type ProgressEvent, type ProfileProgressSnapshot } from '@/lib/progress/types';
import { useAuth } from './AuthContext';

interface ProgressContextType {
  userProgress: UserProgress;
  topicProgress: TopicProgress[];
  examResults: ExamResult[];
  ladderProgress: Record<string, Record<number, LadderLevelResult>>;
  flashcardProgress: Record<string, FlashcardProgress>;
  /** False until the first localStorage load completes (after mount). */
  loaded: boolean;
  refresh: () => void;
  recordAttempt: (topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string, correct: number, total: number, questionResults?: QuestionResult[]) => void;
  recordExam: (result: ExamResult) => void;
  recordLadder: (courseId: string, level: number, score: number) => void;
  recordFlashcard: (cardId: string, status: 'known' | 'learning') => void;
  getSubjectScore: (subjectId: SubjectId) => number;
}

const ProgressContext = createContext<ProgressContextType | null>(null);

// Same defaults the server renders with (progress-store returns these when
// window is undefined) — state starts here so SSR and the first client render
// match, then real progress is loaded from localStorage after mount.
const SSR_DEFAULTS: UserProgress = { totalStars: 0, currentStreakDays: 0, lastStudyDate: null };

// --- Phase C login reconciliation helpers (silent — offline-first) -----------

/** GET /api/progress → per-profile snapshots. Throws on non-2xx. */
async function fetchSnapshots(): Promise<Record<string, ProfileProgressSnapshot>> {
  const res = await fetch('/api/progress', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`GET /api/progress ${res.status}`);
  const body = (await res.json()) as { profiles: Record<string, ProfileProgressSnapshot> };
  return body.profiles;
}

/** POST /api/progress/sync (bulk), CHUNKED (round 2). Throws on non-2xx. */
async function bulkSync(
  events: ProgressEvent[],
  clientMeta: UserProgress,
  opts: { markMigrationComplete?: boolean } = {}
): Promise<void> {
  for (let offset = 0; offset < events.length; offset += PROGRESS_MAX_EVENTS_PER_SYNC) {
    const chunk = events.slice(offset, offset + PROGRESS_MAX_EVENTS_PER_SYNC);
    const last = offset + chunk.length >= events.length;
    const res = await fetch('/api/progress/sync', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: chunk,
        clientMeta,
        // The migration marker is stamped only by the FINAL chunk — a partial
        // upload must not mark the migration complete.
        ...(opts.markMigrationComplete && last ? { markMigrationComplete: true } : {}),
      }),
    });
    if (!res.ok) throw new Error(`POST /api/progress/sync ${res.status}`);
  }
}

/**
 * Anonymous-data migration (C5): bulk-upload the anonymous `iblearn_progress`
 * blob into the active profile, at most once per DEVICE. The anonymous blob's
 * attempts are assigned ids ONCE and persisted BACK to the anonymous key — a
 * retried upload (partial failure, lost response) reuses the SAME ids, which
 * the server's attribute_not_exists writes make idempotent. On full success
 * the blob is cleared AND a device-side "claimed" flag is set, so later
 * accounts on the same device import nothing and a wiped server account
 * cannot re-import stale data.
 *
 * Round 3: the CALLER must not gate this on the server profile being empty —
 * a partially-applied chunked upload (chunk 1 landed server-side, a later
 * chunk failed) leaves the profile non-empty while the uncleared blob still
 * holds unsynced events; gating on "profile has progress" made that state
 * unrecoverable. The guards HERE (blob has data + device not claimed) are the
 * real gate: a retry re-uploads everything under the SAME ids, so the applied
 * chunks replay as no-ops and only the missing tail actually lands, then the
 * marker/clear/claim run once more.
 *
 * A future consent prompt can gate the CALL SITE of this function (in the
 * identity effect) without touching this implementation.
 */
async function migrateAnonymousData(
  profileId: string
): Promise<boolean> {
  const anon = loadAnonymousData();
  if (!storeHasData(anon)) return false;
  if (isAnonymousClaimed()) return false; // belt-and-braces device claim

  assignMissingAttemptIds(anon);
  saveAnonymousData(anon); // persist the ids to the ANONYMOUS blob (retry-safe)

  const events = extractLocalEventsForProfile(anon, profileId);
  if (events.length === 0) return false;

  await bulkSync(events, toSyncClientMeta(anon.userProgress), { markMigrationComplete: true });
  markAnonymousClaimed();
  clearAnonymousData();
  return true;
}

/** A local store has real progress when any non-META collection is non-empty. */
function storeHasData(d: StoredDataLike): boolean {
  return (
    Object.keys(d.topicProgress).length > 0 ||
    (d.examResults?.length ?? 0) > 0 ||
    Object.keys(d.ladderProgress ?? {}).length > 0 ||
    Object.keys(d.flashcardProgress ?? {}).length > 0
  );
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user, activeProfile, loaded: authLoaded } = useAuth();
  const [userProgress, setUserProgress] = useState<UserProgress>(SSR_DEFAULTS);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [ladderProgress, setLadderProgress] = useState<Record<string, Record<number, LadderLevelResult>>>({});
  const [flashcardProgress, setFlashcardProgress] = useState<Record<string, FlashcardProgress>>({});
  const [loaded, setLoaded] = useState(false);

  // Identity the sync manager reads (kept in a ref so its getIdentity closure
  // always sees the current value) + a generation counter to discard stale
  // async login reconciliations after a logout/profile switch.
  const identityRef = useRef<SyncIdentity | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(() => {
    setUserProgress(getUserProgress());
    setTopicProgress(getAllTopicProgress());
    setExamResults(getExamResults());
    setLadderProgress(getLadderProgress());
    setFlashcardProgress(getFlashcardProgress());
    setLoaded(true);
  }, []);

  // Wire the background sync queue once; getIdentity reads identityRef so the
  // enqueue hook always stamps the CURRENT identity (no identity → drop).
  useEffect(() => {
    initSyncManager(() => identityRef.current);
  }, []);

  const userId = user?.userId ?? null;
  const profileId = activeProfile?.profileId ?? null;

  // Identity change → re-route the store and (when logging in) reconcile
  // against the server. Round 2 gating: nothing destructive runs while auth
  // hasn't resolved (authLoaded === false) — on a reload of a logged-in
  // session the mount-time effect would otherwise run as "logged out" and
  // PURGE the pending queue before /me answered. The effect therefore runs
  // exactly once per GENUINE identity transition (real logout, account or
  // profile switch, first resolve) — the reload case never hits the
  // logged-out branch. Offline-first: local storage stays primary; every
  // fetch failure here is silent (console.debug).
  useEffect(() => {
    if (!authLoaded) return;

    identityRef.current = userId && profileId ? { userId, profileId } : null;
    const gen = ++generation.current;

    if (!userId || !profileId) {
      // Genuine logout: anonymous namespace + purge + refresh. Profile caches
      // stay on the device (documented). The purge drops queue-only
      // flashcard/ladder events (accepted — recorded in PROGRESS.md);
      // attempts/exams are re-derived from the namespaced store by the next
      // login's merge.
      setActiveNamespace(null, null);
      purgeQueue();
      refresh();
      return;
    }

    setActiveNamespace(userId, profileId);
    const hasLocalData = storeHasData(loadStoredData());
    if (hasLocalData) {
      // Returning user on THIS device: render local immediately (offline-first).
      refresh();
    }
    // New device / first login: hold the render until the merge settles so a
    // returning user never flashes zero stars (round 2, item 11). On failure
    // the catch below still refreshes (loaded flips true).

    void (async () => {
      try {
        // (a) the namespaced local store is already routed via setActiveNamespace.
        // (b) GET + merge for the active profile.
        const profiles = await fetchSnapshots();
        if (gen !== generation.current) return;
        const server = profiles[profileId] ?? EMPTY_PROFILE_SNAPSHOT;
        const { merged, localOnlyEvents } = mergeProfileSnapshot(server, loadStoredData(), profileId);
        saveStoredData(merged);
        for (const e of localOnlyEvents) enqueueEvent(e);
        refresh();

        // (c) anonymous-data migration (silent import, at-most-once per
        //     device — a future consent prompt gates THIS call site). Round 3:
        //     NOT gated on the server profile being empty — a partially
        //     applied chunked upload leaves the profile non-empty while the
        //     uncleared anon blob still holds unsynced events, and gating on
        //     profileHasProgress made that unrecoverable. The function's own
        //     guards (blob has data + device not claimed) plus the persisted
        //     ids make every retry idempotent.
        const migrated = await migrateAnonymousData(profileId);
        if (migrated && gen === generation.current) {
          const profiles2 = await fetchSnapshots();
          if (gen !== generation.current) return;
          const server2 = profiles2[profileId] ?? EMPTY_PROFILE_SNAPSHOT;
          const result2 = mergeProfileSnapshot(server2, loadStoredData(), profileId);
          saveStoredData(result2.merged);
          for (const e of result2.localOnlyEvents) enqueueEvent(e);
          refresh();
        }
      } catch (err) {
        console.debug('[progress] login sync failed (offline-first: local storage stays primary)', err instanceof Error ? err.message : err);
        if (gen === generation.current) refresh(); // render local (possibly empty) rather than a stuck skeleton
      }
      // (d) flush any events enqueued above (and any others for this identity).
      if (gen === generation.current) void flushNow();
    })();
  }, [userId, profileId, authLoaded, refresh]);

  const recordAttempt = useCallback((
    topicId: string, subjectId: SubjectId, topicTitle: string, subjectTitle: string,
    correct: number, total: number, questionResults?: QuestionResult[]
  ) => {
    recordQuizAttempt(topicId, subjectId, topicTitle, subjectTitle, correct, total, questionResults);
    refresh();
  }, [refresh]);

  const recordExam = useCallback((result: ExamResult) => {
    recordExamResult(result);
    refresh();
  }, [refresh]);

  const recordLadder = useCallback((courseId: string, level: number, score: number) => {
    recordLadderResult(courseId, level, score);
    refresh();
  }, [refresh]);

  const recordFlashcard = useCallback((cardId: string, status: 'known' | 'learning') => {
    recordFlashcardResult(cardId, status);
    refresh();
  }, [refresh]);

  const getSubjectScore = useCallback((subjectId: SubjectId): number => {
    const subjectProgress = topicProgress.filter(tp => tp.subjectId === subjectId && tp.attempts.length > 0);
    if (subjectProgress.length === 0) return 0;
    const total = subjectProgress.reduce((sum, tp) => sum + getRecentAverageScore(tp.attempts), 0);
    return total / subjectProgress.length;
  }, [topicProgress]);

  return (
    <ProgressContext.Provider value={{ userProgress, topicProgress, examResults, ladderProgress, flashcardProgress, loaded, refresh, recordAttempt, recordExam, recordLadder, recordFlashcard, getSubjectScore }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
