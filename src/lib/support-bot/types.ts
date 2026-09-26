import type { AnalyticsAggregateItem } from '../analytics/types';
import type { ContactMessage } from '../contact/types';

// Agentic support bot (docs/support-bot-plan.md) — S1/S2 types + constants.
// The bot is an EventBridge-scheduled Lambda (NO HTTP route): it polls
// structured sources (octav-contact new messages, octav-analytics-events
// aggregate rows), triages each signal rule-based (v1; §9 Q4), persists one
// alert per dedup key on octav-support-alerts, and delivers it (S3 wires the
// Resend sender; S2 ships a log-only seam).
//
// DEDUP DESIGN DECISION (deviation from plan §4, recorded): the plan tables
// alertId as a UUID v4 AND specifies the dedup check as "GetItem(dedupKey)" —
// but dedupKey is a plain attribute, not the PK, and the only GSI is
// status→createdAt, so a GetItem on dedupKey is impossible as drawn. The
// simplest design satisfying "one alert per dedup key while not resolved"
// (§4) is a DETERMINISTIC alertId: alertId === dedupKey. Then §7's
// GetItem(dedupKey) works verbatim against the PK, and the conditional
// PutItem (attribute_not_exists(alertId) OR status = "resolved") is the
// idempotency primitive for concurrent invocations — no second GSI needed.
// The dedupKey attribute is still stored on the item (§4 schema parity).
//
// SECOND DEVIATION (analytics dedup key): §4 buckets analytics keys by HOUR
// ("analytics:{kind}:{YYYY-MM-DD}:{HH}"), but the aggregate rows are DAY-keyed
// (k="agg", s="<date>#<kind>#<key>" — the analytics-report honesty note), so
// detection runs on the latest COMPLETE UTC day. An hour-bucketed key would
// re-alert every hour for the same day-old anomaly; the key is therefore
// day-bucketed on the SUBJECT day: "analytics:{kind}:{YYYY-MM-DD}" — one
// alert per anomaly kind per subject day while not resolved.

// --- Constants ---------------------------------------------------------------

export const ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['open', 'acknowledged', 'resolved', 'muted'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** v1 polls contact + analytics only; cloudwatch/email are v1.1 (§9 Q2/Q3). */
export const ALERT_SOURCES = ['contact', 'analytics', 'cloudwatch', 'email'] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

export const ALERT_TITLE_MAX = 200;
export const ALERT_BODY_MAX = 4000;
/** Alert rows TTL at createdAt + 90 days (§9 Q5 — matches the raw-event TTL). */
export const SUPPORT_ALERT_TTL_DAYS = 90;

/** The §3.2 anomaly kinds (detection: anomaly-detection.ts; triage: triage/rule-based.ts). */
export const ANALYTICS_ANOMALY_KINDS = [
  'error_spike',
  'traffic_drop',
  'ai_quota_exhaustion',
  'zero_events',
] as const;
export type AnalyticsAnomalyKind = (typeof ANALYTICS_ANOMALY_KINDS)[number];

// --- Storage item (octav-support-alerts, plan §4) ------------------------------

export interface Alert {
  /** = dedupKey (deterministic — see the dedup design note above). */
  alertId: string;
  source: AlertSource;
  /** messageId / "agg:<subjectDate>" / log-group-name / email-id. */
  sourceRef: string;
  severity: AlertSeverity;
  /** Short human-readable summary (≤ ALERT_TITLE_MAX). */
  title: string;
  /** Full context + proposed resolution (≤ ALERT_BODY_MAX). */
  body: string;
  status: AlertStatus;
  /** ISO-8601, server clock. */
  createdAt: string;
  /** ISO-8601, server clock. */
  updatedAt: string;
  /** ISO-8601 when resolved; null while open. */
  resolvedAt: string | null;
  /** The dedup key (=== alertId; kept for §4 schema parity). */
  dedupKey: string;
  /** Epoch seconds — DynamoDB TTL (createdAt + 90 days). */
  expiresAt: number;
}

// --- Signals (what the source pollers hand to triage) --------------------------

/** A new octav-contact message (status "new") that has not yet been alerted. */
export interface ContactSignal {
  source: 'contact';
  kind: 'contact_message';
  /** contactDedupKey(message.messageId) — one alert per message, ever. */
  dedupKey: string;
  /** The messageId. */
  sourceRef: string;
  message: ContactMessage;
}

/** An analytics anomaly detected over the daily aggregate rows (§3.2). */
export interface AnalyticsAnomalySignal {
  source: 'analytics';
  kind: AnalyticsAnomalyKind;
  /** analyticsDedupKey(kind, subjectDate) — one alert per kind per subject day. */
  dedupKey: string;
  /** "agg:<subjectDate>" — the aggregate window the anomaly was read from. */
  sourceRef: string;
  /** The UTC subject day the anomaly was detected on (YYYY-MM-DD) — the latest COMPLETE day. */
  subjectDate: string;
  /** The observed value on the subject day (event count / prod-host event count). */
  count: number;
  /**
   * The comparison baseline, per kind: the 7-day daily average of the same
   * metric (error_spike, traffic_drop, zero_events), or the day's
   * paper_marked_with_ai volume that count is a fraction of
   * (ai_quota_exhaustion).
   */
  baseline: number;
  /** Extra template context (e.g. topPaths for error_spike). */
  context?: Record<string, string>;
}

export type RawSignal = ContactSignal | AnalyticsAnomalySignal;

// --- Triage + delivery seams -----------------------------------------------------

/** The triage output (plan §5.1). Title ≤200 / body ≤4000 are guaranteed. */
export interface TriageResult {
  severity: AlertSeverity;
  title: string;
  body: string;
  suggestedActions: string[];
}

/** v1 is rule-based only (§9 Q4); deepseek arrives in v1.1 (§5.2). */
export interface TriageProvider {
  triage(signal: RawSignal): Promise<TriageResult>;
}

/**
 * Alert delivery seam — S3 implements the Resend sender (plan §6.1). S2 wires
 * a log-only no-op (deps.ts) so the handler is complete and testable; delivery
 * is best-effort: a failure is logged and never fails the run (§6.1/§11).
 */
export interface AlertDelivery {
  deliver(alert: Alert): Promise<void>;
}

// --- Storage interface -----------------------------------------------------------

/**
 * The bot's storage contract: alert create/dedup on octav-support-alerts plus
 * the read-only source polls (octav-contact, octav-analytics-events). NO write
 * access to any source table — the bot is a read-only monitor (§7 IAM).
 * The session-validation subset the HTTP features carry is deliberately
 * absent: the bot never resolves a session (contact attribution happens at
 * ingest — the message row already carries userId).
 */
export interface SupportBotStorage {
  /** The §7 dedup check — GetItem by alertId (=== dedupKey). */
  getAlert(alertId: string): Promise<Alert | null>;
  /**
   * Conditional create/re-open: the write lands only when no alert with this
   * id exists OR the existing one is status "resolved" (re-open). Returns true
   * when the write landed, false when an unresolved alert already exists
   * (dedup hit / concurrent loser).
   */
  putAlert(alert: Alert): Promise<boolean>;
  /** All octav-contact messages with status "new" (filtered Scan — see the adapter note). */
  listNewContactMessages(): Promise<ContactMessage[]>;
  /**
   * Raw aggregate rows (k="agg") whose sort-key date is within
   * [fromDate, toDate] (inclusive, UTC "YYYY-MM-DD") — the same BETWEEN query
   * the analytics-report adapter issues.
   */
  getAggregatesBetween(
    fromDate: string,
    toDate: string
  ): Promise<Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>>;
  /** CI smoke probe: GetItem on a key that never exists. The dummy resolves immediately. */
  probeSupportAlertsTable(): Promise<void>;
}

// --- Pure helpers (shared by BOTH storage implementations + the handler) --------

/** `contact:{messageId}` — one alert per message, ever (§4). */
export function contactDedupKey(messageId: string): string {
  return `contact:${messageId}`;
}

/**
 * `analytics:{kind}:{YYYY-MM-DD}` — one alert per anomaly kind per SUBJECT
 * day (the day the anomaly was detected on), NOT per poll hour: aggregates
 * are day-keyed, so an hour bucket would re-alert hourly for the same anomaly.
 */
export function analyticsDedupKey(kind: AnalyticsAnomalyKind, subjectDate: string): string {
  return `analytics:${kind}:${subjectDate}`;
}

/** TTL for an alert row (epoch seconds): now + 90 days (§9 Q5). */
export function supportAlertTtl(nowMs: number): number {
  return Math.floor(nowMs / 1000) + SUPPORT_ALERT_TTL_DAYS * 86_400;
}

/** Clamp a triage title to ALERT_TITLE_MAX (the §4 column budget). */
export function truncateAlertTitle(title: string): string {
  return title.length > ALERT_TITLE_MAX ? `${title.slice(0, ALERT_TITLE_MAX - 1)}…` : title;
}

/** Clamp a triage body to ALERT_BODY_MAX (the §4 column budget). */
export function truncateAlertBody(body: string): string {
  return body.length > ALERT_BODY_MAX ? `${body.slice(0, ALERT_BODY_MAX - 1)}…` : body;
}
