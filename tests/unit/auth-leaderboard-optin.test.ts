import { describe, it, expect, vi } from 'vitest';
import { handleRequestOtp, handleVerifyOtp, handleAccountPost } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import type { AuthDeps, ChildProfile } from '@/lib/auth/types';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import { handleForProfile } from '@/lib/leaderboard/handles';
import { weekKeyFor, type LeaderboardStorage } from '@/lib/leaderboard/types';

// Phase D5 (docs/leaderboard-plan.md §4.3/§7): the leaderboard opt-in surface
// on POST /api/auth/account — schema accept/reject, merge carry-over, the
// changeable-once handle rule, and opt-out erasure. Handler-level tests run
// against a fresh InMemoryLeaderboardStorage per test (the shared-universe
// dummy: it IS the AuthStorage AND the LeaderboardStorage). Rate limiters are
// module-level, so every test uses unique emails AND unique IPs (the
// auth-http-handler.test.ts convention).

const DUMMY_CODE = '123456';

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `lb-optin-${emailCounter}@example.com`;
}

interface TestDeps {
  deps: AuthDeps;
  storage: InMemoryLeaderboardStorage;
}

function makeDeps(opts: { leaderboardStorage?: LeaderboardStorage | null } = {}): TestDeps {
  const storage = new InMemoryLeaderboardStorage();
  return {
    storage,
    deps: {
      storage,
      emailSender: new DummyEmailSender(),
      // null = explicitly NOT wired (the pre-D7 LEADERBOARD_TABLE-absent case).
      leaderboardStorage: opts.leaderboardStorage === null ? undefined : (opts.leaderboardStorage ?? storage),
      testMode: true,
      dummyMode: true,
    },
  };
}

function jsonRequest(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': headers['x-forwarded-for'] ?? uniqueIp(),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No Set-Cookie header');
  return setCookie.split(';')[0].split('=')[1] ?? '';
}

async function login(t: TestDeps, email = uniqueEmail()) {
  await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
  const res = await handleVerifyOtp(
    jsonRequest('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
    t.deps
  );
  expect(res.status).toBe(200);
  const user = (await res.json()).user as { userId: string; childProfiles: ChildProfile[] };
  return { cookie: `octav_session=${cookieFrom(res)}`, user };
}

async function postAccount(t: TestDeps, cookie: string, body: unknown): Promise<Response> {
  return handleAccountPost(jsonRequest('POST', 'https://x.test/api/auth/account', body, { cookie }), t.deps);
}

/** Seed one leaderboard row for a profile on its current-week stage board. */
async function seedRow(t: TestDeps, userId: string, profileId: string, xp = 70) {
  await t.storage.addXp({
    userId,
    profileId,
    handle: handleForProfile(profileId),
    scope: 'stage:ks3',
    weekKey: weekKeyFor(Date.now()),
    xp,
    earnedAt: new Date().toISOString(),
  });
}

async function boardHas(t: TestDeps, profileId: string): Promise<boolean> {
  const board = await t.storage.listBoard('stage:ks3', weekKeyFor(Date.now()));
  return board.some((r) => r.entry === profileId);
}

describe('POST /api/auth/account — leaderboard fields (D5)', () => {
  it('schema: accepts leaderboardOptIn and a valid leaderboardHandle', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    const res = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()).user.childProfiles[0];
    expect(saved.leaderboardOptIn).toBe(true);
    expect(saved.leaderboardHandle).toBe('Custom Condor');
  });

  it('schema: rejects bad handles (charset, length) and non-boolean opt-in with 400', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    for (const patch of [
      { leaderboardHandle: 'Bad<script>' }, // charset
      { leaderboardHandle: 'Agent 007' }, // digits
      { leaderboardHandle: 'A' }, // too short
      { leaderboardHandle: 'A'.repeat(25) }, // too long
      { leaderboardOptIn: 'yes' }, // not a boolean
    ]) {
      const res = await postAccount(t, cookie, { childProfiles: [{ ...p, ...patch }] });
      expect(res.status, JSON.stringify(patch)).toBe(400);
    }
  });

  it('schema: trims the handle before validating/storing', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    const res = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: '  Neat Newt  ' }],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).user.childProfiles[0].leaderboardHandle).toBe('Neat Newt');
  });

  it('merge carry-over: a save without leaderboard fields keeps the opt-in and handle', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });

    // A rename that doesn't touch the leaderboard must not wipe anything.
    const res = await postAccount(t, cookie, {
      childProfiles: [{ profileId: p.profileId, displayName: 'Renamed', stage: 'ks3' }],
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()).user.childProfiles[0];
    expect(saved.displayName).toBe('Renamed');
    expect(saved.leaderboardOptIn).toBe(true);
    expect(saved.leaderboardHandle).toBe('Custom Condor');
  });

  it('opt-in stores the deterministic default handle when none is provided', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    const res = await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });
    expect(res.status).toBe(200);
    const saved = (await res.json()).user.childProfiles[0];
    expect(saved.leaderboardOptIn).toBe(true);
    expect(saved.leaderboardHandle).toBe(handleForProfile(p.profileId));

    const stored = await t.storage.getUserById(user.userId);
    expect(stored!.childProfiles[0].leaderboardHandle).toBe(handleForProfile(p.profileId));
  });

  it('opt-in on a NEW profile (not yet stored) works and gets the default handle', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    const res = await postAccount(t, cookie, {
      childProfiles: [
        p,
        { profileId: 'p-new', displayName: 'New', stage: 'ks3', leaderboardOptIn: true },
      ],
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()).user.childProfiles[1];
    expect(saved.leaderboardOptIn).toBe(true);
    expect(saved.leaderboardHandle).toBe(handleForProfile('p-new'));
  });

  it('handle changeable once: deterministic default → custom OK, second change → 400', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    // Opt in: the deterministic default is now the stored handle.
    await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });

    // First custom change is allowed (stored === deterministic default).
    const first = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });
    expect(first.status).toBe(200);
    expect((await first.json()).user.childProfiles[0].leaderboardHandle).toBe('Custom Condor');

    // A SECOND change is locked.
    const second = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Another One' }],
    });
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({
      error: 'This leaderboard handle has already been changed once and cannot be changed again.',
    });

    // Storage unchanged by the rejected attempt.
    const stored = await t.storage.getUserById(user.userId);
    expect(stored!.childProfiles[0].leaderboardHandle).toBe('Custom Condor');
  });

  it('re-submitting the SAME custom handle is a no-op, not a second change', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });
    const again = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });
    expect(again.status).toBe(200);
    expect((await again.json()).user.childProfiles[0].leaderboardHandle).toBe('Custom Condor');
  });

  it('opting in never creates leaderboard rows by itself', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    const res = await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });
    expect(res.status).toBe(200);
    expect(await boardHas(t, p.profileId)).toBe(false);
  });

  it('opt-out (true→false) erases the profile rows via deleteEntriesByUser(userId, profileId)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];
    const spy = vi.spyOn(t.storage, 'deleteEntriesByUser');

    // Two profiles, both opted in with rows — only the leaving one is erased.
    const second = { profileId: 'p-two', displayName: 'Two', stage: 'ks3' as const };
    await postAccount(t, cookie, {
      childProfiles: [
        { ...p, leaderboardOptIn: true },
        { ...second, leaderboardOptIn: true },
      ],
    });
    await seedRow(t, user.userId, p.profileId);
    await seedRow(t, user.userId, 'p-two');
    spy.mockClear();

    const res = await postAccount(t, cookie, {
      childProfiles: [
        { ...p, leaderboardOptIn: false },
        { ...second, leaderboardOptIn: true },
      ],
    });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(user.userId, p.profileId);
    expect(await boardHas(t, p.profileId)).toBe(false);
    expect(await boardHas(t, 'p-two')).toBe(true);

    // The stored handle survives the opt-out (stable identity on rejoin).
    const stored = await t.storage.getUserById(user.userId);
    expect(stored!.childProfiles[0].leaderboardOptIn).toBeUndefined();
    expect(stored!.childProfiles[0].leaderboardHandle).toBe(handleForProfile(p.profileId));
  });

  it('a profile REMOVED while opted in is erased too', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];
    const spy = vi.spyOn(t.storage, 'deleteEntriesByUser');

    const second = { profileId: 'p-two', displayName: 'Two', stage: 'ks3' as const };
    await postAccount(t, cookie, {
      childProfiles: [p, { ...second, leaderboardOptIn: true }],
    });
    await seedRow(t, user.userId, 'p-two');
    spy.mockClear();

    // Remove the opted-in profile from the array entirely.
    const res = await postAccount(t, cookie, { childProfiles: [p] });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(user.userId, 'p-two');
    expect(await boardHas(t, 'p-two')).toBe(false);
  });

  it('removing a NON-opted-in profile triggers no erasure', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];
    const spy = vi.spyOn(t.storage, 'deleteEntriesByUser');

    await postAccount(t, cookie, {
      childProfiles: [p, { profileId: 'p-two', displayName: 'Two', stage: 'ks3' }],
    });
    spy.mockClear();
    const res = await postAccount(t, cookie, { childProfiles: [p] });
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejoining after opt-out keeps the stored custom handle (still locked)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Custom Condor' }],
    });
    await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: false }] });

    // Rejoin without a handle → the stored custom one comes back.
    const rejoin = await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });
    expect(rejoin.status).toBe(200);
    expect((await rejoin.json()).user.childProfiles[0].leaderboardHandle).toBe('Custom Condor');

    // …and it is still locked (the one change was already spent).
    const locked = await postAccount(t, cookie, {
      childProfiles: [{ ...p, leaderboardOptIn: true, leaderboardHandle: 'Sneaky Swap' }],
    });
    expect(locked.status).toBe(400);
  });

  it('an erasure failure does NOT fail the account update (log + continue)', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });
    await seedRow(t, user.userId, p.profileId);

    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'deleteEntriesByUser') {
          return async () => {
            throw new Error('leaderboard table missing');
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await postAccount(
        { ...t, deps: { ...t.deps, leaderboardStorage: failing } },
        cookie,
        { childProfiles: [{ ...p, leaderboardOptIn: false }] }
      );
      expect(res.status).toBe(200);
      // mockRestore clears the call history — assert BEFORE restoring.
      expect(errorSpy).toHaveBeenCalledWith('[auth] leaderboard opt-out erasure failed:', 'leaderboard table missing');
    } finally {
      errorSpy.mockRestore();
    }

    // The opt-out state is durable even though the row cleanup failed.
    const stored = await t.storage.getUserById(user.userId);
    expect(stored!.childProfiles[0].leaderboardOptIn).toBeUndefined();
    expect(await boardHas(t, p.profileId)).toBe(true); // row still there — cleanup deferred
  });

  it('opt-out with no leaderboardStorage wired (pre-D7) still succeeds', async () => {
    const t = makeDeps({ leaderboardStorage: null });
    const { cookie, user } = await login(t);
    const p = user.childProfiles[0];

    await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: true }] });
    const res = await postAccount(t, cookie, { childProfiles: [{ ...p, leaderboardOptIn: false }] });
    expect(res.status).toBe(200);
    expect((await res.json()).user.childProfiles[0].leaderboardOptIn).toBeUndefined();
  });
});
