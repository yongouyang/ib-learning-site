import type { AnalyticsAggregateItem } from '../analytics/types';
import { ALERT_SEVERITIES, type Alert, type AlertSeverity, type AlertStatus } from '../support-bot/types';

// Feature 1 — Daily Analytics Report (docs/supportability-features-plan.md).
// A scheduled (EventBridge) Lambda that emails the key analytics metrics once
// a day, mirroring the /admin/analytics dashboard — no login needed. It reads
// the SAME single-table data model as the dashboard: the daily aggregate rows
// (k="agg", s="<date>#<kind>#<key>") on octav-analytics-events, folded by the
// PURE buildReport below (the parity pattern — dummy and DynamoDB can never
// diverge on the math).
//
// Data-model honesty (deviations from the draft plan, recorded):
//   1. Aggregates are date-keyed, not hourly — "last 24h" is computed over the
//      calendar dates the window touches (today + yesterday, at most 2), not
//      an exact 24h slice. The email labels itself "last 24h · daily
//      aggregates" so the window semantics are visible.
//   2. Only the `host` aggregate kind is host-scoped (key = hostname). The
//      event/page/referrer aggregates mix dev + prod traffic, so the email
//      covers ALL hosts with a prominent Traffic split section (prod vs
//      dev.octavlearning.com) — the plan's "prod only" filter is impossible
//      from aggregates; the report highlights the prod share instead.
//   3. DAU / Subjects / Devices from the plan's content table need raw-event
//      props/ua/sessionId — not present in aggregates (and analytics is
//      anonymous by design). The email mirrors what the dashboard actually
//      shows: event totals, top pages, top referrers, traffic split.

export const ANALYTICS_REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ANALYTICS_REPORT_TOP_PAGES = 10;
export const ANALYTICS_REPORT_TOP_REFERRERS = 5;
/** Prod hostname whose share the report highlights (host aggregates only). */
export const ANALYTICS_REPORT_DEFAULT_HOST = 'octavlearning.com';

// --- S6: Open Alerts section (docs/support-bot-plan.md §9 Q9 — decided YES) ---
// The daily email gains an "Open Alerts" section: count by severity + the top
// N newest unresolved alerts. Read from octav-support-alerts via the optional
// OpenAlertsReader seam — wired only when SUPPORT_ALERTS_TABLE is set, so the
// feature is absent (not an error) in dev/dummy/e2e.

/** "Unresolved" per the report: open + acknowledged (resolved/muted are closed). */
export const UNRESOLVED_ALERT_STATUSES: readonly AlertStatus[] = ['open', 'acknowledged'];

/** How many of the newest unresolved alerts the email lists (plan: top 3). */
export const OPEN_ALERTS_TOP = 3;

/** The folded Open Alerts section — every value in the section derives from this. */
export interface OpenAlertsSummary {
  /** Total unresolved alerts (open + acknowledged). */
  total: number;
  /** Per-severity unresolved counts (all four severities, 0-filled). */
  bySeverity: Record<AlertSeverity, number>;
  /** The newest OPEN_ALERTS_TOP unresolved alerts, newest first. */
  top: Array<{ severity: AlertSeverity; title: string; age: string }>;
}

/**
 * Read-only seam over octav-support-alerts (S6). Wired from SUPPORT_ALERTS_TABLE
 * in deps.ts; when the env var is absent the section no-ops silently.
 */
export interface OpenAlertsReader {
  /** All alerts with status "open" or "acknowledged" (GSI1, newest-first). */
  listUnresolvedAlerts(): Promise<Array<Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'>>>;
}

/** Compact age label for the email: "5m" / "7h" / "3d" (never negative). */
export function formatAlertAge(ageMs: number): string {
  const mins = Math.max(0, Math.floor(ageMs / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Fold alert rows into the Open Alerts section. PURE (the buildReport
 * discipline): it filters to the unresolved statuses itself, so an adapter
 * handing it extra rows and one pre-filtering by GSI can never diverge.
 */
export function buildOpenAlertsSummary(
  alerts: Array<Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'>>,
  opts: { nowMs: number; top?: number }
): OpenAlertsSummary {
  const top = opts.top ?? OPEN_ALERTS_TOP;
  const unresolved = alerts
    .filter((a) => UNRESOLVED_ALERT_STATUSES.includes(a.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title));

  const bySeverity = Object.fromEntries(ALERT_SEVERITIES.map((s) => [s, 0])) as Record<AlertSeverity, number>;
  for (const a of unresolved) bySeverity[a.severity] += 1;

  return {
    total: unresolved.length,
    bySeverity,
    top: unresolved.slice(0, top).map((a) => ({
      severity: a.severity,
      title: a.title,
      age: formatAlertAge(opts.nowMs - Date.parse(a.createdAt)),
    })),
  };
}

/** Human-readable event labels for the email (mirrors the dashboard's map). */
export const ANALYTICS_REPORT_EVENT_LABELS: Record<string, string> = {
  page_view: 'Page views',
  quiz_started: 'Quizzes started',
  quiz_completed: 'Quizzes completed',
  flashcard_session_started: 'Flashcard sessions started',
  flashcard_session_completed: 'Flashcard sessions completed',
  diagnostic_started: 'Diagnostics started',
  diagnostic_completed: 'Diagnostics completed',
  exam_started: 'Exams started',
  exam_completed: 'Exams completed',
  paper_marked_with_ai: 'Papers marked with AI',
  cta_clicked: 'CTA clicks',
  search_performed: 'Searches',
  auth_otp_requested: 'Sign-in codes requested',
  auth_login_completed: 'Sign-ins',
  auth_logout: 'Sign-outs',
  pwa_installed: 'PWA installs',
  pwa_offline_banner_shown: 'Offline banners shown',
  leaderboard_viewed: 'Leaderboard views',
  leaderboard_membership_changed: 'Leaderboard joins/leaves',
};

/** The folded report — every number in the email derives from this. */
export interface AnalyticsReportData {
  /** ISO instant the report was generated. */
  generatedAt: string;
  /** UTC "YYYY-MM-DD" of the oldest calendar day in the window. */
  fromDate: string;
  /** UTC "YYYY-MM-DD" of the newest calendar day in the window (today). */
  toDate: string;
  /** Per event name → count (all hosts; aggregates are not host-scoped). */
  totals: Record<string, number>;
  /** Top 10 paths by page_view (ANALYTICS_REPORT_TOP_PAGES). */
  topPages: Array<{ path: string; count: number }>;
  /** Top 5 referrers (ANALYTICS_REPORT_TOP_REFERRERS). */
  topReferrers: Array<{ referrer: string; count: number }>;
  /** Per hostname → total events (host aggregate kind). */
  hosts: Record<string, number>;
  /** Events attributed to the prod host (hosts[hostFilter] ?? 0). */
  prodEvents: number;
  /** Sum of ALL host aggregates = total events across every host. */
  totalEvents: number;
}

/** Storage the report needs — the aggregate BETWEEN query only. */
export interface AnalyticsReportStorage {
  /**
   * Raw aggregate rows whose sort-key date is within [fromDate, toDate]
   * (inclusive, UTC "YYYY-MM-DD"). The DynamoDB adapter pre-filters with a
   * BETWEEN; the dummy returns everything and the PURE builder filters — the
   * buildSummary lesson, idempotent either way.
   */
  getAggregatesBetween(fromDate: string, toDate: string): Promise<Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>>;
}

/** Email delivery seam — the report never calls Resend directly. */
export interface ReportEmailSender {
  send(args: { to: string[]; subject: string; html: string; text: string }): Promise<void>;
}

/** UTC "YYYY-MM-DD" for an epoch-ms instant (re-export of the analytics helper). */
export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fold aggregate rows into the report. PURE — both storage implementations
 * hand their rows to this, so dummy and DynamoDB can never diverge on the
 * report math. Deterministic ordering for parity (same discipline as
 * buildSummary in src/lib/analytics/types.ts).
 */
export function buildReport(
  aggregates: Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>,
  opts: { fromDate: string; toDate: string; host: string; nowMs: number; topPages?: number; topReferrers?: number }
): AnalyticsReportData {
  const { fromDate, toDate, host, nowMs } = opts;
  const topPages = opts.topPages ?? ANALYTICS_REPORT_TOP_PAGES;
  const topReferrers = opts.topReferrers ?? ANALYTICS_REPORT_TOP_REFERRERS;

  const totals: Record<string, number> = {};
  const pages = new Map<string, number>();
  const referrers = new Map<string, number>();
  const hosts = new Map<string, number>();

  for (const agg of [...aggregates].sort((a, b) => a.s.localeCompare(b.s))) {
    const [date, kind, ...keyParts] = agg.s.split('#');
    const key = keyParts.join('#'); // joins any stray '#' back into the key
    if (date < fromDate || date > toDate) continue; // outside the window
    if (kind === 'event') {
      totals[key] = (totals[key] ?? 0) + agg.count;
    } else if (kind === 'page') {
      pages.set(key, (pages.get(key) ?? 0) + agg.count);
    } else if (kind === 'referrer') {
      referrers.set(key, (referrers.get(key) ?? 0) + agg.count);
    } else if (kind === 'host') {
      hosts.set(key, (hosts.get(key) ?? 0) + agg.count);
    }
  }

  const rank = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));

  const hostRows = rank(hosts);
  const prodEvents = hosts.get(host) ?? 0;
  const totalEvents = hostRows.reduce((sum, { count }) => sum + count, 0);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    fromDate,
    toDate,
    totals,
    topPages: rank(pages)
      .slice(0, topPages)
      .map(({ key, count }) => ({ path: key, count })),
    topReferrers: rank(referrers)
      .slice(0, topReferrers)
      .map(({ key, count }) => ({ referrer: key, count })),
    hosts: Object.fromEntries(hostRows.map(({ key, count }) => [key, count])),
    prodEvents,
    totalEvents,
  };
}
