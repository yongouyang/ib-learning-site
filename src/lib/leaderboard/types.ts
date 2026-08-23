import type { SessionRecord, Stage, UserRecord } from '../auth/types';

// Phase D — leaderboard pure core (docs/leaderboard-plan.md §4–§6).
// Everything in this module is PURE and unit-tested; both the dummy and the
// DynamoDB storage implementations (D2) and the read handler (D3) build on
// these helpers so they can never diverge on week math or ranking (the
// parity lesson from analytics buildSummary).
//
// Data model (plan §5): table octav-leaderboard, one row per
// (profile, scope, week):
//   PK scopeWeek  "<scope>#<weekKey>#<cohortId>"   (cohortId is "open" in MVP;
//                                                  always present so cohorts
//                                                  arrive without a key change)
//   SK entry      "<profileId>"
// Daily-cap and diminishing-repeat state live in octav-rate-limits buckets
// (xpday: / xp-topic:), NOT here — see plan §4.1.

// --- Scopes --------------------------------------------------------------------

export type LeaderboardScope = 'stage:ks3' | 'stage:igcse' | 'stage:dp' | 'global';
export const LEADERBOARD_SCOPES: readonly LeaderboardScope[] = [
  'stage:ks3',
  'stage:igcse',
  'stage:dp',
  'global',
];

export function isLeaderboardScope(v: string): v is LeaderboardScope {
  return (LEADERBOARD_SCOPES as readonly string[]).includes(v);
}

/** The board a profile competes on (plan §4.2 — stage-only MVP). */
export function stageScope(stage: Stage): LeaderboardScope {
  return `stage:${stage}`;
}

/** MVP cohort (plan §4.4): one shared board per scope until cohort density exists. */
export const OPEN_COHORT = 'open';

// --- Board geometry --------------------------------------------------------------

export const LEADERBOARD_TOP_N = 100;
/** Caller's window: 2 above / self / 2 below (plan §6). */
export const NEIGHBOURHOOD_RADIUS = 2;
/** Daily soft cap per profile (plan §4.1): beyond this, work still records progress but earns no XP. */
export const LEADERBOARD_DAILY_XP_CAP = 500;
/** Last week's board stays readable 7 days after reset; TTL = week end + 14d (plan §4.5/§5). */
export const LEADERBOARD_TTL_DAYS_AFTER_WEEK_END = 14;

// --- Week math (ISO-8601 weeks, UTC; plan §4.5) -----------------------------------

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * ISO week key for an epoch-ms instant: "2026-W35". Week 1 is the week
 * containing the first Thursday of the year; weeks start Monday 00:00 UTC.
 */
export function weekKeyFor(ms: number): string {
  const d = new Date(ms);
  // Shift to the Thursday of this week — its year is the ISO week-year.
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(ms + (3 - dayNum) * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const week1Monday = week1MondayMs(isoYear);
  const week = Math.floor((mondayOfMs(ms) - week1Monday) / WEEK_MS) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Monday 00:00 UTC of the week containing `ms`. */
function mondayOfMs(ms: number): number {
  const d = new Date(ms);
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayNum * DAY_MS;
}

/** Monday 00:00 UTC of ISO week 1 of `isoYear` (the week containing Jan 4). */
function week1MondayMs(isoYear: number): number {
  const jan4 = Date.UTC(isoYear, 0, 4);
  const dayNum = (new Date(jan4).getUTCDay() + 6) % 7;
  return jan4 - dayNum * DAY_MS;
}

export const WEEK_KEY_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

export function isWeekKey(v: string): boolean {
  return WEEK_KEY_RE.test(v) && !Number.isNaN(weekStartMs(v));
}

/** Monday 00:00 UTC of the given week key. NaN for malformed keys. */
export function weekStartMs(weekKey: string): number {
  const m = WEEK_KEY_RE.exec(weekKey);
  if (!m) return NaN;
  const isoYear = Number(weekKey.slice(0, 4));
  const week = Number(weekKey.slice(6, 8));
  const start = week1MondayMs(isoYear) + (week - 1) * WEEK_MS;
  // Reject impossible weeks (e.g. "2026-W53" in a 52-week year): the computed
  // Monday must round-trip to the same key.
  return weekKeyFor(start) === weekKey ? start : NaN;
}

/** Next reset instant (Monday 00:00 UTC) for the given week key. */
export function weekEndMs(weekKey: string): number {
  return weekStartMs(weekKey) + WEEK_MS;
}

export function prevWeekKey(weekKey: string): string {
  return weekKeyFor(weekStartMs(weekKey) - 1);
}

/** DynamoDB TTL (epoch seconds): week end + 14 days (plan §5). */
export function weekTtlEpochSeconds(weekKey: string): number {
  return Math.floor((weekEndMs(weekKey) + LEADERBOARD_TTL_DAYS_AFTER_WEEK_END * DAY_MS) / 1000);
}

// --- Key helpers -------------------------------------------------------------------

/** PK: "<scope>#<weekKey>#<cohortId>" — cohortId always present ("open" in MVP). */
export function scopeWeekPartitionKey(scope: LeaderboardScope, weekKey: string, cohortId: string = OPEN_COHORT): string {
  return `${scope}#${weekKey}#${cohortId}`;
}

/** octav-rate-limits daily-cap bucket: "xpday:<profileId>:<YYYY-MM-DD>" (TTL ~2d). */
export function xpDayBucketKey(profileId: string, dateUtc: string): string {
  return `xpday:${profileId}:${dateUtc}`;
}

/** octav-rate-limits repeat-counter bucket: "xp-topic:<profileId>:<topicId>:<weekKey>" (TTL ~10d). */
export function xpTopicBucketKey(profileId: string, topicId: string, weekKey: string): string {
  return `xp-topic:${profileId}:${topicId}:${weekKey}`;
}

// The date/weekKey is IN the bucket key, so the counters reset by keying; the
// TTLs are cleanup only (the aimark: precedent — feedback/types.ts).
export const XP_DAY_BUCKET_TTL_SECONDS = 2 * 24 * 60 * 60; // ~2 days
export const XP_TOPIC_BUCKET_TTL_SECONDS = 10 * 24 * 60 * 60; // ~10 days

// --- Storage item (plan §5) ---------------------------------------------------------

export interface LeaderboardEntryItem {
  scopeWeek: string; // PK — scopeWeekPartitionKey()
  entry: string; // SK — profileId
  userId: string; // owner — erasure deletes via the user-index GSI
  handle: string;
  xp: number; // atomic ADD target
  lastEarnedAt: string; // ISO
  cohortId: string; // "open" in MVP
  expiresAt: number; // epoch seconds — weekTtlEpochSeconds(weekKey)
}

// --- Ranking (pure — shared by both storage implementations) -------------------------

export interface RankedEntry {
  rank: number; // 1-based
  entry: string; // profileId
  handle: string;
  xp: number;
}

export interface RankedBoard {
  /** Top LEADERBOARD_TOP_N entries. */
  top: RankedEntry[];
  /** The caller's row, or null when the caller has no entry this week. */
  self: RankedEntry | null;
  /**
   * 2 above / self / 2 below (may overlap `top` — the client renders both
   * sections and the overlap is intentional). Empty when self is absent.
   */
  neighbourhood: RankedEntry[];
  totalEntries: number;
}

/**
 * Sort a board partition into ranks and extract top-N + the caller's
 * neighbourhood. Ordering: xp desc, then earlier lastEarnedAt (first to a
 * score ranks above a later tie), then handle asc for full determinism.
 */
export function rankBoard(
  entries: Array<Pick<LeaderboardEntryItem, 'entry' | 'handle' | 'xp' | 'lastEarnedAt'>>,
  selfProfileId: string | null,
): RankedBoard {
  const sorted = [...entries].sort(
    (a, b) => b.xp - a.xp || a.lastEarnedAt.localeCompare(b.lastEarnedAt) || a.handle.localeCompare(b.handle),
  );
  const ranked: RankedEntry[] = sorted.map((e, i) => ({
    rank: i + 1,
    entry: e.entry,
    handle: e.handle,
    xp: e.xp,
  }));

  const selfIndex = selfProfileId === null ? -1 : ranked.findIndex((r) => r.entry === selfProfileId);
  const self = selfIndex === -1 ? null : ranked[selfIndex];
  const neighbourhood =
    selfIndex === -1
      ? []
      : ranked.slice(
          Math.max(0, selfIndex - NEIGHBOURHOOD_RADIUS),
          selfIndex + NEIGHBOURHOOD_RADIUS + 1,
        );

  return {
    top: ranked.slice(0, LEADERBOARD_TOP_N),
    self,
    neighbourhood,
    totalEntries: ranked.length,
  };
}

// --- D3 response shapes (client-facing — the wire contract) -------------------

/**
 * A client-facing board row. The storage-level `entry` field (the profileId)
 * is NEVER exposed to clients (plan §8: handle + number only) — rankBoard's
 * RankedEntry is mapped through toLeaderboardRow before it leaves the handler.
 */
export interface LeaderboardRow {
  rank: number; // 1-based
  handle: string;
  xp: number;
  isSelf: boolean; // true on the caller's own row (highlighting)
}

/** Strip a RankedEntry down to the client-safe row shape. */
export function toLeaderboardRow(entry: RankedEntry, selfProfileId: string): LeaderboardRow {
  return { rank: entry.rank, handle: entry.handle, xp: entry.xp, isSelf: entry.entry === selfProfileId };
}

/** GET /api/leaderboard response (plan §6). */
export interface LeaderboardBoardResponse {
  scope: LeaderboardScope;
  weekKey: string;
  week: 'current' | 'prev';
  /** ISO of the week end (the next Monday 00:00 UTC reset instant). */
  resetAt: string;
  top: LeaderboardRow[];
  /** 2 above / self / 2 below — empty when the caller has no row this week. */
  neighbourhood: LeaderboardRow[];
  /** The caller's own row, or null when absent from this board/week. */
  self: { rank: number; handle: string; xp: number } | null;
  totalEntries: number;
  profile: { profileId: string; optedIn: boolean } | null;
}

/** Public teaser row — no isSelf (there IS no self without a session). */
export interface LeaderboardTeaserRow {
  rank: number;
  handle: string;
  xp: number;
}

/** GET /api/leaderboard/teaser response (plan §6 — logged-out conversion card). */
export interface LeaderboardTeaserResponse {
  scope: LeaderboardScope;
  weekKey: string;
  /** Current week's top 3. */
  top: LeaderboardTeaserRow[];
}

// --- Storage interface (D2 — docs/leaderboard-plan.md §5/§6) ----------------------

/** Erasure GSI on octav-leaderboard (PK userId) — terraform lands in D7. */
export const LEADERBOARD_USER_INDEX = 'user-index';

/**
 * Storage the leaderboard needs (D2): the session-validation subset (one
 * source of truth: src/lib/auth/session.ts) plus the board ops. The DynamoDB
 * adapter composes DynamoSessionStorage for the session subset; the dummy
 * joins the SHARED in-memory auth→progress→analytics→feedback universe so a
 * dummy-OTP session resolves end-to-end in dev/e2e.
 *
 * Both implementations derive the scopeWeek partition key (with OPEN_COHORT),
 * cohortId, and expiresAt (weekTtlEpochSeconds) from the pure helpers above —
 * callers never pass them, so the dummy and the adapter can never diverge on
 * key/TTL math (the parity lesson from analytics buildSummary).
 */
export interface LeaderboardStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Atomic ADD of xp onto the (scope, week, profile) row — one UpdateCommand,
   * no read. handle/userId/cohortId/expiresAt are set-if-absent (first write
   * wins — a profile's handle is stable within the week); lastEarnedAt is
   * always overwritten. Callers never pass xp ≤ 0 (the D4 hook skips zero
   * awards); implementations ignore non-positive deltas.
   */
  addXp(args: {
    userId: string;
    profileId: string;
    handle: string;
    scope: LeaderboardScope;
    weekKey: string;
    xp: number;
    earnedAt: string;
  }): Promise<void>;

  /**
   * The full board partition for the open cohort (DynamoDB Query loops
   * LastEvaluatedKey — boards are tens-to-hundreds of items, plan §5). Not
   * ranked: ranking is rankBoard()'s job (pure, shared).
   */
  listBoard(scope: LeaderboardScope, weekKey: string): Promise<LeaderboardEntryItem[]>;

  /**
   * Erasure (plan §7/§8): delete ALL leaderboard rows for a user (account
   * deletion), optionally narrowed to one child profile (opt-out). DynamoDB:
   * paginated Query on the user-index GSI, then DeleteItem per matching row;
   * the dummy mirrors exactly.
   */
  deleteEntriesByUser(userId: string, profileId?: string): Promise<void>;

  /**
   * CI smoke probe (the progress/analytics _health pattern): an
   * unauthenticated, fixed-probe-key, Limit-1 Query that exercises the REAL
   * failure class (missing table / missing Query grant) with zero data
   * exposure. The dummy resolves immediately.
   */
  probeLeaderboardTable(): Promise<void>;
}
