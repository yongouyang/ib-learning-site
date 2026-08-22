import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Import the handler (not the route) — the route delegates 1:1, and
// build:static stashes src/app/api aside, so importing the route breaks
// type-checking during the static export build.
import { handleFeedbackGet as GET, handleFeedbackPost as POST } from '@/lib/feedback/http-handler';
import type { FeedbackDeps } from '@/lib/feedback/deps';
import { InMemoryFeedbackStorage } from '@/lib/feedback/dummy';
import { DummyFeedbackProvider } from '@/lib/feedback/dummy';
import { hashSessionToken, type UserRecord } from '@/lib/auth/types';
import { AI_MARK_FREE_MONTHLY_QUOTA, AI_MARK_PREMIUM_MONTHLY_CAP, type Tier } from '@/lib/entitlements/features';

// Route tests run against the REAL provider wiring using env-based config
// (dummy provider + test-mode injection) — no module mocks needed. Phase E2:
// POST requires a session and charges the durable monthly quota, so every
// POST below runs against a FRESH in-memory storage with a seeded
// user+session (unit tests never call getFeedbackDeps — they inject).

const VALID_BODY = {
  stem: 'Work out $347 + 586$.',
  markscheme: ['M1: correct column-addition method', 'A1: 933'],
  modelAnswer: 'Column addition gives 933.',
  studentAnswer: 'I added them in columns and got 933.',
  maxMarks: 2,
};

let counter = 0;
function uniqueIp(): string {
  counter += 1;
  return `10.0.0.${counter}`;
}

interface SessionFixture {
  storage: InMemoryFeedbackStorage;
  cookie: string;
  user: UserRecord;
  deps: FeedbackDeps;
}

/** Fresh storage + a live session for a fresh user (dummy-OTP equivalent). */
async function makeSession(opts: { tier?: Tier; clock?: () => number } = {}): Promise<SessionFixture> {
  const clock = opts.clock ?? (() => Date.now());
  const storage = new InMemoryFeedbackStorage(clock);
  counter += 1;
  const user: UserRecord = {
    userId: `user-${counter}`,
    email: `user-${counter}@example.com`,
    displayName: 'Test User',
    role: 'parent',
    tier: opts.tier ?? 'free',
    childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await storage.createUser(user);
  const token = `token-${counter}`;
  await storage.createSession({
    sessionId: hashSessionToken(token),
    userId: user.userId,
    email: user.email,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    userAgent: 'vitest',
    ip: '127.0.0.1',
  });
  return {
    storage,
    user,
    cookie: `octav_session=${token}`,
    deps: { storage, clock, testMode: false, dummyMode: true },
  };
}

function post(body: unknown, ip: string, cookie?: string, deps?: FeedbackDeps): Promise<Response> {
  return POST(
    new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
        ...(cookie ? { cookie } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    deps
  );
}

function get(cookie?: string, deps?: FeedbackDeps): Promise<Response> {
  return GET(
    new Request('http://localhost/api/feedback', {
      headers: cookie ? { cookie } : {},
    }),
    deps
  );
}

describe('GET /api/feedback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unconfigured when no provider env is set (anonymous shape preserved)', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', '');
    const res = await get();
    expect(await res.json()).toEqual({ configured: false });
  });

  it('reports configured with the dummy provider (anonymous shape preserved — no quota fields)', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const res = await get();
    expect(await res.json()).toEqual({ configured: true });
  });

  it('adds quota state for a logged-in session', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const { cookie, deps } = await makeSession();
    const res = await get(cookie, deps);
    const json = await res.json();
    expect(json.configured).toBe(true);
    expect(json.remaining).toBe(AI_MARK_FREE_MONTHLY_QUOTA);
    expect(typeof json.resetAt).toBe('string');
    // Authenticated responses re-issue the session cookie and are never cached.
    expect(res.headers.get('set-cookie')).toContain('octav_session=');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('remaining reflects prior usage', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const { cookie, deps, storage, user } = await makeSession();
    // The GET derives the bucket key from the deps clock (real Date.now here).
    const monthKey = new Date().toISOString().slice(0, 7);
    await storage.setAiMarkCount!(user.userId, monthKey, 7);
    const res = await get(cookie, deps);
    expect((await res.json()).remaining).toBe(AI_MARK_FREE_MONTHLY_QUOTA - 7);
  });
});

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await post('not json{', uniqueIp());
    expect(res.status).toBe(400);
  });

  it('rejects schema violations with 400', async () => {
    const noStem = await post({ ...VALID_BODY, stem: '' }, uniqueIp());
    expect(noStem.status).toBe(400);

    const tooLong = await post(
      { ...VALID_BODY, studentAnswer: 'x'.repeat(2001) },
      uniqueIp()
    );
    expect(tooLong.status).toBe(400);
  });

  it('requires a session: 401 login_required when anonymous (E2 login gate)', async () => {
    const { deps } = await makeSession();
    const res = await post(VALID_BODY, uniqueIp(), undefined, deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'login_required' });
  });

  it('401s before any provider call', async () => {
    const spy = vi.spyOn(DummyFeedbackProvider.prototype, 'markAnswer');
    const { deps } = await makeSession();
    const res = await post(VALID_BODY, uniqueIp(), undefined, deps);
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 501 when no provider is configured (logged in; quota NOT charged)', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', '');
    const { cookie, deps, storage, user } = await makeSession();
    const res = await post(VALID_BODY, uniqueIp(), cookie, deps);
    expect(res.status).toBe(501);
    const monthKey = new Date().toISOString().slice(0, 7);
    expect(await storage.getAiMarkCount(user.userId, monthKey)).toBe(0);
  });

  it('marks with the dummy provider by default (all points awarded)', async () => {
    const { cookie, deps } = await makeSession();
    const res = await post(VALID_BODY, uniqueIp(), cookie, deps);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.perPoint).toHaveLength(2);
    expect(json.perPoint.every((p: { awarded: boolean }) => p.awarded)).toBe(true);
    expect(json.marks).toBe(2);
    expect(json.feedback).toContain('Dummy marker');
    // Authenticated responses slide the session cookie and are never cached.
    expect(res.headers.get('set-cookie')).toContain('octav_session=');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('charges the durable monthly quota on success', async () => {
    const { cookie, deps, storage, user } = await makeSession();
    const monthKey = new Date().toISOString().slice(0, 7);
    expect((await post(VALID_BODY, uniqueIp(), cookie, deps)).status).toBe(200);
    expect(await storage.getAiMarkCount(user.userId, monthKey)).toBe(1);
    expect((await post(VALID_BODY, uniqueIp(), cookie, deps)).status).toBe(200);
    expect(await storage.getAiMarkCount(user.userId, monthKey)).toBe(2);
  });

  it('429 quota_exceeded when the monthly quota is spent — BEFORE the provider call', async () => {
    const spy = vi.spyOn(DummyFeedbackProvider.prototype, 'markAnswer');
    const { cookie, deps, storage, user } = await makeSession();
    const monthKey = new Date().toISOString().slice(0, 7);
    await storage.setAiMarkCount!(user.userId, monthKey, AI_MARK_FREE_MONTHLY_QUOTA);

    const res = await post(VALID_BODY, uniqueIp(), cookie, deps);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe('quota_exceeded');
    expect(typeof json.resetAt).toBe('string');
    // An exhausted quota never spends money.
    expect(spy).not.toHaveBeenCalled();
    // The failed attempt did not charge the counter.
    expect(await storage.getAiMarkCount(user.userId, monthKey)).toBe(AI_MARK_FREE_MONTHLY_QUOTA);
  });

  it('quota window rolls with the calendar month (clock-injected)', async () => {
    let now = Date.parse('2026-08-31T23:00:00Z');
    const { cookie, deps, storage, user } = await makeSession({ clock: () => now });

    // Exhaust August (last day).
    await storage.setAiMarkCount!(user.userId, '2026-08', AI_MARK_FREE_MONTHLY_QUOTA);
    const exhausted = await post(VALID_BODY, uniqueIp(), cookie, deps);
    expect(exhausted.status).toBe(429);
    expect((await exhausted.json()).resetAt).toBe('2026-09-01T00:00:00.000Z');

    // September: a fresh bucket — the quota resets without any cleanup.
    now = Date.parse('2026-09-01T00:30:00Z');
    expect((await post(VALID_BODY, uniqueIp(), cookie, deps)).status).toBe(200);
    expect(await storage.getAiMarkCount(user.userId, '2026-09')).toBe(1);
  });

  it('premium tier uses the 1000/month safety cap instead of the free 30', async () => {
    const { cookie, deps, storage, user } = await makeSession({ tier: 'premium' });
    const monthKey = new Date().toISOString().slice(0, 7);
    await storage.setAiMarkCount!(user.userId, monthKey, AI_MARK_FREE_MONTHLY_QUOTA); // exhausted for free
    expect((await post(VALID_BODY, uniqueIp(), cookie, deps)).status).toBe(200);

    await storage.setAiMarkCount!(user.userId, monthKey, AI_MARK_PREMIUM_MONTHLY_CAP);
    const res = await post(VALID_BODY, uniqueIp(), cookie, deps);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('quota_exceeded');
  });

  it('honors _testAiMarkUsed/_testTier injection only in test mode with dummy storage', async () => {
    const { cookie, deps, storage, user } = await makeSession();
    const monthKey = new Date().toISOString().slice(0, 7);

    // Test mode OFF: the injection keys are ignored entirely.
    expect((await post({ ...VALID_BODY, _testAiMarkUsed: 29, _testTier: 'premium' }, uniqueIp(), cookie, deps)).status).toBe(200);
    expect(await storage.getAiMarkCount(user.userId, monthKey)).toBe(1);

    // Test mode ON + dummy storage: the counter is forced before the charge.
    const testDeps: FeedbackDeps = { ...deps, testMode: true };
    const res = await post({ ...VALID_BODY, _testAiMarkUsed: AI_MARK_FREE_MONTHLY_QUOTA }, uniqueIp(), cookie, testDeps);
    expect(res.status).toBe(429);

    // _testTier premium lifts the limit even for a free dummy account.
    const asPremium = await post(
      { ...VALID_BODY, _testAiMarkUsed: AI_MARK_FREE_MONTHLY_QUOTA, _testTier: 'premium' },
      uniqueIp(),
      cookie,
      testDeps
    );
    expect(asPremium.status).toBe(200);
  });

  it('honors _testResponse injection in test mode and recomputes marks', async () => {
    const { cookie, deps } = await makeSession();
    const testDeps: FeedbackDeps = { ...deps, testMode: true };
    const injected = {
      marks: 99, // must be ignored — marks are recomputed from perPoint
      perPoint: [
        { point: 'M1: correct column-addition method', awarded: true, comment: 'method shown' },
        { point: 'A1: 933', awarded: false, comment: 'arithmetic slip' },
      ],
      feedback: 'Good method, check the final sum.',
    };
    const res = await post({ ...VALID_BODY, _testResponse: injected }, uniqueIp(), cookie, testDeps);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.marks).toBe(1); // not 99
    expect(json.perPoint[1].awarded).toBe(false);
    expect(json.perPoint[1].comment).toBe('arithmetic slip');
  });

  it('ignores _testResponse when test mode is off', async () => {
    const { cookie, deps } = await makeSession();
    const res = await post(
      { ...VALID_BODY, _testResponse: { marks: 0, perPoint: [], feedback: 'hack' } },
      uniqueIp(),
      cookie,
      deps
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.feedback).toContain('Dummy marker'); // fell back to the default
  });

  it('rejects a malformed injection with 400 in test mode', async () => {
    const { cookie, deps } = await makeSession();
    const testDeps: FeedbackDeps = { ...deps, testMode: true };
    const res = await post(
      { ...VALID_BODY, _testResponse: { marks: 0, perPoint: [], feedback: 'wrong length' } },
      uniqueIp(),
      cookie,
      testDeps
    );
    expect(res.status).toBe(400);
  });

  it('rate limits by IP (before the login gate)', async () => {
    vi.stubEnv('FEEDBACK_RATE_LIMIT_PER_MIN', '2');
    const { cookie, deps } = await makeSession();
    const ip = uniqueIp();
    expect((await post(VALID_BODY, ip, cookie, deps)).status).toBe(200);
    expect((await post(VALID_BODY, ip, cookie, deps)).status).toBe(200);
    expect((await post(VALID_BODY, ip, cookie, deps)).status).toBe(429);
    // A different IP is unaffected.
    expect((await post(VALID_BODY, uniqueIp(), cookie, deps)).status).toBe(200);
  });
});
