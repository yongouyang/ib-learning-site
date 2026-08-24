import { describe, it, expect, vi } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import type { AuthDeps } from '@/lib/auth/types';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import { handleForProfile } from '@/lib/leaderboard/handles';
import { weekKeyFor, OPEN_COHORT, scopeWeekPartitionKey } from '@/lib/leaderboard/types';
import { handleProgressSync } from '@/lib/progress/http-handler';
import type { ProgressDeps } from '@/lib/progress/deps';

// Phase D4 (docs/leaderboard-plan.md §4.1/§6): XP accrual inside the progress
// sync handler. One fresh in-memory universe per test (the SAME instance is
// the ProgressStorage AND the LeaderboardStorage — the dev/e2e stand-in for
// the shared tables); sessions are seeded through the real auth handlers.
//
// The clock is FROZEN at 2026-08-19 (Wednesday of ISO week 2026-W34) so week
// attribution is deterministic: XP always credits the CURRENT server week,
// never the client event date.

const DUMMY_CODE = '123456';
const NOW_MS = Date.parse('2026-08-19T12:00:00.000Z'); // Wednesday of 2026-W34
const CURRENT_WEEK = weekKeyFor(NOW_MS);
const CURRENT_DATE = '2026-08-19';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `xp-${counter}@example.com`;
}

interface TestDeps {
  storage: InMemoryLeaderboardStorage;
  authDeps: AuthDeps;
  progressDeps: ProgressDeps;
  setNow: (ms: number) => void;
}

function makeDeps(opts: { leaderboardStorage?: ProgressDeps['leaderboardStorage'] | null } = {}): TestDeps {
  let now = NOW_MS;
  const clock = () => now;
  const storage = new InMemoryLeaderboardStorage(clock);
  const sender = new DummyEmailSender();
  return {
    storage,
    authDeps: { storage, emailSender: sender, testMode: true, dummyMode: true },
    progressDeps: {
      storage,
      // null = explicitly NOT wired (the pre-D7 LEADERBOARD_TABLE-absent case).
      leaderboardStorage: opts.leaderboardStorage === null ? undefined : (opts.leaderboardStorage ?? storage),
      clock,
    },
    setNow: (ms) => {
      now = ms;
    },
  };
}

function jsonRequest(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No Set-Cookie header');
  return setCookie.split(';')[0].split('=')[1] ?? '';
}

async function login(t: TestDeps, email = uniqueEmail()) {
  await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.authDeps);
  const res = await handleVerifyOtp(
    jsonRequest('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
    t.authDeps
  );
  expect(res.status).toBe(200);
  return { cookie: `octav_session=${cookieFrom(res)}`, user: (await res.json()).user };
}

/** Opt the (default ks3) child profile into the leaderboard. */
async function optIn(t: TestDeps, user: { userId: string; childProfiles: { profileId: string; displayName: string; stage: 'ks3' }[] }) {
  await t.storage.updateUser(user.userId, {
    childProfiles: user.childProfiles.map((p) => ({ ...p, leaderboardOptIn: true })),
  });
}

// --- Event factories ----------------------------------------------------------

function quizEvent(profileId: string, attemptId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'quizAttempt',
    profileId,
    attemptId,
    topicId: 'math-yr7-algebra-1',
    subjectId: 'math',
    topicTitle: 'Algebra',
    subjectTitle: 'Math',
    correctCount: 7,
    totalCount: 10,
    date: '2026-08-19T09:00:00.000Z',
    ...overrides,
  };
}

function examEvent(profileId: string, attemptId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'examResult',
    profileId,
    attemptId,
    examId: 'math-y7-set-1',
    correctCount: 12,
    totalCount: 20,
    secondsUsed: 600,
    date: '2026-08-19T09:00:00.000Z',
    ...overrides,
  };
}

function ladderEvent(profileId: string, level: number, score: number) {
  return {
    type: 'ladderResult',
    profileId,
    courseId: 'math-y7',
    level,
    score,
    date: '2026-08-19T09:00:00.000Z',
  };
}

function flashcardEvent(profileId: string, status: 'known' | 'learning', date: string, cardId = 'card-1') {
  return {
    type: 'flashcardResult',
    profileId,
    cardId,
    status,
    knownStreak: status === 'known' ? 2 : 0,
    date,
  };
}

function syncBody(events: unknown[]) {
  return { events, clientMeta: { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-08-19T09:00:00.000Z' } };
}

/** The profile's row on its stage board for the CURRENT server week. */
async function boardRow(t: TestDeps, profileId: string, weekKey = CURRENT_WEEK) {
  const board = await t.storage.listBoard('stage:ks3', weekKey);
  return board.find((r) => r.entry === profileId) ?? null;
}

describe('D4 — XP accrual in the progress sync handler', () => {
  it('an opted-out profile earns nothing and writes no leaderboard rows or XP buckets', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const profileId = user.childProfiles[0].profileId;

    const res = await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
      t.progressDeps
    );
    expect(res.status).toBe(200);
    // Progress still landed…
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(1);
    // …but no leaderboard row and no bucket writes (the repeat-ordinal bucket
    // is untouched: a later direct increment starts at 1).
    expect(await boardRow(t, profileId)).toBeNull();
    expect(await t.storage.incrementXpTopicBucket(profileId, 'math-yr7-algebra-1', CURRENT_WEEK)).toBe(1);
    expect(await t.storage.incrementXpDayBucket(profileId, CURRENT_DATE, 10, 500)).toBe(10);
  });

  it('an opted-in quiz attempt awards 10×correct into the profile stage board for the CURRENT server week', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    const res = await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
      t.progressDeps
    );
    expect(res.status).toBe(200);

    const row = await boardRow(t, profileId);
    expect(row).not.toBeNull();
    expect(row!.xp).toBe(70); // 10 × 7, no perfect bonus
    expect(row!.userId).toBe(user.userId);
    expect(row!.handle).toBe(handleForProfile(profileId));
    expect(row!.scopeWeek).toBe(scopeWeekPartitionKey('stage:ks3', CURRENT_WEEK));
    expect(row!.cohortId).toBe(OPEN_COHORT);
    expect(row!.lastEarnedAt).toBe(new Date(NOW_MS).toISOString());
  });

  it('a perfect quiz adds the +20 bonus', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    await handleProgressSync(
      jsonRequest(
        'POST',
        'https://x.test/api/progress/sync',
        syncBody([quizEvent(profileId, 'a1', { correctCount: 10, totalCount: 10 })]),
        { cookie }
      ),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(120); // 10 × 10 + 20
  });

  it('a replayed sync (same attemptId) awards zero on the second send', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    const batch = syncBody([quizEvent(profileId, 'a1')]);
    expect(
      (await handleProgressSync(jsonRequest('POST', 'https://x.test/api/progress/sync', batch, { cookie }), t.progressDeps)).status
    ).toBe(200);
    expect(
      (await handleProgressSync(jsonRequest('POST', 'https://x.test/api/progress/sync', batch, { cookie }), t.progressDeps)).status
    ).toBe(200);

    expect((await boardRow(t, profileId))!.xp).toBe(70); // unchanged by the replay
  });

  it('diminishing repeats: 3rd–5th same-topic attempts halve, the 6th earns zero', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    // Six DISTINCT attempts at the same topic, each 10/10 (raw 120).
    for (let i = 1; i <= 6; i++) {
      const res = await handleProgressSync(
        jsonRequest(
          'POST',
          'https://x.test/api/progress/sync',
          syncBody([quizEvent(profileId, `grind-${i}`, { correctCount: 10, totalCount: 10 })]),
          { cookie }
        ),
        t.progressDeps
      );
      expect(res.status).toBe(200);
    }
    // Ordinals 1,2 → 120 each; 3,4,5 → 60 each; 6 → 0. Total 420.
    expect((await boardRow(t, profileId))!.xp).toBe(120 + 120 + 60 + 60 + 60);
  });

  it('the daily cap (500) clamps within one sync and across syncs; the next UTC day resets', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;
    const perfectExam = (attemptId: string) => examEvent(profileId, attemptId, { correctCount: 20, totalCount: 20 }); // raw 440

    // One sync, three perfect exams: 440 + 60 (clamped) + 0 → exactly 500.
    const res = await handleProgressSync(
      jsonRequest(
        'POST',
        'https://x.test/api/progress/sync',
        syncBody([perfectExam('e1'), perfectExam('e2'), perfectExam('e3')]),
        { cookie }
      ),
      t.progressDeps
    );
    expect(res.status).toBe(200);
    expect((await boardRow(t, profileId))!.xp).toBe(500);

    // A later sync the same (server) day earns nothing more.
    await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([perfectExam('e4')]), { cookie }),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(500);

    // The next UTC day is a fresh daily bucket (same server week).
    t.setNow(NOW_MS + 24 * 60 * 60 * 1000);
    await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([perfectExam('e5')]), { cookie }),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(500 + 440);
  });

  it('flashcards: 2 XP per newly-known card — only on a not-known → known transition', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;
    const sync = (events: unknown[]) =>
      handleProgressSync(jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody(events), { cookie }), t.progressDeps);

    // First known: +2.
    await sync([flashcardEvent(profileId, 'known', '2026-08-19T09:00:00.000Z')]);
    expect((await boardRow(t, profileId))!.xp).toBe(2);

    // Idempotent replay (equal lastReviewed re-writes, prev status 'known'): +0.
    await sync([flashcardEvent(profileId, 'known', '2026-08-19T09:00:00.000Z')]);
    expect((await boardRow(t, profileId))!.xp).toBe(2);

    // Lapse to learning (newer review): +0.
    await sync([flashcardEvent(profileId, 'learning', '2026-08-19T10:00:00.000Z')]);
    expect((await boardRow(t, profileId))!.xp).toBe(2);

    // Re-learned after the lapse — a NEW not-known → known transition: +2 again.
    await sync([flashcardEvent(profileId, 'known', '2026-08-19T11:00:00.000Z')]);
    expect((await boardRow(t, profileId))!.xp).toBe(4);

    // A stale (older) write is rejected by LWW and earns nothing.
    await sync([flashcardEvent(profileId, 'learning', '2026-08-19T08:00:00.000Z')]);
    expect((await boardRow(t, profileId))!.xp).toBe(4);
  });

  it('ladder: a first pass awards 30×level; a higher re-clear or a below-threshold score awards nothing', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;
    const sync = (events: unknown[]) =>
      handleProgressSync(jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody(events), { cookie }), t.progressDeps);

    // Below the 0.6 pass threshold (LADDER_UNLOCK_SCORE): improved, but no clear → 0.
    await sync([ladderEvent(profileId, 2, 0.5)]);
    expect(await boardRow(t, profileId)).toBeNull();

    // First clear (0.5 → 0.7): +60 (30 × level 2).
    await sync([ladderEvent(profileId, 2, 0.7)]);
    expect((await boardRow(t, profileId))!.xp).toBe(60);

    // Higher re-clear of the already-passed level: +0.
    await sync([ladderEvent(profileId, 2, 0.9)]);
    expect((await boardRow(t, profileId))!.xp).toBe(60);

    // Replay of a synced score (equal → not improved): +0.
    await sync([ladderEvent(profileId, 2, 0.9)]);
    expect((await boardRow(t, profileId))!.xp).toBe(60);

    // First clear of another level: +90 (30 × level 3).
    await sync([ladderEvent(profileId, 3, 0.8)]);
    expect((await boardRow(t, profileId))!.xp).toBe(150);
  });

  it('an exam result awards 20×correct + 40 on a perfect paper', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([examEvent(profileId, 'e1')]), { cookie }),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(240); // 20 × 12

    // A perfect paper is raw 440, but the daily cap (500) clamps it to 260 here.
    await handleProgressSync(
      jsonRequest(
        'POST',
        'https://x.test/api/progress/sync',
        syncBody([examEvent(profileId, 'e2', { correctCount: 20, totalCount: 20 })]),
        { cookie }
      ),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(500);

    // The same perfect paper earns the full 440 on a fresh UTC day.
    t.setNow(NOW_MS + 24 * 60 * 60 * 1000);
    await handleProgressSync(
      jsonRequest(
        'POST',
        'https://x.test/api/progress/sync',
        syncBody([examEvent(profileId, 'e3', { correctCount: 20, totalCount: 20 })]),
        { cookie }
      ),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.xp).toBe(500 + 440);
  });

  it('a client-dated event from LAST week earns in the CURRENT server week (week attribution)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    // The event date is Wednesday of 2026-W33; the server clock is in 2026-W34.
    await handleProgressSync(
      jsonRequest(
        'POST',
        'https://x.test/api/progress/sync',
        syncBody([quizEvent(profileId, 'late-1', { date: '2026-08-12T09:00:00.000Z' })]),
        { cookie }
      ),
      t.progressDeps
    );
    expect((await boardRow(t, profileId, CURRENT_WEEK))!.xp).toBe(70);
    expect(await t.storage.listBoard('stage:ks3', '2026-W33')).toEqual([]); // finished board untouched
  });

  it('uses the stored leaderboardHandle when the profile has one (the one allowed change)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const profileId = user.childProfiles[0].profileId;
    await t.storage.updateUser(user.userId, {
      childProfiles: user.childProfiles.map((p: { profileId: string; displayName: string; stage: 'ks3' }) => ({
        ...p,
        leaderboardOptIn: true,
        leaderboardHandle: 'Custom Condor',
      })),
    });

    await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
      t.progressDeps
    );
    expect((await boardRow(t, profileId))!.handle).toBe('Custom Condor');
  });

  it('awarding is disabled when no leaderboardStorage is wired (LEADERBOARD_TABLE absent — pre-D7)', async () => {
    const t = makeDeps({ leaderboardStorage: null });
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    const res = await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
      t.progressDeps
    );
    expect(res.status).toBe(200);
    expect(await boardRow(t, profileId)).toBeNull();
    expect(await t.storage.incrementXpTopicBucket(profileId, 'math-yr7-algebra-1', CURRENT_WEEK)).toBe(1); // untouched
  });

  it('a leaderboard-storage failure does NOT fail the sync (progress durability outranks XP)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'addXp') {
          return async () => {
            throw new Error('leaderboard table missing');
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await handleProgressSync(
        jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
        { storage: t.storage, leaderboardStorage: failing, clock: () => NOW_MS }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).synced).toBe(1);
      // mockRestore clears the call history — assert BEFORE restoring.
      expect(errorSpy).toHaveBeenCalledWith('[progress] leaderboard XP award failed:', 'leaderboard table missing');
    } finally {
      errorSpy.mockRestore();
    }
    // The progress write landed despite the award failure.
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(1);
  });

  it('a bucket-write failure does NOT fail the sync either', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await optIn(t, user);
    const profileId = user.childProfiles[0].profileId;

    const failingStorage = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'incrementXpTopicBucket') {
          return async () => {
            throw new Error('rate-limits table throttled');
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await handleProgressSync(
        jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'a1')]), { cookie }),
        { storage: failingStorage, leaderboardStorage: t.storage, clock: () => NOW_MS }
      );
      expect(res.status).toBe(200);
      // mockRestore clears the call history — assert BEFORE restoring.
      expect(errorSpy).toHaveBeenCalledWith('[progress] leaderboard XP award failed:', 'rate-limits table throttled');
    } finally {
      errorSpy.mockRestore();
    }
    expect((await boardRow(t, profileId))).toBeNull(); // no partial award
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(1);
  });
});
