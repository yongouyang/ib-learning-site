import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleRequestOtp,
  handleVerifyOtp,
  handleLogout,
  handleMe,
  handleAccountPost,
  handleSessionsGet,
  handleRevokeSession,
  handleExportGet,
  handleDeleteAccount,
} from '@/lib/auth/http-handler';
import { DummyEmailSender, InMemoryAuthStorage } from '@/lib/auth/dummy';
import { OTP_MAX_ATTEMPTS, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/types';
import type { AuthDeps, SessionRecord, UserRecord } from '@/lib/auth/types';

// Handler-level tests run against fresh in-memory dummies per test (the
// controllable-dummy pattern) — no env stubbing, no module mocks. Rate
// limiters are module-level, so every test uses unique emails AND unique
// x-forwarded-for IPs (the feedback handler's tests use the same trick).

const DUMMY_CODE = '123456'; // deterministic default under testMode + dummyMode

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

let emailCounter = 0;
function uniqueEmail(prefix = 'user'): string {
  emailCounter += 1;
  return `${prefix}-${emailCounter}@example.com`;
}

interface TestDeps {
  deps: AuthDeps;
  storage: InMemoryAuthStorage;
  sender: DummyEmailSender;
}

function makeDeps(opts: { testMode?: boolean; dummyMode?: boolean } = {}): TestDeps {
  const storage = new InMemoryAuthStorage();
  const sender = new DummyEmailSender();
  return {
    storage,
    sender,
    deps: {
      storage,
      emailSender: sender,
      testMode: opts.testMode ?? true,
      dummyMode: opts.dummyMode ?? true,
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
  if (!setCookie) throw new Error('No Set-Cookie header on response');
  return setCookie.split(';')[0].split('=')[1] ?? '';
}

async function loginAs(
  t: TestDeps,
  email: string,
  url = 'https://octavlearning.com/api/auth'
): Promise<{ sessionId: string; cookieHeader: string; user: { userId: string; email: string } }> {
  const req = jsonRequest('POST', `${url}/request-otp`, { email }, { 'x-forwarded-for': uniqueIp() });
  await handleRequestOtp(req, t.deps);
  const res = await handleVerifyOtp(jsonRequest('POST', `${url}/verify-otp`, { email, otp: DUMMY_CODE }, { 'x-forwarded-for': uniqueIp() }), t.deps);
  expect(res.status).toBe(200);
  const sessionId = cookieFrom(res);
  return {
    sessionId,
    cookieHeader: `octav_session=${sessionId}`,
    user: (await res.json()).user,
  };
}

// ---------------------------------------------------------------------------

describe('POST /api/auth/request-otp', () => {
  let t: TestDeps;
  beforeEach(() => {
    t = makeDeps();
  });

  it('returns the same 200 for unknown and known emails (no enumeration)', async () => {
    const email = uniqueEmail();
    const first = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ message: 'If an account exists, a code has been sent.' });

    await t.storage.createUser({
      userId: 'u1', email, displayName: 'Known', role: 'parent',
      childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }],
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(),
    });
    const second = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ message: 'If an account exists, a code has been sent.' });
  });

  it('stores a salted hash, never the plaintext code', async () => {
    const email = uniqueEmail();
    await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
    const record = await t.storage.getOtp(email);
    expect(record).not.toBeNull();
    expect(record!.codeHash).not.toContain(DUMMY_CODE);
    expect(record!.salt).toBeTruthy();
    expect(record!.attempts).toBe(0);
    expect(record!.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('sends the email through the sender with a 10-minute expiry', async () => {
    const email = uniqueEmail();
    await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
    expect(t.sender.sent).toHaveLength(1);
    expect(t.sender.sent[0]).toMatchObject({ to: email, code: DUMMY_CODE, expiresInMinutes: 10 });
  });

  it('rejects invalid emails with 400', async () => {
    const res = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email: 'not-an-email' }), t.deps);
    expect(res.status).toBe(400);
    expect(t.sender.sent).toHaveLength(0);
  });

  it('rejects invalid JSON with 400', async () => {
    const req = new Request('https://x.test/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: '{not json',
    });
    const res = await handleRequestOtp(req, t.deps);
    expect(res.status).toBe(400);
  });

  it('rate-limits per email: 3 requests per 10 minutes', async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 3; i++) {
      const res = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
      expect(res.status).toBe(200);
    }
    const limited = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'Too many requests. Try again in 10 minutes.' });
  });

  it('rate-limits per IP across emails: 30 requests per 10 minutes', async () => {
    const ip = uniqueIp();
    for (let i = 0; i < 30; i++) {
      const res = await handleRequestOtp(
        jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email: uniqueEmail() }, { 'x-forwarded-for': ip }),
        t.deps
      );
      expect(res.status).toBe(200);
    }
    const limited = await handleRequestOtp(
      jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email: uniqueEmail() }, { 'x-forwarded-for': ip }),
      t.deps
    );
    expect(limited.status).toBe(429);
  });

  it('honors _testCode injection only in test+dummy mode', async () => {
    const email = uniqueEmail();
    const res = await handleRequestOtp(
      jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email, _testCode: '654321' }),
      t.deps
    );
    expect(res.status).toBe(200);
    const record = await t.storage.getOtp(email);
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update(`${record!.salt}:654321`).digest('hex');
    expect(record!.codeHash).toBe(expected);
  });

  it('ignores _testCode when deps are not dummy (never a universal key in prod)', async () => {
    const t2 = makeDeps({ testMode: true, dummyMode: false });
    const email = uniqueEmail();
    await handleRequestOtp(
      jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email, _testCode: '654321' }),
      t2.deps
    );
    const record = await t2.storage.getOtp(email);
    const { createHash } = await import('node:crypto');
    const injectedHash = createHash('sha256').update(`${record!.salt}:654321`).digest('hex');
    expect(record!.codeHash).not.toBe(injectedHash);
  });

  it('falls back to a random code outside test mode', async () => {
    const t2 = makeDeps({ testMode: false });
    const email = uniqueEmail();
    await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t2.deps);
    const record = await t2.storage.getOtp(email);
    const { createHash } = await import('node:crypto');
    const dummyHash = createHash('sha256').update(`${record!.salt}:${DUMMY_CODE}`).digest('hex');
    expect(record!.codeHash).not.toBe(dummyHash);
  });

  it('removes the stored code and returns 502 when email sending fails', async () => {
    const email = uniqueEmail();
    const failing = makeDeps();
    failing.sender.sendOtpEmail = async () => {
      throw new Error('SES down');
    };
    const res = await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), failing.deps);
    expect(res.status).toBe(502);
    expect(await failing.storage.getOtp(email)).toBeNull();
  });
});

describe('POST /api/auth/verify-otp', () => {
  let t: TestDeps;
  let email: string;
  beforeEach(async () => {
    t = makeDeps();
    email = uniqueEmail();
    await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.deps);
  });

  it('logs in a first-time user: auto-creates the account and sets the session cookie', async () => {
    const res = await handleVerifyOtp(jsonRequest('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }), t.deps);
    expect(res.status).toBe(200);

    const { user } = await res.json();
    expect(user.email).toBe(email);
    expect(user.userId).toBeTruthy();
    expect(user.role).toBe('parent');
    // Q1 resolution: a student is a parent with one "Me" profile.
    expect(user.childProfiles).toHaveLength(1);
    expect(user.childProfiles[0].displayName).toBe('Me');

    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);

    // Account persisted; code consumed (single-use).
    expect(await t.storage.getUserByEmail(email)).not.toBeNull();
    expect(await t.storage.getOtp(email)).toBeNull();
  });

  it('omits Secure on plain-http non-localhost origins', async () => {
    const res = await handleVerifyOtp(
      jsonRequest('POST', 'http://intranet.test/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).not.toContain('Secure');
  });

  it('rejects a wrong code with 400 and counts the attempt', async () => {
    const res = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: '000000' }), t.deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid or expired code.' });
    expect((await t.storage.getOtp(email))!.attempts).toBe(1);
  });

  it('locks out after 5 wrong attempts and deletes the code', async () => {
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      const res = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: '000000' }), t.deps);
      expect(res.status).toBe(400);
    }
    const locked = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: '000000' }), t.deps);
    expect(locked.status).toBe(429);
    expect(await locked.json()).toEqual({ error: 'Too many attempts. Request a new code.' });
    expect(await t.storage.getOtp(email)).toBeNull();
  });

  it('rejects an expired code with 400', async () => {
    const record = await t.storage.getOtp(email);
    await t.storage.createOtp({ ...record!, expiresAt: Math.floor(Date.now() / 1000) - 1 });
    const res = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: DUMMY_CODE }), t.deps);
    expect(res.status).toBe(400);
  });

  it('rejects when no code was requested', async () => {
    const res = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email: uniqueEmail(), otp: DUMMY_CODE }), t.deps);
    expect(res.status).toBe(400);
  });

  it('rejects malformed payloads with 400', async () => {
    for (const body of [
      { email: 'bad', otp: DUMMY_CODE },
      { email, otp: '12345' },
      { email, otp: 'abcdef' },
      { email },
    ]) {
      const res = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', body), t.deps);
      expect(res.status).toBe(400);
    }
  });

  it('updates lastLoginAt for a returning user without duplicating the account', async () => {
    await t.storage.createUser({
      userId: 'existing', email, displayName: 'Returning', role: 'parent',
      childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'dp' }],
      createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: '2026-01-01T00:00:00.000Z',
    });
    await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: DUMMY_CODE }), t.deps);
    const user = await t.storage.getUserById('existing');
    expect(user!.displayName).toBe('Returning');
    expect(user!.lastLoginAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('is single-use: the same code cannot verify twice', async () => {
    await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: DUMMY_CODE }), t.deps);
    const second = await handleVerifyOtp(jsonRequest('POST', 'https://x.test/api/auth/verify-otp', { email, otp: DUMMY_CODE }), t.deps);
    expect(second.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const t = makeDeps();
    const res = await handleMe(new Request('https://x.test/api/auth/me'), t.deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('returns the user and refreshes the session TTL', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId, user } = await loginAs(t, email);
    const before = await t.storage.getSession(sessionId);
    const updateSpy = vi.spyOn(t.storage, 'updateSession');

    const res = await handleMe(
      new Request('https://x.test/api/auth/me', { headers: { cookie: `octav_session=${sessionId}` } }),
      t.deps
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body.user.userId).toBe(user.userId);

    expect(updateSpy).toHaveBeenCalledWith(sessionId, expect.objectContaining({
      expiresAt: expect.any(Number),
      lastAccessedAt: expect.any(String),
    }));
    const after = await t.storage.getSession(sessionId);
    expect(after!.expiresAt).toBeGreaterThanOrEqual(before!.expiresAt);
    expect(after!.lastAccessedAt >= before!.lastAccessedAt).toBe(true);
  });

  it('returns 401 for an expired session and deletes it', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId } = await loginAs(t, email);
    const session = await t.storage.getSession(sessionId);
    await t.storage.updateSession(sessionId, { lastAccessedAt: session!.lastAccessedAt, expiresAt: Math.floor(Date.now() / 1000) - 1 });

    const res = await handleMe(
      new Request('https://x.test/api/auth/me', { headers: { cookie: `octav_session=${sessionId}` } }),
      t.deps
    );
    expect(res.status).toBe(401);
    expect(await t.storage.getSession(sessionId)).toBeNull();
  });

  it('returns 401 when the session user no longer exists', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId } = await loginAs(t, email);
    const user = await t.storage.getUserByEmail(email);
    await t.storage.deleteUser(user!.userId);

    const res = await handleMe(
      new Request('https://x.test/api/auth/me', { headers: { cookie: `octav_session=${sessionId}` } }),
      t.deps
    );
    expect(res.status).toBe(401);
    expect(await t.storage.getSession(sessionId)).toBeNull();
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session and clears the cookie', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const res = await handleLogout(
      jsonRequest('POST', 'https://x.test/api/auth/logout', undefined, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Logged out.' });
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await t.storage.getSession(sessionId)).toBeNull();
  });

  it('still returns 200 without a cookie', async () => {
    const t = makeDeps();
    const res = await handleLogout(jsonRequest('POST', 'https://x.test/api/auth/logout'), t.deps);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/account', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleAccountPost(jsonRequest('POST', 'https://x.test/api/auth/account', { displayName: 'X' }), t.deps);
    expect(res.status).toBe(401);
  });

  it('updates the display name', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const res = await handleAccountPost(
      jsonRequest('POST', 'https://x.test/api/auth/account', { displayName: 'Amelia' }, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.displayName).toBe('Amelia');
  });

  it('replaces the child profiles as a set', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const profiles = [
      { profileId: 'p-alex', displayName: 'Alex', stage: 'ks3' },
      { profileId: 'p-sam', displayName: 'Sam', stage: 'dp' },
    ];
    const res = await handleAccountPost(
      jsonRequest('POST', 'https://x.test/api/auth/account', { childProfiles: profiles }, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.childProfiles).toEqual(profiles);
  });

  it('rejects empty or malformed updates', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const cookie = { cookie: `octav_session=${sessionId}` };
    for (const body of [
      {},
      { displayName: '   ' },
      { displayName: 'x'.repeat(41) },
      { childProfiles: [] },
      { childProfiles: [{ profileId: 'p', displayName: 'A', stage: 'gcse' }] },
      { displayName: 'Ok', childProfiles: [{ profileId: 'p', displayName: '', stage: 'ks3' }] },
    ]) {
      const res = await handleAccountPost(jsonRequest('POST', 'https://x.test/api/auth/account', body, cookie), t.deps);
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /api/auth/sessions', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleSessionsGet(new Request('https://x.test/api/auth/sessions'), t.deps);
    expect(res.status).toBe(401);
  });

  it('lists the user\'s sessions with a current flag', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId, user } = await loginAs(t, email);
    const other: SessionRecord = {
      sessionId: 'other-session', userId: user.userId, email,
      createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 1000, userAgent: 'OtherPhone', ip: '1.2.3.4',
    };
    await t.storage.createSession(other);

    const res = await handleSessionsGet(
      new Request('https://x.test/api/auth/sessions', { headers: { cookie: `octav_session=${sessionId}` } }),
      t.deps
    );
    expect(res.status).toBe(200);
    const { sessions } = await res.json();
    expect(sessions).toHaveLength(2);
    const current = sessions.find((s: { sessionId: string }) => s.sessionId === sessionId);
    const extra = sessions.find((s: { sessionId: string }) => s.sessionId === 'other-session');
    expect(current.current).toBe(true);
    expect(extra.current).toBe(false);
  });
});

describe('POST /api/auth/sessions/revoke', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleRevokeSession(jsonRequest('POST', 'https://x.test/api/auth/sessions/revoke', { sessionId: 'x' }), t.deps);
    expect(res.status).toBe(401);
  });

  it('revokes another session of the same user', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId, user } = await loginAs(t, email);
    const other: SessionRecord = {
      sessionId: 'other-session', userId: user.userId, email,
      createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 1000, userAgent: 'OtherPhone', ip: '1.2.3.4',
    };
    await t.storage.createSession(other);

    const res = await handleRevokeSession(
      jsonRequest('POST', 'https://x.test/api/auth/sessions/revoke', { sessionId: 'other-session' }, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect(await t.storage.getSession('other-session')).toBeNull();
    expect(await t.storage.getSession(sessionId)).not.toBeNull();
  });

  it('returns 404 for another user\'s session', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const { user: otherUser } = await loginAs(t, uniqueEmail());
    const other: SessionRecord = {
      sessionId: 'other-session', userId: otherUser.userId, email: otherUser.email,
      createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 1000, userAgent: 'OtherPhone', ip: '1.2.3.4',
    };
    await t.storage.createSession(other);

    const res = await handleRevokeSession(
      jsonRequest('POST', 'https://x.test/api/auth/sessions/revoke', { sessionId: 'other-session' }, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(404);
  });

  it('revoking the current session clears the cookie (logs out)', async () => {
    const t = makeDeps();
    const { sessionId } = await loginAs(t, uniqueEmail());
    const res = await handleRevokeSession(
      jsonRequest('POST', 'https://x.test/api/auth/sessions/revoke', { sessionId }, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await t.storage.getSession(sessionId)).toBeNull();
  });
});

describe('GET /api/auth/export', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleExportGet(new Request('https://x.test/api/auth/export'), t.deps);
    expect(res.status).toBe(401);
  });

  it('returns the user record, sessions, and progress', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId } = await loginAs(t, email);
    const res = await handleExportGet(
      new Request('https://x.test/api/auth/export', { headers: { cookie: `octav_session=${sessionId}` } }),
      t.deps
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(email);
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(Array.isArray(data.progress)).toBe(true);
    expect(data.exportedAt).toBeTruthy();
  });
});

describe('POST /api/auth/delete', () => {
  it('requires authentication', async () => {
    const t = makeDeps();
    const res = await handleDeleteAccount(jsonRequest('POST', 'https://x.test/api/auth/delete'), t.deps);
    expect(res.status).toBe(401);
  });

  it('erases the account, all sessions, OTP state, and clears the cookie', async () => {
    const t = makeDeps();
    const email = uniqueEmail();
    const { sessionId } = await loginAs(t, email);
    const user = (await t.storage.getUserByEmail(email)) as UserRecord;

    const res = await handleDeleteAccount(
      jsonRequest('POST', 'https://x.test/api/auth/delete', undefined, { cookie: `octav_session=${sessionId}` }),
      t.deps
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Account deleted.' });
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');

    expect(await t.storage.getUserById(user.userId)).toBeNull();
    expect(await t.storage.getUserByEmail(email)).toBeNull();
    expect(await t.storage.listSessionsByUser(user.userId)).toEqual([]);
  });
});
