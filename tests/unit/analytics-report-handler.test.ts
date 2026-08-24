import { describe, it, expect, vi } from 'vitest';
import { generateDailyReport } from '@/lib/analytics-report/http-handler';
import type { AnalyticsReportStorage, ReportEmailSender } from '@/lib/analytics-report/types';

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

function fakeStorage(rows: Array<{ s: string; count: number }> = []) {
  return {
    getAggregatesBetween: vi.fn(async () => rows),
  } as unknown as AnalyticsReportStorage;
}

function fakeSender() {
  return { send: vi.fn(async () => {}) } as unknown as ReportEmailSender;
}

const ROWS = [
  { s: '2026-08-16#event#page_view', count: 3 },
  { s: '2026-08-16#host#octavlearning.com', count: 3 },
];

describe('generateDailyReport', () => {
  it('queries the 24h window and sends the rendered email to every recipient', async () => {
    const storage = fakeStorage(ROWS);
    const sender = fakeSender();
    const result = await generateDailyReport(
      { storage, sender, recipients: ['admin@example.com', 'second@example.com'], host: 'octavlearning.com' },
      NOW_MS
    );

    expect(storage.getAggregatesBetween).toHaveBeenCalledWith('2026-08-15', '2026-08-16');
    expect(sender.send).toHaveBeenCalledTimes(1);
    const args = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    expect(args.to).toEqual(['admin@example.com', 'second@example.com']);
    expect(args.subject).toBe('Octav Analytics — 2026-08-16 (last 24h)');
    expect(args.html).toContain('Octav Analytics');
    expect(args.text).toContain('Page views: 3');

    expect(result).toMatchObject({
      ok: true,
      sentTo: ['admin@example.com', 'second@example.com'],
      fromDate: '2026-08-15',
      toDate: '2026-08-16',
      totals: { page_view: 3 },
      prodEvents: 3,
      totalEvents: 3,
    });
  });

  it('still sends a zero-data report when the window is empty', async () => {
    const storage = fakeStorage([]);
    const sender = fakeSender();
    const result = await generateDailyReport(
      { storage, sender, recipients: ['admin@example.com'], host: 'octavlearning.com' },
      NOW_MS
    );
    expect(result.ok).toBe(true);
    expect(sender.send).toHaveBeenCalledTimes(1);
    const args = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { html: string };
    expect(args.html).toContain('No data in this window.');
  });

  it('returns ok:false WITHOUT sending when no recipients are configured', async () => {
    const storage = fakeStorage(ROWS);
    const sender = fakeSender();
    const result = await generateDailyReport(
      { storage, sender, recipients: [], host: 'octavlearning.com' },
      NOW_MS
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no recipients/);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('propagates storage failures (EventBridge retries)', async () => {
    const storage = { getAggregatesBetween: vi.fn(async () => Promise.reject(new Error('query failed'))) };
    await expect(
      generateDailyReport(
        { storage: storage as unknown as AnalyticsReportStorage, sender: fakeSender(), recipients: ['a@b.c'], host: 'octavlearning.com' },
        NOW_MS
      )
    ).rejects.toThrow('query failed');
  });

  it('propagates sender failures (EventBridge retries)', async () => {
    const sender = { send: vi.fn(async () => Promise.reject(new Error('HTTP 500'))) };
    await expect(
      generateDailyReport(
        { storage: fakeStorage(ROWS), sender: sender as unknown as ReportEmailSender, recipients: ['a@b.c'], host: 'octavlearning.com' },
        NOW_MS
      )
    ).rejects.toThrow('HTTP 500');
  });

  it('highlights the configured host in the traffic split', async () => {
    const sender = fakeSender();
    await generateDailyReport(
      { storage: fakeStorage(ROWS), sender, recipients: ['a@b.c'], host: 'custom.example.com' },
      NOW_MS
    );
    const result = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { html: string };
    // prodEvents for the configured host is 0 (no matching host row) → 0%.
    expect(result.html).toContain('Prod (custom.example.com): <strong style="color:#111827;">0</strong> events · 0% of traffic');
  });
});
