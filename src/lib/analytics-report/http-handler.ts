import { renderReportHtml, renderReportText } from './html';
import { ANALYTICS_REPORT_WINDOW_MS, buildOpenAlertsSummary, buildReport, utcDate } from './types';
import type { OpenAlertsSummary } from './types';
import type { AnalyticsReportDeps } from './deps';

// Feature 1 — daily analytics report handler (docs/supportability-features-plan.md
// R1). NOT an HTTP handler despite the filename (kept for plan parity): it is
// invoked by the scheduled Lambda (lambda/analytics-report) on the EventBridge
// cron, and by unit tests directly. Contract:
//   - computes the 24h aggregate window on the SERVER clock (never client
//     input — there is none),
//   - folds the aggregate rows with the PURE buildReport,
//   - S6 (docs/support-bot-plan.md §9 Q9): when deps.alertsReader is wired
//     (SUPPORT_ALERTS_TABLE set), folds unresolved octav-support-alerts rows
//     with the PURE buildOpenAlertsSummary into an "Open Alerts" section —
//     best-effort: a read failure omits the section, it never fails the send,
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

  // S6: the "Open Alerts" section is best-effort ENRICHMENT — a broken alerts
  // read must not suppress the daily analytics email (alerts still arrive via
  // the support bot's own delivery path), so a failure logs and omits the
  // section rather than throwing into an EventBridge retry. Read AFTER the
  // recipients check: a report that will not be sent does not pay for the GSI
  // read.
  let openAlerts: OpenAlertsSummary | undefined;
  if (deps.alertsReader) {
    try {
      openAlerts = buildOpenAlertsSummary(await deps.alertsReader.listUnresolvedAlerts(), { nowMs });
    } catch (err) {
      console.warn(
        '[analytics-report] open-alerts read failed — section omitted:',
        err instanceof Error ? err.message : err
      );
    }
  }

  const subject = `Octav Analytics — ${data.toDate} (last 24h)`;
  await deps.sender.send({
    to: deps.recipients,
    subject,
    html: renderReportHtml(data, deps.host, openAlerts),
    text: renderReportText(data, deps.host, openAlerts),
  });

  return { ...base, ok: true };
}
