import { describe, it, expect } from 'vitest';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import type { RawAnalyticsEventItem } from '@/lib/analytics/types';

// The in-memory analytics dummy: raw append + aggregate increments mirroring
// the DynamoDB ADD upsert, fixed-window ingest budget with an injectable
// clock, and the summary folded by the shared buildSummary.

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

function makeStorage(clock: () => number = () => NOW_MS) {
  return new InMemoryAnalyticsStorage(clock);
}

function event(overrides: Partial<Parameters<InMemoryAnalyticsStorage['recordEvent']>[0]> = {}) {
  return {
    name: 'page_view',
    props: {},
    urlPath: '/subjects/math',
    referrer: 'google.com',
    host: 'octavlearning.com',
    sessionId: 'sess-1',
    ua: 'TestAgent',
    clientTs: '2026-08-15T10:00:00.000Z',
    ...overrides,
  } as Parameters<InMemoryAnalyticsStorage['recordEvent']>[0];
}

describe('InMemoryAnalyticsStorage.recordEvent', () => {
  it('appends the raw event and increments all four aggregate kinds', async () => {
    const storage = makeStorage();
    await storage.recordEvent(event({ name: 'quiz_started', props: { x: 1 } }));

    // Raw item mirrors the DynamoDB Put: k="ev", date#ts#uuid SK, 90-day TTL.
    const raw = (storage as unknown as { rawEvents: RawAnalyticsEventItem[] }).rawEvents;
    expect(raw).toHaveLength(1);
    expect(raw[0].k).toBe('ev');
    expect(raw[0].s).toMatch(/^2026-08-15#\d{13}#[0-9a-f-]{36}$/);
    expect(raw[0].name).toBe('quiz_started');
    expect(raw[0].props).toEqual({ x: 1 });
    expect(raw[0].expiresAt).toBe(Math.floor(NOW_MS / 1000) + 90 * 86_400);

    const summary = await storage.getSummary(30);
    expect(summary.totals).toEqual({ quiz_started: 1 });
    expect(summary.topPages).toEqual([{ path: '/subjects/math', count: 1 }]);
    expect(summary.topReferrers).toEqual([{ referrer: 'google.com', count: 1 }]);
    expect(summary.hosts).toEqual({ 'octavlearning.com': 1 });
  });

  it('buckets an empty referrer under "direct"', async () => {
    const storage = makeStorage();
    await storage.recordEvent(event({ referrer: '' }));
    const summary = await storage.getSummary(30);
    expect(summary.topReferrers).toEqual([{ referrer: 'direct', count: 1 }]);
  });

  it('accumulates counts across events and days', async () => {
    const storage = makeStorage();
    await storage.recordEvent(event({ clientTs: '2026-08-15T10:00:00.000Z' }));
    await storage.recordEvent(event({ clientTs: '2026-08-15T11:00:00.000Z' }));
    await storage.recordEvent(event({ clientTs: '2026-08-16T09:00:00.000Z', urlPath: '/exams' }));

    const summary = await storage.getSummary(7);
    expect(summary.dailySeries.page_view).toEqual({ '2026-08-15': 2, '2026-08-16': 1 });
    expect(summary.topPages).toEqual([
      { path: '/subjects/math', count: 2 },
      { path: '/exams', count: 1 },
    ]);
  });

  it('respects the summary days window (the shared buildSummary filters)', async () => {
    const storage = makeStorage();
    await storage.recordEvent(event({ clientTs: '2026-01-01T10:00:00.000Z' })); // months old
    await storage.recordEvent(event({ clientTs: '2026-08-16T09:00:00.000Z' }));

    expect((await storage.getSummary(7)).totals.page_view).toBe(1);
    expect((await storage.getSummary(30)).totals.page_view).toBe(1);
    expect((await storage.getSummary(90)).totals.page_view).toBe(1);
    // A 90-day window still excludes the January event (2026-08-16 - 89d ≈ 2026-05-19).
    const summary365 = await storage.getSummary(365);
    expect(summary365.totals.page_view).toBe(2);
  });
});

describe('InMemoryAnalyticsStorage.incrementAnalyticsEventCount', () => {
  it('allows limit events per fixed window and denies the next, keyed by ip', async () => {
    const storage = makeStorage();
    for (let i = 0; i < 3; i++) {
      expect(await storage.incrementAnalyticsEventCount('1.2.3.4', 3, 600)).toBe(true);
    }
    expect(await storage.incrementAnalyticsEventCount('1.2.3.4', 3, 600)).toBe(false);
    // A different IP has its own bucket.
    expect(await storage.incrementAnalyticsEventCount('5.6.7.8', 3, 600)).toBe(true);
  });

  it('resets atomically when the window rolls (epoch is part of the key)', async () => {
    let now = 1_000;
    const storage = makeStorage(() => now);
    for (let i = 0; i < 3; i++) {
      expect(await storage.incrementAnalyticsEventCount('ip', 3, 600)).toBe(true);
    }
    expect(await storage.incrementAnalyticsEventCount('ip', 3, 600)).toBe(false);

    // The same clock the next epoch window (600s = 600_000ms later).
    now = 1_000 + 600_000;
    expect(await storage.incrementAnalyticsEventCount('ip', 3, 600)).toBe(true);
  });
});

describe('InMemoryAnalyticsStorage misc', () => {
  it('probeAnalyticsTable resolves immediately (no-op)', async () => {
    await expect(makeStorage().probeAnalyticsTable()).resolves.toBeUndefined();
  });

  it('inherits the auth session subset (shared universe chain)', async () => {
    const storage = makeStorage();
    await storage.createUser({
      userId: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      role: 'parent',
      tier: 'free',
      childProfiles: [],
      createdAt: 'now',
      lastLoginAt: 'now',
    });
    expect((await storage.getUserById('u1'))?.email).toBe('a@example.com');
  });
});
