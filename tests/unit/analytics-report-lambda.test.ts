import { describe, it, expect, afterEach, vi } from 'vitest';
import { handler } from '../../lambda/analytics-report/index';

// Lambda adapter tests (mirrors the other lambda-adapter tests, minus HTTP):
// the EventBridge handler delegates to the shared generateDailyReport and maps
// outcomes onto the { ok } envelope. Runs against the REAL dummy deps (shared
// universe + DummyReportSender) with env stubs — no mocks.

describe('lambda/analytics-report adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns { ok:false, error } when no recipients are configured (no retry)', async () => {
    const result = await handler({ source: 'aws.events', 'detail-type': 'Scheduled Event', time: '2026-08-16T11:00:00Z' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no recipients/);
  });

  it('returns { ok:true } and sends via the dummy sender with recipients configured', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_EMAILS', 'admin@example.com');
    const result = await handler({ source: 'aws.events' });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rethrows deps failures so EventBridge retries', async () => {
    vi.stubEnv('ANALYTICS_REPORT_STORAGE', 'dynamodb');
    // No ANALYTICS_TABLE → getAnalyticsReportDeps throws inside the handler →
    // it logs and rethrows (the retry path).
    await expect(handler({})).rejects.toThrow(/ANALYTICS_TABLE/);
  });

  it('tolerates arbitrary invocation payloads (test invocations, console runs)', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_EMAILS', 'admin@example.com');
    const result = await handler({ custom: 'payload' });
    expect(result.ok).toBe(true);
  });
});
