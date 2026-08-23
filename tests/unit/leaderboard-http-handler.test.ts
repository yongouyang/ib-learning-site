import { describe, it, expect } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import type { AuthDeps } from '@/lib/auth/types';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import {
  handleLeaderboardBoard,
  handleLeaderboardHealth,
  handleLeaderboardTeaser,
} from '@/lib/leaderboard/http-handler';
import type { LeaderboardDeps } from '@/lib/leaderboard/deps';
import {
  prevWeekKey,
  weekKeyFor,
  type LeaderboardScope,
} from '@/lib/leaderboard/types';

// Handler-level leaderboard tests (Phase D3): one fresh in-memory universe per
// test; sessions are seeded through the real auth handlers (the dummy-OTP
// login flow, same as progress/analytics-http-handler.test.ts). Board rows are
// seeded via storage.addXp directly — the XP accrual hook (D4) doesn't exist
// yet, which is exactly what the storage seam is for.
//
// The clock is FROZEN at a Wednesday so week=current/prev resolution is
// deterministic: 2026-08-19 is in ISO week 2026-W34 (Monday start 2026-08-17).

const DUMMY_CODE = '123456';
const NOW_MS = Date.parse('2026-08-19T12:00:00.000Z'); // Wednesday of 2026-W34
const CURRENT_WEEK = weekKeyFor(NOW_MS); // 2026-W34
const PREV_WEEK = prevWeekKey(CURRENT_WEEK); // 2026-W33

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `leaderboard-${counter}@example.com`;
}

interface TestDeps {
  storage: InMemoryLeaderboardStorage;
  authDeps: AuthDeps;
  leaderboardDeps: LeaderboardDeps;
}

function makeDeps(): TestDeps {
  const clock = () => NOW_MS;
  const storage = new InMemoryLeaderboardStorage(clock);
  const sender = new DummyEmailSender();
  return {
    storage,
    authDeps: { storage, emailSender: sender, testMode: true, dummyMode: true },
    leaderboardDeps: { storage, clock },
  };
}

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

/** Replace the user's child profiles (stage/opt-in control for tests). */
async function setProfiles(
  t: TestDeps,
  userId: string,
  profiles: Array<{ profileId: string; displayName: string; stage: 'ks3' | 'igcse' | 'dp'; leaderboardOptIn?: boolean }>
) {
  await t.storage.updateUser(userId, { childProfiles: profiles });
}

function seed(t: TestDeps, scope: LeaderboardScope, weekKey: string, rows: Array<{ profileId: string; handle: string; xp: number; userId?: string }>) {
  return Promise.all(
    rows.map((r, i) =>
      t.storage.addXp({
        userId: r.userId ?? `user-${r.profileId}`,
        profileId: r.profileId,
        handle: r.handle,
        scope,
        weekKey,
        xp: r.xp,
        // Later i = later lastEarnedAt → xp ties break toward the EARLIER row.
        earnedAt: new Date(NOW_MS + i * 1000).toISOString(),
      })
    )
  );
}

function getBoard(t: TestDeps, query = '', cookie = '') {
  return handleLeaderboardBoard(
    new Request(`https://x.test/api/leaderboard${query}`, { headers: cookie ? { cookie } : {} }),
    t.leaderboardDeps
  );
}

function getTeaser(t: TestDeps, query = '') {
  return handleLeaderboardTeaser(new Request(`https://x.test/api/leaderboard/teaser${query}`), t.leaderboardDeps);
}

describe('GET /api/leaderboard', () => {
  it('401s without a session', async () => {
    const t = makeDeps();
    const res = await getBoard(t);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns the ranked board with isSelf marking, self, and week metadata', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: selfId, handle: 'Brave Badger', xp: 50, userId: user.userId },
      { profileId: 'other-a', handle: 'Swift Falcon', xp: 100 },
      { profileId: 'other-b', handle: 'Calm Otter', xp: 30 },
    ]);

    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    // Sliding session refresh re-issues the cookie.
    expect(res.headers.get('set-cookie')).toContain('Max-Age=');

    const body = await res.json();
    expect(body.scope).toBe('stage:ks3');
    expect(body.weekKey).toBe(CURRENT_WEEK);
    expect(body.week).toBe('current');
    expect(body.resetAt).toBe('2026-08-24T00:00:00.000Z'); // Monday 00:00 UTC
    expect(body.totalEntries).toBe(3);
    expect(body.profile).toEqual({ profileId: selfId, optedIn: false });

    expect(body.top).toEqual([
      { rank: 1, handle: 'Swift Falcon', xp: 100, isSelf: false },
      { rank: 2, handle: 'Brave Badger', xp: 50, isSelf: true },
      { rank: 3, handle: 'Calm Otter', xp: 30, isSelf: false },
    ]);
    expect(body.self).toEqual({ rank: 2, handle: 'Brave Badger', xp: 50 });
    // Rank 2's neighbourhood is the whole 3-row board.
    expect(body.neighbourhood).toEqual(body.top);
  });

  it('week=prev resolves via prevWeekKey on the SERVER clock', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: 'other-now', handle: 'Keen Heron', xp: 999 },
    ]);
    await seed(t, 'stage:ks3', PREV_WEEK, [
      { profileId: selfId, handle: 'Brave Badger', xp: 70, userId: user.userId },
      { profileId: 'other-prev', handle: 'Jolly Mole', xp: 40 },
    ]);

    const res = await getBoard(t, '?week=prev', cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.week).toBe('prev');
    expect(body.weekKey).toBe(PREV_WEEK);
    expect(body.resetAt).toBe('2026-08-17T00:00:00.000Z'); // prev week's reset
    expect(body.totalEntries).toBe(2); // the current-week row is NOT here
    expect(body.top.map((r: { handle: string }) => r.handle)).toEqual(['Brave Badger', 'Jolly Mole']);
    expect(body.self).toEqual({ rank: 1, handle: 'Brave Badger', xp: 70 });
  });

  it('defaults the scope to the requested profile\'s stage; an explicit scope wins', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await setProfiles(t, user.userId, [
      { profileId: selfId, displayName: 'Me', stage: 'igcse' },
    ]);

    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).scope).toBe('stage:igcse');

    const explicit = await getBoard(t, '?scope=stage:dp', cookie);
    expect(explicit.status).toBe(200);
    expect((await explicit.json()).scope).toBe('stage:dp');
  });

  it('accepts an explicit OWN profileId and 400s a foreign one (the progress rule)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await setProfiles(t, user.userId, [
      { profileId: 'kid-1', displayName: 'Me', stage: 'ks3' },
      { profileId: 'kid-2', displayName: 'Sibling', stage: 'dp' },
    ]);
    const other = await login(t, uniqueEmail());

    const own = await getBoard(t, '?profileId=kid-2', cookie);
    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(ownBody.scope).toBe('stage:dp'); // scope defaults from kid-2's stage
    expect(ownBody.profile).toEqual({ profileId: 'kid-2', optedIn: false });

    // A foreign profileId — unknown AND another account's — is the progress
    // handler's exact rejection: 400 { error: 'Invalid request' }.
    const unknown = await getBoard(t, '?profileId=not-mine', cookie);
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'Invalid request' });
    const foreign = await getBoard(t, `?profileId=${other.user.childProfiles[0].profileId}`, cookie);
    expect(foreign.status).toBe(400);
    expect(await foreign.json()).toEqual({ error: 'Invalid request' });
  });

  it('400s when the user has no profiles and profileId is omitted', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    await setProfiles(t, user.userId, []);
    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request' });
  });

  it('400s on an invalid scope or week param', async () => {
    const t = makeDeps();
    const { cookie } = await login(t);
    for (const query of ['?scope=nope', '?scope=globalx', '?week=last', '?week=2026-W33']) {
      const res = await getBoard(t, query, cookie);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid request' });
    }
    // 'global' IS a valid scope (the data model keeps it, plan §4.2).
    expect((await getBoard(t, '?scope=global', cookie)).status).toBe(200);
  });

  it('returns self:null + empty neighbourhood when the caller has no row this week', async () => {
    const t = makeDeps();
    const { cookie } = await login(t);
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: 'other-a', handle: 'Swift Falcon', xp: 100 },
      { profileId: 'other-b', handle: 'Calm Otter', xp: 30 },
    ]);

    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.self).toBeNull();
    expect(body.neighbourhood).toEqual([]);
    expect(body.totalEntries).toBe(2);
    expect(body.top).toHaveLength(2);
    expect(body.top.every((r: { isSelf: boolean }) => r.isSelf === false)).toBe(true);
  });

  it('reports profile.optedIn from childProfile.leaderboardOptIn (absent = false)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await setProfiles(t, user.userId, [
      { profileId: selfId, displayName: 'Me', stage: 'ks3', leaderboardOptIn: true },
    ]);

    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).profile).toEqual({ profileId: selfId, optedIn: true });
  });

  it('windows the neighbourhood 2 above / self / 2 below', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: 'r1', handle: 'Alpha Ape', xp: 700 },
      { profileId: 'r2', handle: 'Beta Bear', xp: 600 },
      { profileId: 'r3', handle: 'Gamma Cat', xp: 500 },
      { profileId: selfId, handle: 'Delta Dog', xp: 400, userId: user.userId },
      { profileId: 'r5', handle: 'Epsilon Elk', xp: 300 },
      { profileId: 'r6', handle: 'Zeta Fox', xp: 200 },
      { profileId: 'r7', handle: 'Eta Gull', xp: 100 },
    ]);

    const res = await getBoard(t, '', cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEntries).toBe(7);
    expect(body.top).toHaveLength(7);
    expect(body.self).toEqual({ rank: 4, handle: 'Delta Dog', xp: 400 });
    // Ranks 2..6 — 2 above, self, 2 below.
    expect(body.neighbourhood.map((r: { rank: number }) => r.rank)).toEqual([2, 3, 4, 5, 6]);
    expect(body.neighbourhood.map((r: { isSelf: boolean }) => r.isSelf)).toEqual([
      false, false, true, false, false,
    ]);
  });

  it('never leaks the profileId/entry field into the row JSON', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const selfId = user.childProfiles[0].profileId;
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: selfId, handle: 'Brave Badger', xp: 50, userId: user.userId },
      { profileId: 'other-a', handle: 'Swift Falcon', xp: 100 },
    ]);

    const res = await getBoard(t, '', cookie);
    const body = await res.json();
    for (const row of [...body.top, ...body.neighbourhood]) {
      expect(Object.keys(row).sort()).toEqual(['handle', 'isSelf', 'rank', 'xp']);
    }
    // profileId appears ONLY in the caller's own profile block — never in a row.
    const serialized = JSON.stringify({ top: body.top, neighbourhood: body.neighbourhood });
    expect(serialized).not.toContain(selfId);
    expect(serialized).not.toContain('other-a');
    expect(serialized).not.toContain('"entry"');
  });
});

describe('GET /api/leaderboard/teaser', () => {
  it('is PUBLIC: 200 with the current week\'s top 3 (handle + xp only), no session', async () => {
    const t = makeDeps();
    await seed(t, 'stage:ks3', CURRENT_WEEK, [
      { profileId: 'p1', handle: 'Alpha Ape', xp: 100 },
      { profileId: 'p2', handle: 'Beta Bear', xp: 500 },
      { profileId: 'p3', handle: 'Gamma Cat', xp: 300 },
      { profileId: 'p4', handle: 'Delta Dog', xp: 200 },
      { profileId: 'p5', handle: 'Epsilon Elk', xp: 400 },
    ]);

    const res = await getTeaser(t);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('set-cookie')).toBeNull(); // public — no session touch

    const body = await res.json();
    expect(body.scope).toBe('stage:ks3'); // default scope
    expect(body.weekKey).toBe(CURRENT_WEEK);
    expect(body.top).toEqual([
      { rank: 1, handle: 'Beta Bear', xp: 500 },
      { rank: 2, handle: 'Epsilon Elk', xp: 400 },
      { rank: 3, handle: 'Gamma Cat', xp: 300 },
    ]);
    for (const row of body.top) {
      expect(Object.keys(row).sort()).toEqual(['handle', 'rank', 'xp']);
    }
    expect(JSON.stringify(body)).not.toContain('"isSelf"');
    expect(JSON.stringify(body)).not.toContain('p1');
  });

  it('honors an explicit scope and ignores other weeks', async () => {
    const t = makeDeps();
    await seed(t, 'stage:ks3', CURRENT_WEEK, [{ profileId: 'k1', handle: 'Ks Three', xp: 10 }]);
    await seed(t, 'stage:dp', CURRENT_WEEK, [{ profileId: 'd1', handle: 'Dp Star', xp: 90 }]);
    await seed(t, 'stage:dp', PREV_WEEK, [{ profileId: 'd2', handle: 'Dp Ghost', xp: 999 }]);

    const res = await getTeaser(t, '?scope=stage:dp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('stage:dp');
    expect(body.top).toEqual([{ rank: 1, handle: 'Dp Star', xp: 90 }]);
  });

  it('400s on an invalid scope and returns an empty top for an empty board', async () => {
    const t = makeDeps();
    const bad = await getTeaser(t, '?scope=everyone');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Invalid request' });

    const empty = await getTeaser(t, '?scope=global');
    expect(empty.status).toBe(200);
    expect((await empty.json()).top).toEqual([]);
  });
});

describe('GET /api/leaderboard/_health', () => {
  it('returns 200 {ok:true} when the probe succeeds (dummy)', async () => {
    const t = makeDeps();
    const res = await handleLeaderboardHealth(new Request('https://x.test/api/leaderboard/_health'), t.leaderboardDeps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 {ok:false} when the probe throws (missing table/IAM class)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'probeLeaderboardTable') {
          return async () => {
            const err = new Error('AccessDeniedException');
            err.name = 'AccessDeniedException';
            throw err;
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const res = await handleLeaderboardHealth(new Request('https://x.test/api/leaderboard/_health'), {
      ...t.leaderboardDeps,
      storage: failing,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});
