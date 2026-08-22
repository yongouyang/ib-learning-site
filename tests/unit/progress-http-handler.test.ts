import { describe, it, expect, beforeEach } from 'vitest';
import { handleRequestOtp, handleVerifyOtp, handleDeleteAccount, handleExportGet } from '@/lib/auth/http-handler';
import { hashSessionToken } from '@/lib/auth/types';
import { DummyEmailSender } from '@/lib/auth/dummy';
import { InMemoryProgressStorage } from '@/lib/progress/dummy';
import { handleProgressGet, handleProgressSync, handleProgressHealth } from '@/lib/progress/http-handler';
import type { ProgressDeps } from '@/lib/progress/deps';
import type { AuthDeps } from '@/lib/auth/types';

// Handler-level progress tests: one shared in-memory universe (the SAME
// storage instance feeds the auth handlers for login and the progress
// handlers) — the dev/e2e stand-in for the shared DynamoDB tables.

const DUMMY_CODE = '123456';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `progress-${counter}@example.com`;
}

interface TestDeps {
  storage: InMemoryProgressStorage;
  authDeps: AuthDeps;
  progressDeps: ProgressDeps;
}

function makeDeps(): TestDeps {
  const storage = new InMemoryProgressStorage();
  const sender = new DummyEmailSender();
  return {
    storage,
    authDeps: { storage, emailSender: sender, testMode: true, dummyMode: true },
    progressDeps: { storage },
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
  const token = cookieFrom(res);
  return { cookie: `octav_session=${token}`, user: (await res.json()).user };
}

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
    date: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

function syncBody(events: unknown[], clientMeta: Record<string, unknown> = { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-08-15T10:00:00.000Z' }) {
  return { events, clientMeta };
}

describe('GET /api/progress', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleProgressGet(new Request('https://x.test/api/progress'), t.progressDeps);
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns an empty snapshot for a fresh account', async () => {
    const t = makeDeps();
    const { cookie } = await login(t);
    const res = await handleProgressGet(
      new Request('https://x.test/api/progress', { headers: { cookie } }),
      t.progressDeps
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profiles: {} });
    // Authenticated reads re-issue the sliding cookie (session.ts).
    expect(res.headers.get('set-cookie')).toContain('Max-Age=');
  });
});

describe('POST /api/progress/sync', () => {
  let t: TestDeps;
  let cookie: string;
  let user: { userId: string; childProfiles: { profileId: string }[] };

  beforeEach(async () => {
    t = makeDeps();
    const loggedIn = await login(t);
    cookie = loggedIn.cookie;
    user = loggedIn.user;
  });

  const sync = (body: unknown, headers: Record<string, string> = { cookie }) =>
    handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', body, headers),
      t.progressDeps
    );

  it('requires authentication', async () => {
    const res = await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([])),
      t.progressDeps
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when the durable per-user sync budget is spent', async () => {
    // Stub the storage's budget check closed so the handler's 429 path is
    // exercised deterministically (the budget semantics themselves are covered
    // by the storage + parity tests).
    t.storage.incrementProgressSyncCount = async () => false;
    const profileId = user.childProfiles[0].profileId;
    const res = await sync(syncBody([quizEvent(profileId, 'attempt-budgeted')]));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Too many syncs/);
    // The 429 fires BEFORE any write — nothing was persisted.
    expect(await t.storage.listProgressByUser(user.userId)).toEqual([]);
  });

  it('stores a quiz attempt and serves it back via GET', async () => {
    const profileId = user.childProfiles[0].profileId;
    const res = await sync(syncBody([quizEvent(profileId, 'attempt-1')]));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
    expect(body.serverMeta.totalStars).toBe(3);

    const get = await handleProgressGet(
      new Request('https://x.test/api/progress', { headers: { cookie } }),
      t.progressDeps
    );
    const snapshot = (await get.json()).profiles[profileId];
    expect(snapshot).toBeDefined();
    expect(snapshot.topicProgress['math:math-yr7-algebra-1'].attempts).toHaveLength(1);
    expect(snapshot.userProgress.lastStudyDate).toBe('2026-08-15T10:00:00.000Z');
  });

  it('is idempotent: replaying the same batch does not duplicate attempts', async () => {
    const profileId = user.childProfiles[0].profileId;
    const batch = syncBody([quizEvent(profileId, 'attempt-1')]);
    expect((await sync(batch)).status).toBe(200);
    const replay = await sync(batch);
    expect(replay.status).toBe(200);
    expect((await replay.json()).synced).toBe(1);

    const get = await handleProgressGet(
      new Request('https://x.test/api/progress', { headers: { cookie } }),
      t.progressDeps
    );
    const snapshot = (await get.json()).profiles[profileId];
    expect(snapshot.topicProgress['math:math-yr7-algebra-1'].attempts).toHaveLength(1);
  });

  it('rejects events for a profileId that is NOT one of the user\'s child profiles (IDOR)', async () => {
    // A different account's profileId (rule 5: identity from the session, not
    // the payload — a foreign profileId is data and must not be writable).
    const other = makeDeps();
    const otherLogin = await login(other);
    const foreignProfileId = otherLogin.user.childProfiles[0].profileId;

    const res = await sync(syncBody([quizEvent(foreignProfileId, 'attempt-x')]));
    expect(res.status).toBe(400);
    // Nothing was written for the foreign profile.
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(0);
  });

  it('rejects a batch spanning multiple profiles (single-profile contract)', async () => {
    const own = user.childProfiles[0].profileId;
    const res = await sync(
      syncBody([quizEvent(own, 'a1'), quizEvent('someone-else', 'a2')])
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed events and oversize batches (400, nothing applied)', async () => {
    const profileId = user.childProfiles[0].profileId;
    const tooMany = Array.from({ length: 101 }, (_, i) => quizEvent(profileId, `a-${i}`));
    expect((await sync(syncBody(tooMany))).status).toBe(400);

    const badQuestion = quizEvent(profileId, 'b1', {
      questionResults: Array.from({ length: 201 }, (_, i) => ({ questionId: `q${i}`, correct: true })),
    });
    expect((await sync(syncBody([badQuestion]))).status).toBe(400);

    const badCount = quizEvent(profileId, 'b2', { correctCount: -1 });
    expect((await sync(syncBody([badCount]))).status).toBe(400);

    const badDate = quizEvent(profileId, 'b3', { date: 'not-a-date' });
    expect((await sync(syncBody([badDate]))).status).toBe(400);

    // The failed batches wrote nothing.
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(0);
  });

  it('rejects round-2 hardening cases: clock skew, id charset, huge totals (400)', async () => {
    const profileId = user.childProfiles[0].profileId;

    // A client clock > 24h ahead of the server is rejected (skew clamp).
    const skewed = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect((await sync(syncBody([quizEvent(profileId, 'skew-1', { date: skewed })]))).status).toBe(400);

    // Ids must match /^[A-Za-z0-9_-]+$/ — '#' (and friends) are rejected.
    expect((await sync(syncBody([quizEvent(profileId, 'bad#id')]))).status).toBe(400);
    expect((await sync(syncBody([quizEvent(profileId, 'a1', { topicId: 'has space' })]))).status).toBe(400);

    // totalStars over the cap is rejected.
    expect(
      (
        await sync(
          syncBody([quizEvent(profileId, 'stars-1')], {
            totalStars: 2_000_000,
            currentStreakDays: 1,
            lastStudyDate: '2026-08-15T10:00:00.000Z',
          })
        )
      ).status
    ).toBe(400);

    // None of the rejected batches wrote anything.
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(0);
  });

  it('ladder levels max-win and never regress on replay', async () => {
    const profileId = user.childProfiles[0].profileId;
    const ladderEvent = (score: number) => ({
      type: 'ladderResult',
      profileId,
      courseId: 'math-y7',
      level: 1,
      score,
      date: '2026-08-15T10:00:00.000Z',
    });
    await sync(syncBody([ladderEvent(0.5)]));
    await sync(syncBody([ladderEvent(0.9)]));
    await sync(syncBody([ladderEvent(0.7)])); // must not regress
    expect((await sync(syncBody([ladderEvent(0.9)]))).status).toBe(200); // replay

    const get = await handleProgressGet(
      new Request('https://x.test/api/progress', { headers: { cookie } }),
      t.progressDeps
    );
    const levels = (await get.json()).profiles[profileId].ladderProgress['math-y7'];
    expect(levels['1'].bestScore).toBe(0.9);
  });

  it('flashcards are last-write-wins by review timestamp (older writes rejected)', async () => {
    const profileId = user.childProfiles[0].profileId;
    const cardEvent = (date: string, status: 'known' | 'learning') => ({
      type: 'flashcardResult',
      profileId,
      cardId: 'bio-cell-1-f1',
      status,
      knownStreak: status === 'known' ? 2 : 0,
      date,
    });
    await sync(syncBody([cardEvent('2026-08-15T12:00:00.000Z', 'known')]));
    await sync(syncBody([cardEvent('2026-08-15T11:00:00.000Z', 'learning')])); // older → rejected

    const get = await handleProgressGet(
      new Request('https://x.test/api/progress', { headers: { cookie } }),
      t.progressDeps
    );
    const card = (await get.json()).profiles[profileId].flashcardProgress['bio-cell-1-f1'];
    expect(card.status).toBe('known');
    expect(card.knownStreak).toBe(2);
  });

  it('meta is a per-field max-merge (stars never regress)', async () => {
    const profileId = user.childProfiles[0].profileId;
    await sync(syncBody([quizEvent(profileId, 'm1')], { totalStars: 10, currentStreakDays: 3, lastStudyDate: '2026-08-15T10:00:00.000Z' }));
    const lower = await sync(
      syncBody([quizEvent(profileId, 'm2')], { totalStars: 2, currentStreakDays: 4, lastStudyDate: '2026-08-16T10:00:00.000Z' })
    );
    expect(lower.status).toBe(200);
    const serverMeta = (await lower.json()).serverMeta;
    expect(serverMeta.totalStars).toBe(10); // max wins
    expect(serverMeta.currentStreakDays).toBe(4); // newer streak wins
  });

  it('accepts the client\'s date-only lastStudyDate (client contract)', async () => {
    const profileId = user.childProfiles[0].profileId;
    const res = await sync(
      syncBody([quizEvent(profileId, 'd1')], { totalStars: 1, currentStreakDays: 1, lastStudyDate: '2026-08-15' })
    );
    expect(res.status).toBe(200);
    const serverMeta = (await res.json()).serverMeta;
    expect(serverMeta.lastStudyDate).toBe('2026-08-15');
  });

  it('rejects a far-future lastStudyDate (round 3: irreversible max-merge) with nothing written', async () => {
    const profileId = user.childProfiles[0].profileId;

    // A far-future lastStudyDate would MAX-merge permanently (it can never
    // merge back down) — reject past now+24h, batch-atomically like events.
    for (const bad of ['9999-12-31', '9999-12-31T00:00:00.000Z', '9999-99-99']) {
      const res = await sync(
        syncBody([quizEvent(profileId, `fut-${bad.length}`)], {
          totalStars: 1,
          currentStreakDays: 1,
          lastStudyDate: bad,
        })
      );
      expect(res.status, `lastStudyDate ${bad} should be rejected`).toBe(400);
    }
    const items = await t.storage.listProgressByUser(user.userId);
    expect(items.filter((i) => i.dataType.startsWith('TOPIC#'))).toHaveLength(0);

    // Today (date-only) and yesterday are accepted.
    const today = new Date().toISOString().slice(0, 10);
    const ok = await sync(
      syncBody([quizEvent(profileId, 'ok-today')], { totalStars: 1, currentStreakDays: 1, lastStudyDate: today })
    );
    expect(ok.status).toBe(200);
  });

  it('stamps the migration marker exactly once per profile (C5)', async () => {
    const profileId = user.childProfiles[0].profileId;
    const body = { ...syncBody([quizEvent(profileId, 'mig-1')]), markMigrationComplete: true };
    expect((await sync(body)).status).toBe(200);

    const meta = await t.storage.getMeta(user.userId, profileId);
    expect(meta?.migrationCompletedAt).toBeTruthy();

    // Replay with the flag → marker unchanged (idempotent).
    expect((await sync(body)).status).toBe(200);
    const metaAgain = await t.storage.getMeta(user.userId, profileId);
    expect(metaAgain?.migrationCompletedAt).toBe(meta?.migrationCompletedAt);
  });

  it('rejects a sync with a dead session (401)', async () => {
    const profileId = user.childProfiles[0].profileId;
    const { cookie: otherCookie } = await login(t);
    // Kill the first session server-side.
    await t.storage.deleteSession(hashSessionToken(otherCookie.split('=')[1] ?? ''));
    const res = await handleProgressSync(
      jsonRequest('POST', 'https://x.test/api/progress/sync', syncBody([quizEvent(profileId, 'dead-1')]), { cookie: otherCookie }),
      t.progressDeps
    );
    expect(res.status).toBe(401);
  });
});

describe('export / delete-account integration', () => {
  it('delete-account erases seeded progress items (round-1 finding, now tested)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const profileId = user.childProfiles[0].profileId;

    // Seed progress via the storage interface.
    await t.storage.putTopicAttempt({
      userId: user.userId,
      dataType: `TOPIC#${profileId}#math:math-yr7-algebra-1#seed-1`,
      profileId,
      attemptId: 'seed-1',
      subjectId: 'math',
      topicId: 'math-yr7-algebra-1',
      topicTitle: 'Algebra',
      subjectTitle: 'Math',
      date: '2026-08-15T10:00:00.000Z',
      correctCount: 5,
      totalCount: 10,
    });
    expect(await t.storage.listProgressByUser(user.userId)).toHaveLength(1);

    const del = await handleDeleteAccount(
      jsonRequest('POST', 'https://x.test/api/auth/delete', undefined, { cookie }),
      t.authDeps
    );
    expect(del.status).toBe(200);
    expect(await t.storage.listProgressByUser(user.userId)).toEqual([]);
  });

  it('export includes the seeded progress items in a readable shape', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const profileId = user.childProfiles[0].profileId;

    await t.storage.putTopicAttempt({
      userId: user.userId,
      dataType: `TOPIC#${profileId}#math:math-yr7-algebra-1#exp-1`,
      profileId,
      attemptId: 'exp-1',
      subjectId: 'math',
      topicId: 'math-yr7-algebra-1',
      topicTitle: 'Algebra',
      subjectTitle: 'Math',
      date: '2026-08-15T10:00:00.000Z',
      correctCount: 8,
      totalCount: 10,
    });

    const res = await handleExportGet(
      new Request('https://x.test/api/auth/export', { headers: { cookie } }),
      t.authDeps
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress).toHaveLength(1);
    expect(data.progress[0]).toMatchObject({ attemptId: 'exp-1', correctCount: 8 });
  });
});

describe('GET /api/progress/_health', () => {
  it('returns 200 when the table query works', async () => {
    const t = makeDeps();
    const res = await handleProgressHealth(new Request('https://x.test/api/progress/_health'), t.progressDeps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 when the storage query fails (missing table/IAM class)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'probeProgressTable') {
          return async () => {
            const err = new Error('AccessDeniedException');
            err.name = 'AccessDeniedException';
            throw err;
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const res = await handleProgressHealth(new Request('https://x.test/api/progress/_health'), { storage: failing });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});
