import { getAnalyticsReportDeps } from '../../src/lib/analytics-report/deps';
import { generateDailyReport } from '../../src/lib/analytics-report/http-handler';

// Feature 1 — daily analytics report Lambda (docs/supportability-features-plan.md
// R1/R3). EventBridge-triggered on the cron(0 11 * * ? *) rule (11:00 UTC =
// 19:00 HKT): NOT an HTTP function — no Function URL, no CloudFront behavior,
// no lambda-adapter (that is for Function URL event shapes). The shared
// handler (src/lib/analytics-report/http-handler.ts) queries the aggregate
// rows on octav-analytics-events, builds the HTML email and sends it via
// Resend to every ANALYTICS_ADMIN_EMAILS recipient.
//
// Error semantics: the handler returns { ok:false } (never throws) for config
// problems that a retry cannot fix (no recipients); everything else throws so
// EventBridge's retry policy (exponential backoff) re-attempts the run.

interface ScheduledEvent {
  source?: string;
  time?: string;
  'detail-type'?: string;
}

export const handler = async (event: ScheduledEvent | unknown = {}): Promise<Record<string, unknown>> => {
  const e = (event ?? {}) as ScheduledEvent;
  console.log(
    `[analytics-report] invoked: ${JSON.stringify({
      source: e.source ?? null,
      time: e.time ?? null,
      detailType: e['detail-type'] ?? null,
    })}`
  );

  try {
    const result = await generateDailyReport(getAnalyticsReportDeps());
    console.log(
      `[analytics-report] ${result.ok ? 'sent' : 'not sent'}: ${JSON.stringify({
        sentTo: result.sentTo,
        fromDate: result.fromDate,
        toDate: result.toDate,
        totals: result.totals,
        hosts: result.hosts,
        prodEvents: result.prodEvents,
        totalEvents: result.totalEvents,
        ...(result.error ? { error: result.error } : {}),
      })}`
    );
    return { ok: result.ok, ...(result.error ? { error: result.error } : {}) };
  } catch (err) {
    console.error('[analytics-report] failed:', err instanceof Error ? err.message : err);
    throw err; // EventBridge retries
  }
};
