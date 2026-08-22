import { describe, it, expect } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import {
  handleAnalyticsEvent,
  handleAnalyticsHealth,
  handleAnalyticsSummary,
  isAdminEmail,
  normalizeReferrer,
  normalizeUrlPath,
} from '@/lib/analytics/http-handler';
import type { AnalyticsDeps } from '@/lib/analytics/deps';
import type { AuthDeps } from '@/lib/auth/types';
import type { RawAnalyticsEventItem } from '@/lib/analytics/types';

// Handler-level analytics tests: one fresh in-memory universe per test; the
// summary tests seed a real session through the auth handlers (the same
// dummy-OTP login flow as progress-http-handler.test.ts).

const DUMMY_CODE = '123456';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `analytics-${counter}@example.com`;
}

interface TestDeps {
  storage: InMemoryAnalyticsStorage;
  authDeps: AuthDeps;
  analyticsDeps: AnalyticsDeps;
}

function makeDeps(adminEmails = '', clock?: () => number): TestDeps {
  // A fixed clock pins getSummary's "now" so the seeded-dates tests below stay
  // deterministic instead of drifting with the real calendar (they broke once
  // the seeded 2026-08-15/16 dates aged out of the 7-day window).
  const storage = new InMemoryAnalyticsStorage(clock);
  const sender = new DummyEmailSender();
  return {
    storage,
    authDeps: { storage, emailSender: sender, testMode: true, dummyMode: true },
    analyticsDeps: { storage, adminEmails },
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

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    name: 'page_view',
    props: {},
    url: 'https://octavlearning.com/subjects/math',
    referrer: 'https://www.google.com/search?q=x',
    sessionId: 'sess-abc_1',
    clientTs: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

function postEvent(t: TestDeps, body: unknown, headers: Record<string, string> = {}) {
  return handleAnalyticsEvent(jsonRequest('POST', 'https://x.test/api/analytics/event', body, headers), t.analyticsDeps);
}

function rawEvents(storage: InMemoryAnalyticsStorage): RawAnalyticsEventItem[] {
  return (storage as unknown as { rawEvents: RawAnalyticsEventItem[] }).rawEvents;
}

describe('POST /api/analytics/event', () => {
  it('accepts a valid event (204) and records the SERVER-normalized payload', async () => {
    const t = makeDeps();
    const res = await postEvent(
      t,
      envelope({
        url: 'https://octavlearning.com/subjects/math?difficulty=easy#frag',
        referrer: 'https://www.google.com/search?q=x',
      }),
      { 'x-forwarded-for': '1.2.3.4', 'user-agent': `Agent/${'x'.repeat(100)}` }
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');

    const raw = rawEvents(t.storage);
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe('page_view');
    expect(raw[0].host).toBe('x.test');
    expect(raw[0].sessionId).toBe('sess-abc_1');
    expect(raw[0].ua).toHaveLength(80);

    // Normalization happened BEFORE write: path-only url, host-only referrer.
    const summary = await t.storage.getSummary(30);
    expect(summary.totals).toEqual({ page_view: 1 });
    expect(summary.topPages).toEqual([{ path: '/subjects/math', count: 1 }]);
    expect(summary.topReferrers).toEqual([{ referrer: 'www.google.com', count: 1 }]);
  });

  it('rejects invalid envelopes with a generic 400 and records nothing', async () => {
    const t = makeDeps();
    const cases: unknown[] = [
      envelope({ name: 'not_a_real_event' }),
      envelope({ name: 'quiz_started', props: {} }), // per-name props mismatch
      envelope({ sessionId: 'has space' }),
      envelope({ clientTs: undefined }),
      envelope({ url: '' }),
    ];
    for (const body of cases) {
      const res = await postEvent(t, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid request' }); // no internals
    }
    expect((await t.storage.getSummary(30)).totals).toEqual({});
  });

  it('rejects a far-future clientTs (24h skew guard) with 400', async () => {
    const t = makeDeps();
    const res = await postEvent(t, envelope({ clientTs: '9999-01-01T00:00:00.000Z' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON and bodies over the 4KB budget with 400', async () => {
    const t = makeDeps();
    const badJson = await handleAnalyticsEvent(
      new Request('https://x.test/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      t.analyticsDeps
    );
    expect(badJson.status).toBe(400);

    const oversized = await postEvent(t, envelope({ referrer: 'x'.repeat(5000) }));
    expect(oversized.status).toBe(400);
    expect((await t.storage.getSummary(30)).totals).toEqual({});
  });

  it('enforces the per-IP budget (120/10min): 121st → 429, spoofed XFF uses the LAST entry', async () => {
    const t = makeDeps();
    const headers = { 'x-forwarded-for': '1.2.3.4' };
    for (let i = 0; i < 120; i++) {
      expect((await postEvent(t, envelope(), headers)).status).toBe(204);
    }
    const limited = await postEvent(t, envelope(), headers);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'Too many events' });

    // The spoofed prefix is ignored — the LAST XFF entry is the bucket key,
    // so this hits the SAME exhausted bucket.
    expect((await postEvent(t, envelope(), { 'x-forwarded-for': 'evil, 1.2.3.4' })).status).toBe(429);
    // A different IP (and the missing-XFF "local" fallback) have own buckets.
    expect((await postEvent(t, envelope(), { 'x-forwarded-for': '5.6.7.8' })).status).toBe(204);
    expect((await postEvent(t, envelope())).status).toBe(204);
  });

  it('normalizes unparseable urls/referrers defensively', () => {
    expect(normalizeUrlPath('not a url')).toBe('/');
    expect(normalizeUrlPath('https://x.test')).toBe('/');
    expect(normalizeUrlPath('https://x.test/a/b?q=1#f')).toBe('/a/b');
    expect(normalizeReferrer('')).toBe('direct');
    expect(normalizeReferrer('junk')).toBe('direct');
    expect(normalizeReferrer('https://sub.example.com/path?q=1')).toBe('sub.example.com');
  });
});

describe('GET /api/analytics/summary', () => {
  const get = (t: TestDeps, query = '', cookie = '') =>
    handleAnalyticsSummary(new Request(`https://x.test/api/analytics/summary${query}`, { headers: cookie ? { cookie } : {} }), t.analyticsDeps);

  it('401s without a session', async () => {
    const t = makeDeps();
    expect((await get(t)).status).toBe(401);
  });

  it('403s a signed-in non-admin and 200s an admin (case-insensitive allowlist)', async () => {
    const t = makeDeps(' Boss@Example.com ');
    const other = await login(t, uniqueEmail());
    expect(other.user.email).not.toBe('boss@example.com');
    expect((await get(t, '', other.cookie)).status).toBe(403);

    const admin = await login(t, 'boss@example.com');
    const res = await get(t, '', admin.cookie);
    expect(res.status).toBe(200);
    // Sliding session refresh re-issues the cookie.
    expect(res.headers.get('set-cookie')).toContain('Max-Age=');
    expect(await res.json()).toEqual({
      days: 30,
      dailySeries: {},
      topPages: [],
      topReferrers: [],
      totals: {},
      hosts: {},
    });
  });

  it('returns the summary for seeded events with the requested days window', async () => {
    const t = makeDeps('boss@example.com', () => Date.parse('2026-08-16T12:00:00.000Z'));
    const admin = await login(t, 'boss@example.com');

    await t.storage.recordEvent({
      name: 'page_view',
      props: {},
      urlPath: '/subjects/math',
      referrer: 'google.com',
      host: 'octavlearning.com',
      sessionId: 'sess-1',
      ua: 'TestAgent',
      clientTs: '2026-08-15T10:00:00.000Z',
    });
    await t.storage.recordEvent({
      name: 'quiz_started',
      props: { subjectId: 'math', topicId: 't1', source: 'topic_page' },
      urlPath: '/subjects/math/t1/quiz',
      referrer: '',
      host: 'octavlearning.com',
      sessionId: 'sess-1',
      ua: 'TestAgent',
      clientTs: '2026-08-16T09:00:00.000Z',
    });

    const res = await get(t, '?days=7', admin.cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
    expect(body.dailySeries.page_view).toEqual({ '2026-08-15': 1 });
    expect(body.totals).toEqual({ page_view: 1, quiz_started: 1 });
    expect(body.topPages).toEqual([
      { path: '/subjects/math', count: 1 },
      { path: '/subjects/math/t1/quiz', count: 1 },
    ]);
    expect(body.topReferrers).toEqual([
      { referrer: 'direct', count: 1 },
      { referrer: 'google.com', count: 1 },
    ]);
  });

  it('validates the days param (7/30/90; default 30)', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');

    expect((await get(t, '?days=31', admin.cookie)).status).toBe(400);
    expect((await get(t, '?days=abc', admin.cookie)).status).toBe(400);
    expect((await get(t, '?days=0', admin.cookie)).status).toBe(400);

    const d7 = await get(t, '?days=7', admin.cookie);
    expect(d7.status).toBe(200);
    expect((await d7.json()).days).toBe(7);
    const d90 = await get(t, '?days=90', admin.cookie);
    expect(d90.status).toBe(200);
    expect((await d90.json()).days).toBe(90);
    const dDefault = await get(t, '', admin.cookie);
    expect((await dDefault.json()).days).toBe(30);
  });

  it('isAdminEmail is case-insensitive and trims the list', () => {
    expect(isAdminEmail('boss@example.com', ' Boss@Example.com ,other@example.com')).toBe(true);
    expect(isAdminEmail('other@example.com', 'Boss@Example.com,other@example.com')).toBe(true);
    expect(isAdminEmail('someone@example.com', 'boss@example.com')).toBe(false);
    expect(isAdminEmail('boss@example.com', '')).toBe(false);
  });
});

describe('GET /api/analytics/_health', () => {
  it('returns 200 when the table query works', async () => {
    const t = makeDeps();
    const res = await handleAnalyticsHealth(new Request('https://x.test/api/analytics/_health'), t.analyticsDeps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 when the probe fails (missing table/IAM class)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'probeAnalyticsTable') {
          return async () => {
            const err = new Error('AccessDeniedException');
            err.name = 'AccessDeniedException';
            throw err;
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const res = await handleAnalyticsHealth(new Request('https://x.test/api/analytics/_health'), {
      ...t.analyticsDeps,
      storage: failing,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});
