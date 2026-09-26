import { getSupportBotDeps } from '../../src/lib/support-bot/deps';
import { pollAndAlert } from '../../src/lib/support-bot/handler';

// Support bot Lambda (docs/support-bot-plan.md §7/§8). EventBridge-triggered
// on the rate(5 minutes) rule: NOT an HTTP function — no Function URL, no
// CloudFront behavior, no lambda-adapter (that is for Function URL event
// shapes). The shared handler (src/lib/support-bot/handler.ts) polls
// octav-contact (new messages) + octav-analytics-events (aggregate
// anomalies), triages, persists deduped alerts to octav-support-alerts and
// delivers them via Resend to every ANALYTICS_ADMIN_EMAILS recipient.
//
// Error semantics (plan §7/§11, the analytics-report pattern): the handler
// returns { ok:false } (never throws) for config problems that a retry cannot
// fix (no recipients); everything else throws so EventBridge's retry policy
// (exponential backoff) re-attempts the run. Individual signal/delivery
// failures are logged + continued inside the handler and never reach here.

interface ScheduledEvent {
  source?: string;
  time?: string;
  'detail-type'?: string;
}

export const handler = async (event: ScheduledEvent | unknown = {}): Promise<Record<string, unknown>> => {
  const e = (event ?? {}) as ScheduledEvent;
  console.log(
    `[support-bot] invoked: ${JSON.stringify({
      source: e.source ?? null,
      time: e.time ?? null,
      detailType: e['detail-type'] ?? null,
    })}`
  );

  try {
    const result = await pollAndAlert(getSupportBotDeps());
    console.log(
      `[support-bot] ${result.ok ? 'run complete' : 'run skipped'}: ${JSON.stringify({
        polled: result.polled,
        newAlerts: result.newAlerts,
        delivered: result.delivered,
        skipped: result.skipped,
        errors: result.errors,
        ...(result.error ? { error: result.error } : {}),
      })}`
    );
    return { ok: result.ok, ...(result.error ? { error: result.error } : {}) };
  } catch (err) {
    console.error('[support-bot] failed:', err instanceof Error ? err.message : err);
    throw err; // EventBridge retries
  }
};
