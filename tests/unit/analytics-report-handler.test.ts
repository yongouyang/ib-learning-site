import { describe, it, expect, vi } from 'vitest';
import { generateDailyReport } from '@/lib/analytics-report/http-handler';
import type { AnalyticsReportStorage, OpenAlertsReader, ReportEmailSender } from '@/lib/analytics-report/types';
import type { Alert } from '@/lib/support-bot/types';

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

  // --- S6: Open Alerts section (docs/support-bot-plan.md §9 Q9) -------------

  function fakeAlertReader(
    alerts: Array<Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'>> = []
  ): OpenAlertsReader {
    return { listUnresolvedAlerts: vi.fn(async () => alerts) };
  }

  it('renders the Open Alerts section when an alerts reader is wired', async () => {
    const sender = fakeSender();
    const alertsReader = fakeAlertReader([
      {
        severity: 'high',
        title: 'Traffic drop vs 7-day avg',
        status: 'open',
        createdAt: '2026-08-16T10:00:00.000Z',
      },
    ]);
    const result = await generateDailyReport(
      { storage: fakeStorage(ROWS), sender, recipients: ['a@b.c'], host: 'octavlearning.com', alertsReader },
      NOW_MS
    );
    expect(result.ok).toBe(true);
    expect(alertsReader.listUnresolvedAlerts).toHaveBeenCalledTimes(1);
    const args = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { html: string; text: string };
    expect(args.html).toContain('Open alerts');
    expect(args.html).toContain('1 unresolved');
    expect(args.html).toContain('Traffic drop vs 7-day avg');
    expect(args.html).toContain('2h old');
    expect(args.text).toContain('- [HIGH] Traffic drop vs 7-day avg (2h old)');
  });

  it('omits the section entirely when no alerts reader is wired (feature off — no error)', async () => {
    const sender = fakeSender();
    const result = await generateDailyReport(
      { storage: fakeStorage(ROWS), sender, recipients: ['a@b.c'], host: 'octavlearning.com' },
      NOW_MS
    );
    expect(result.ok).toBe(true);
    const args = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { html: string; text: string };
    expect(args.html).not.toContain('Open alerts');
    expect(args.text).not.toContain('Open alerts');
  });

  it('still sends the report when the alerts read fails (best-effort enrichment)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sender = fakeSender();
    const alertsReader = {
      listUnresolvedAlerts: vi.fn(async () => Promise.reject(new Error('GSI1 access denied'))),
    } as unknown as OpenAlertsReader;
    const result = await generateDailyReport(
      { storage: fakeStorage(ROWS), sender, recipients: ['a@b.c'], host: 'octavlearning.com', alertsReader },
      NOW_MS
    );
    expect(result.ok).toBe(true);
    expect(sender.send).toHaveBeenCalledTimes(1);
    const args = (sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { html: string };
    expect(args.html).not.toContain('Open alerts');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('open-alerts read failed'), 'GSI1 access denied');
    warn.mockRestore();
  });

  it('does not read alerts when the report will not be sent (no recipients)', async () => {
    const alertsReader = fakeAlertReader();
    const result = await generateDailyReport(
      { storage: fakeStorage(ROWS), sender: fakeSender(), recipients: [], host: 'octavlearning.com', alertsReader },
      NOW_MS
    );
    expect(result.ok).toBe(false);
    expect(alertsReader.listUnresolvedAlerts).not.toHaveBeenCalled();
  });
});
