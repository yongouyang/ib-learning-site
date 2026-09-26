import { utcDate } from '../analytics/types';
import type { ContactMessage } from '../contact/types';
import { ANOMALY_BASELINE_DAYS, ANOMALY_DAY_MS, detectAnalyticsAnomalies } from './anomaly-detection';
import type { SupportBotDeps } from './deps';
import type { Alert, ContactSignal, RawSignal, TriageResult } from './types';
import {
  contactDedupKey,
  supportAlertTtl,
  truncateAlertBody,
  truncateAlertTitle,
} from './types';

// Support bot core orchestration loop (docs/support-bot-plan.md §7). Named
// handler.ts (not the plan's http-handler.ts): this Lambda is
// EventBridge-triggered with NO HTTP route (§2/§7) — the analytics-report
// module kept the http-handler name for plan parity and its own header
// apologises for it; we name it honestly instead.
//
// Flow (§7): poll sources → per signal: dedup check (GetItem) → triage →
// conditional PutItem → deliver via Resend (§6.1, S3).
//
// Error semantics (§7/§11):
//   - NO RECIPIENTS configured → return { ok:false, error } WITHOUT throwing
//     and without polling — a retry cannot fix it, so throwing would cause an
//     EventBridge retry storm (the analytics-report pattern);
//   - POLL failures (DynamoDB timeout on a source read) THROW — transient, so
//     EventBridge retries with backoff;
//   - INDIVIDUAL-SIGNAL failures (dedup read, triage, persist for one signal)
//     log + continue — one bad signal never aborts the batch;
//   - DELIVERY failures log + continue and never fail the run — persist-first,
//     delivery best-effort (§6.1: duplicate alerts are worse than a missed
//     email; the alert is durable in DynamoDB regardless);
//   - CONFIG problems fail closed in getSupportBotDeps at startup (missing
//     table names, unknown storage/triage kinds, non-Resend provider in
//     dynamodb mode) — the Lambda throws before any poll, so a
//     misconfiguration can never silently run.

export interface SupportBotRunSummary {
  ok: boolean;
  /** Error only when ok=false (config problem — not retried). */
  error?: string;
  /** Signals examined this run (contact messages + detected anomalies). */
  polled: number;
  /** Alerts persisted this run (conditional put landed). */
  newAlerts: number;
  /** Successful deliveries. */
  delivered: number;
  /** Dedup hits (existing unresolved alert) + concurrent-put losers. */
  skipped: number;
  /** Per-signal failures (logged + continued). */
  errors: number;
}

/** Build the contact source signal — one alert per message, ever (§4). */
export function contactSignalFromMessage(message: ContactMessage): ContactSignal {
  return {
    source: 'contact',
    kind: 'contact_message',
    dedupKey: contactDedupKey(message.messageId),
    sourceRef: message.messageId,
    message,
  };
}

/** Build the §4 alert row from a signal + its triage. Server clock only. */
export function buildAlert(signal: RawSignal, triage: TriageResult, nowMs: number): Alert {
  const iso = new Date(nowMs).toISOString();
  return {
    // alertId === dedupKey — the deterministic-PK dedup design (types.ts note).
    alertId: signal.dedupKey,
    source: signal.source,
    sourceRef: signal.sourceRef,
    severity: triage.severity,
    title: truncateAlertTitle(triage.title),
    body: truncateAlertBody(triage.body),
    status: 'open',
    createdAt: iso,
    updatedAt: iso,
    resolvedAt: null,
    dedupKey: signal.dedupKey,
    expiresAt: supportAlertTtl(nowMs),
  };
}

export async function pollAndAlert(
  deps: SupportBotDeps,
  nowMs: number = deps.clock()
): Promise<SupportBotRunSummary> {
  // §11: no recipients configured → ok:false WITHOUT throwing (a retry cannot
  // fix it) and without polling — no point persisting alerts nobody can be
  // told about; the ok:false summary line is the loud signal.
  if (deps.recipients.length === 0) {
    const summary: SupportBotRunSummary = {
      ok: false,
      error: 'no recipients configured (ANALYTICS_ADMIN_EMAILS)',
      polled: 0,
      newAlerts: 0,
      delivered: 0,
      skipped: 0,
      errors: 0,
    };
    console.log(`[support-bot] run: ${JSON.stringify(summary)}`);
    return summary;
  }

  // 1. Poll sources. A storage failure here THROWS (transient → EventBridge
  //    retries); the run never half-polls quietly.
  const messages = await deps.storage.listNewContactMessages();
  // The anomaly window covers the subject day (latest complete UTC day) plus
  // its 7-day baseline.
  const fromDate = utcDate(nowMs - (ANOMALY_BASELINE_DAYS + 1) * ANOMALY_DAY_MS);
  const toDate = utcDate(nowMs);
  const aggregates = await deps.storage.getAggregatesBetween(fromDate, toDate);

  const signals: RawSignal[] = [
    ...messages.map(contactSignalFromMessage),
    ...detectAnalyticsAnomalies(aggregates, { nowMs, prodHost: deps.prodHost }),
  ];

  let newAlerts = 0;
  let delivered = 0;
  let skipped = 0;
  let errors = 0;

  // 2. Per signal: dedup → triage → conditional persist → deliver.
  for (const signal of signals) {
    try {
      const existing = await deps.storage.getAlert(signal.dedupKey);
      if (existing && existing.status !== 'resolved') {
        skipped++; // one alert per dedup key while not resolved (§4)
        continue;
      }
      const triage = await deps.triage.triage(signal);
      const alert = buildAlert(signal, triage, nowMs);
      const created = await deps.storage.putAlert(alert);
      if (!created) {
        skipped++; // concurrent invocation won the conditional put (§11)
        continue;
      }
      newAlerts++;
      try {
        await deps.delivery.deliver(alert);
        delivered++;
      } catch (err) {
        // Persist-first, delivery best-effort (§6.1): log + continue, the
        // alert is durable in DynamoDB and visible in /admin/dynamodb.
        console.error(
          `[support-bot] delivery failed for ${alert.alertId}:`,
          err instanceof Error ? err.message : err
        );
      }
    } catch (err) {
      // Individual-signal failure: log + continue — never abort the batch (§7).
      errors++;
      console.error(
        `[support-bot] signal failed (${signal.dedupKey}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // 3. Summary (§7 step 3) — one structured line per run.
  const summary: SupportBotRunSummary = { ok: true, polled: signals.length, newAlerts, delivered, skipped, errors };
  console.log(`[support-bot] run: ${JSON.stringify(summary)}`);
  return summary;
}
