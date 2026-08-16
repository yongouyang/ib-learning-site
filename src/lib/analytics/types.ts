import { z } from 'zod';
import type { SessionRecord, UserRecord } from '../auth/types';

// Phase A — analytics types (docs/phase-a-analytics-plan.md — the
// authoritative design). Single-table data model on octav-analytics-events
// (PK `k`, SK `s`):
//   k="ev"   s="<date>#<ts>#<uuid>"       raw event (TTL 90d)
//   k="agg"  s="<date>#<kind>#<key>"      daily aggregate counter (TTL 400d),
//                                         kind ∈ event|page|referrer|host
// The ingest rate budget reuses octav-rate-limits with the auth stack's
// fixed-window bucket pattern (window epoch in the key).
// Attribution is ANONYMOUS ONLY (locked decision 3): a per-tab sessionStorage
// session id, no userId, no fingerprint.

// --- Budgets / constants --------------------------------------------------------

export const ANALYTICS_MAX_STRING = 120;
export const ANALYTICS_MAX_URL = 2048;
export const ANALYTICS_MAX_BODY_BYTES = 4096;
export const ANALYTICS_MAX_UA = 80;
export const ANALYTICS_EVENTS_PER_WINDOW = 120;
export const ANALYTICS_WINDOW_SECONDS = 600; // 10 minutes
export const ANALYTICS_RAW_TTL_DAYS = 90;
export const ANALYTICS_AGG_TTL_DAYS = 400; // 12-month reporting + margin
export const ANALYTICS_ADMIN_DAYS = [7, 30, 90] as const;
export const ANALYTICS_TOP_PAGES = 20;
export const ANALYTICS_TOP_REFERRERS = 10;

// The §5.3 taxonomy (architecture-evolution-plan.md) — locked decision 2:
// the full event set, one enum.
export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'quiz_started',
  'quiz_completed',
  'flashcard_session_started',
  'flashcard_session_completed',
  'diagnostic_started',
  'diagnostic_completed',
  'exam_started',
  'exam_completed',
  'paper_marked_with_ai',
  'cta_clicked',
  'search_performed',
  'auth_otp_requested',
  'auth_login_completed',
  'auth_logout',
  'pwa_installed',
  'pwa_offline_banner_shown',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsAggregateKind = 'event' | 'page' | 'referrer' | 'host';
export const ANALYTICS_AGGREGATE_KINDS: AnalyticsAggregateKind[] = ['event', 'page', 'referrer', 'host'];

// --- Wire schema (POST /api/analytics/event) ------------------------------------

// Client clocks are untrusted: a far-future clientTs would bucket events into
// a future date forever. Allow 24h of skew, reject the rest (same guard as the
// progress payload dates).
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const clientTs = () =>
  z.iso.datetime().refine((d) => new Date(d).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS, {
    message: 'clientTs is too far in the future',
  });

// Charset-restricted identifiers (subjectId/topicId/courseId/paperId): same
// rule as the progress payload ids.
const idField = () => z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(64);

const boundedString = (max = ANALYTICS_MAX_STRING) => z.string().min(1).max(max);
const boundedCount = (max: number) => z.number().int().min(0).max(max);

// Per-name props from architecture-evolution-plan.md §5.3, bounded: strings
// ≤120 chars, counts sane-capped, no free-form PII-shaped fields.
// auth_otp_requested carries the email DOMAIN only — a full address ('@')
// is rejected so an email can never leak through analytics.
const perNameProps: Record<AnalyticsEventName, z.ZodTypeAny> = {
  page_view: z.object({}),
  quiz_started: z.object({
    subjectId: idField(),
    topicId: idField(),
    source: z.enum(['topic_page', 'diagnostic', 'mixed_review', 'ladder']),
  }),
  quiz_completed: z.object({
    subjectId: idField(),
    topicId: idField(),
    correctCount: boundedCount(500),
    totalCount: boundedCount(500),
    durationSeconds: boundedCount(86_400),
  }),
  flashcard_session_started: z.object({
    subjectId: idField(),
    topicId: idField(),
    filter: z.enum(['all', 'learning', 'due']),
  }),
  flashcard_session_completed: z.object({
    subjectId: idField(),
    topicId: idField(),
    cardsReviewed: boundedCount(10_000),
    knownCount: boundedCount(10_000),
    learningCount: boundedCount(10_000),
  }),
  diagnostic_started: z.object({ courseId: idField() }),
  diagnostic_completed: z.object({
    courseId: idField(),
    topicCount: boundedCount(1_000),
    weakAreaCount: boundedCount(1_000),
  }),
  exam_started: z.object({ courseId: idField(), paperId: idField() }),
  exam_completed: z.object({
    courseId: idField(),
    paperId: idField(),
    correctCount: boundedCount(500),
    totalCount: boundedCount(500),
    secondsUsed: boundedCount(86_400),
    timedOut: z.boolean(),
  }),
  paper_marked_with_ai: z.object({
    courseId: idField(),
    paperId: idField(),
    questionCount: boundedCount(10_000),
    totalMarks: boundedCount(10_000),
  }),
  cta_clicked: z.object({ ctaId: boundedString() }),
  search_performed: z.object({ query: boundedString(), resultCount: boundedCount(10_000) }),
  auth_otp_requested: z.object({
    emailDomain: z.string().regex(/^[A-Za-z0-9.-]+$/).min(1).max(ANALYTICS_MAX_STRING),
  }),
  auth_login_completed: z.object({ role: z.enum(['parent', 'student']) }),
  auth_logout: z.object({}),
  pwa_installed: z.object({}),
  pwa_offline_banner_shown: z.object({}),
};

// Envelope fields shared by every branch. url is reduced to path-only
// server-side (before write); referrer is reduced to host-only or "direct".
const envelopeFields = {
  url: z.string().min(1).max(ANALYTICS_MAX_URL),
  referrer: z.string().max(ANALYTICS_MAX_URL).optional().default(''),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(64),
  clientTs: clientTs(),
};

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: Record<string, unknown>;
  url: string;
  referrer: string;
  sessionId: string;
  clientTs: string;
}

// Envelope + per-name props validation (zod v4's discriminatedUnion typing
// cannot express a programmatically-built 17-member tuple, so the props are
// validated in a superRefine against the per-name schemas above — the same
// outcome, one error message).
export const analyticsEventSchema: z.ZodType<AnalyticsEvent> = z
  .object({
    name: z.enum(ANALYTICS_EVENT_NAMES),
    props: z.record(z.string(), z.unknown()).optional().default({}),
    ...envelopeFields,
  })
  .superRefine((val, ctx) => {
    const result = perNameProps[val.name].safeParse(val.props);
    if (!result.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid props for event', path: ['props'] });
    }
  }) as unknown as z.ZodType<AnalyticsEvent>;

// --- Storage items --------------------------------------------------------------

/** Raw event row: k="ev", s="<date>#<ts>#<uuid>". */
export interface RawAnalyticsEventItem {
  k: 'ev';
  s: string;
  name: string;
  props: Record<string, unknown>;
  host: string;
  sessionId: string;
  ua: string; // truncated to ANALYTICS_MAX_UA
  expiresAt: number; // epoch seconds — DynamoDB TTL
}

/** Daily aggregate counter row: k="agg", s="<date>#<kind>#<key>". */
export interface AnalyticsAggregateItem {
  k: 'agg';
  s: string;
  count: number;
  expiresAt?: number; // epoch seconds — DynamoDB TTL
}

/**
 * The event shape storage receives — ALREADY normalized by the handler
 * (url → path-only, referrer → host-only or "direct", host from the request,
 * ua truncated). The date bucketing derives from the client's `clientTs`.
 */
export interface NormalizedAnalyticsEvent {
  name: AnalyticsEventName;
  props: Record<string, unknown>;
  urlPath: string;
  referrer: string; // host-only or "direct"
  host: string;
  sessionId: string;
  ua: string;
  clientTs: string;
}

// --- Summary shape (GET /api/analytics/summary) ----------------------------------

export interface AnalyticsSummary {
  days: number;
  /** Per event name → per date (YYYY-MM-DD) → count. Sparse: only dates with events. */
  dailySeries: Record<string, Record<string, number>>;
  topPages: Array<{ path: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  totals: Record<string, number>;
  hosts: Record<string, number>;
}

// --- Storage interface ----------------------------------------------------------

// Session-validation subset (one source of truth: src/lib/auth/session.ts)
// plus the analytics ops. The dummy implements everything in one in-memory
// universe; the DynamoDB adapter delegates the session subset to
// DynamoSessionStorage.
export interface AnalyticsStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  /** One raw Put + one aggregate ADD per kind. */
  recordEvent(event: NormalizedAnalyticsEvent): Promise<void>;
  /**
   * Fixed-window ingest budget (octav-rate-limits): true = within budget,
   * false = limit reached for the current window.
   */
  incrementAnalyticsEventCount(ip: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Aggregates for the last `days` days (inclusive of today), folded into the summary shape. */
  getSummary(days: number): Promise<AnalyticsSummary>;
  /** CI smoke probe: unauthenticated Limit-1 Query. The dummy resolves immediately. */
  probeAnalyticsTable(): Promise<void>;
}

// --- Pure helpers (shared by BOTH storage implementations — the parity lesson) ---

/** The UTC date part of an ISO clientTs ("YYYY-MM-DD"). */
export function analyticsDateOf(clientTs: string): string {
  return clientTs.slice(0, 10);
}

/** UTC "YYYY-MM-DD" for an epoch-ms instant. */
export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** "<date>#<kind>#<key>" — keys never contain '#' (enum names, paths, hostnames). */
export function aggregateSortKey(date: string, kind: AnalyticsAggregateKind, key: string): string {
  return `${date}#${kind}#${key}`;
}

/** Split a sort key back into its parts (joins any stray '#' back into the key). */
export function parseAggregateKey(s: string): { date: string; kind: AnalyticsAggregateKind; key: string } {
  const [date, kind, ...keyParts] = s.split('#');
  return { date, kind: kind as AnalyticsAggregateKind, key: keyParts.join('#') };
}

/**
 * Fold aggregate rows into the summary response. PURE — both storage
 * implementations call it, so dummy and DynamoDB can never diverge on the
 * summary math. Filters to the `days` window server-side style (the DynamoDB
 * path pre-filters with BETWEEN; the dummy passes everything and lets this
 * filter — idempotent either way). Deterministic ordering for parity.
 */
export function buildSummary(
  aggregates: Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>,
  days: number,
  nowMs: number
): AnalyticsSummary {
  const today = utcDate(nowMs);
  const oldest = utcDate(nowMs - (days - 1) * 86_400_000);

  const dailySeries: Record<string, Record<string, number>> = {};
  const pages = new Map<string, number>();
  const referrers = new Map<string, number>();
  const hosts = new Map<string, number>();

  for (const agg of [...aggregates].sort((a, b) => a.s.localeCompare(b.s))) {
    const { date, kind, key } = parseAggregateKey(agg.s);
    if (date < oldest || date > today) continue; // outside the window (e.g. a future-dated clientTs)
    if (kind === 'event') {
      const byDate = dailySeries[key] ?? (dailySeries[key] = {});
      byDate[date] = (byDate[date] ?? 0) + agg.count;
    } else if (kind === 'page') {
      pages.set(key, (pages.get(key) ?? 0) + agg.count);
    } else if (kind === 'referrer') {
      referrers.set(key, (referrers.get(key) ?? 0) + agg.count);
    } else {
      hosts.set(key, (hosts.get(key) ?? 0) + agg.count);
    }
  }

  const totals: Record<string, number> = {};
  for (const [name, byDate] of Object.entries(dailySeries)) {
    totals[name] = Object.values(byDate).reduce((sum, n) => sum + n, 0);
  }

  const rank = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));

  return {
    days,
    dailySeries,
    topPages: rank(pages).slice(0, ANALYTICS_TOP_PAGES).map(({ key, count }) => ({ path: key, count })),
    topReferrers: rank(referrers)
      .slice(0, ANALYTICS_TOP_REFERRERS)
      .map(({ key, count }) => ({ referrer: key, count })),
    totals,
    hosts: Object.fromEntries([...hosts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}
