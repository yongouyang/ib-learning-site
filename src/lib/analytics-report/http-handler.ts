import { renderReportHtml, renderReportText } from './html';
import { ANALYTICS_REPORT_WINDOW_MS, buildReport, utcDate } from './types';
import type { AnalyticsReportDeps } from './deps';

// Feature 1 — daily analytics report handler (docs/supportability-features-plan.md
// R1). NOT an HTTP handler despite the filename (kept for plan parity): it is
// invoked by the scheduled Lambda (lambda/analytics-report) on the EventBridge
// cron, and by unit tests directly. Contract:
//   - computes the 24h aggregate window on the SERVER clock (never client
//     input — there is none),
//   - folds the aggregate rows with the PURE buildReport,
//   - renders the HTML/text email,
//   - sends it to every ANALYTICS_ADMIN_EMAILS recipient via the deps sender.
// Error semantics for the EventBridge retry policy: hard config problems
// (no recipients, sender = no-op) return { ok: false } WITHOUT sending — a
// retry would not fix them; anything that throws (storage query failure,
// provider HTTP failure) propagates so EventBridge retries it.

export interface AnalyticsReportResult {
  ok: boolean;
  /** Error only when ok=false (config problem — not retried). */
  error?: string;
  sentTo: string[];
  generatedAt: string;
  fromDate: string;
  toDate: string;
  totals: Record<string, number>;
  hosts: Record<string, number>;
  prodEvents: number;
  totalEvents: number;
}

export async function generateDailyReport(
  deps: AnalyticsReportDeps,
  nowMs: number = Date.now()
): Promise<AnalyticsReportResult> {
  const fromDate = utcDate(nowMs - ANALYTICS_REPORT_WINDOW_MS);
  const toDate = utcDate(nowMs);

  // Query first — a storage failure throws and EventBridge retries.
  const aggregates = await deps.storage.getAggregatesBetween(fromDate, toDate);
  const data = buildReport(aggregates, { fromDate, toDate, host: deps.host, nowMs });

  const base: Omit<AnalyticsReportResult, 'ok' | 'error'> = {
    sentTo: deps.recipients,
    generatedAt: data.generatedAt,
    fromDate,
    toDate,
    totals: data.totals,
    hosts: data.hosts,
    prodEvents: data.prodEvents,
    totalEvents: data.totalEvents,
  };

  if (deps.recipients.length === 0) {
    // Config problem: no recipients configured (ANALYTICS_ADMIN_EMAILS empty).
    // Returning ok:false (NOT throwing) avoids a 24h EventBridge retry storm.
    return { ...base, ok: false, error: 'no recipients configured (ANALYTICS_ADMIN_EMAILS)' };
  }

  const subject = `Octav Analytics — ${data.toDate} (last 24h)`;
  await deps.sender.send({
    to: deps.recipients,
    subject,
    html: renderReportHtml(data, deps.host),
    text: renderReportText(data, deps.host),
  });

  return { ...base, ok: true };
}
