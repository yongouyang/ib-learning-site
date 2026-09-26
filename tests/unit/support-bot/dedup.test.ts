import { describe, it, expect } from 'vitest';
import { InMemorySupportBotStorage } from '@/lib/support-bot/dummy';
import type { Alert } from '@/lib/support-bot/types';
import { analyticsDedupKey, contactDedupKey } from '@/lib/support-bot/types';

// Dedup key generation + collision handling (plan §4): one alert per dedup
// key while not resolved; a resolved key re-opens.

const T0 = Date.parse('2026-09-26T12:00:00.000Z');

function alert(id: string, overrides: Partial<Alert> = {}): Alert {
  return {
    alertId: id,
    source: 'analytics',
    sourceRef: 'agg:2026-09-25',
    severity: 'high',
    title: 't',
    body: 'b',
    status: 'open',
    createdAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    resolvedAt: null,
    dedupKey: id,
    expiresAt: Math.floor(T0 / 1000) + 90 * 86_400,
    ...overrides,
  };
}

describe('dedup keys (§4)', () => {
  it('contact keys are per-message, ever — no time bucket', () => {
    expect(contactDedupKey('m1')).toBe('contact:m1');
    // The same message polled an hour later produces the SAME key.
    expect(contactDedupKey('m1')).toBe(contactDedupKey('m1'));
  });

  it('analytics keys are per-kind per SUBJECT day — distinct kinds/days never collide', () => {
    const a = analyticsDedupKey('traffic_drop', '2026-09-25');
    expect(a).toBe('analytics:traffic_drop:2026-09-25');
    expect(analyticsDedupKey('zero_events', '2026-09-25')).not.toBe(a);
    expect(analyticsDedupKey('traffic_drop', '2026-09-24')).not.toBe(a);
  });
});

describe('dedup collision handling (conditional put semantics)', () => {
  it('one alert per dedup key while not resolved — across every non-resolved status', async () => {
    const storage = new InMemorySupportBotStorage(() => T0);
    expect(await storage.putAlert(alert('k1'))).toBe(true);

    for (const status of ['open', 'acknowledged', 'muted'] as const) {
      (storage as unknown as { alerts: Map<string, Alert> }).alerts.set('k1', { ...alert('k1'), status });
      expect(await storage.putAlert(alert('k1', { title: 'dup' }))).toBe(false);
      expect((await storage.getAlert('k1'))?.title).toBe('t'); // never overwritten
    }
  });

  it('a resolved key re-opens (§11)', async () => {
    const storage = new InMemorySupportBotStorage(() => T0);
    await storage.putAlert(alert('k1'));
    (storage as unknown as { alerts: Map<string, Alert> }).alerts.set('k1', {
      ...alert('k1'),
      status: 'resolved',
      resolvedAt: new Date(T0).toISOString(),
    });
    expect(await storage.putAlert(alert('k1', { title: 'reopened' }))).toBe(true);
    const reopened = await storage.getAlert('k1');
    expect(reopened?.status).toBe('open');
    expect(reopened?.resolvedAt).toBeNull();
  });

  it('different keys never collide', async () => {
    const storage = new InMemorySupportBotStorage(() => T0);
    expect(await storage.putAlert(alert('contact:m1'))).toBe(true);
    expect(await storage.putAlert(alert('analytics:traffic_drop:2026-09-25'))).toBe(true);
    expect(storage.listAlerts()).toHaveLength(2);
  });
});
