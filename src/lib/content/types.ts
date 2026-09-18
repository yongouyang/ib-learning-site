import { createHash } from 'node:crypto';
import type { SessionRecord, UserRecord } from '../auth/types';
import type { MixedReviewQuestion } from '../mixed-review';

// Phase 1b — the content API (docs/premium-content-protection-plan.md §4/§5).
//
// SERVER-ONLY: this module holds the octav-rate-limits bucket keys and (from Phase 2) the leak-tracing
// marker, so it imports node:crypto. Client components may take `PremiumAttribution` as a TYPE only
// (`import type` is erased); a VALUE import from a `'use client'` file fails the build loudly rather
// than shipping something wrong — that is the boundary working, not a bug to work around.
//
// Two surfaces, deliberately separate (plan §6.1 — the cache-policy collision is the one mistake
// that would leak paid content site-wide, so they get different prefixes, different CloudFront
// behaviours and different cache policies):
//
//   /api/content/premium/papers/<courseId>/<setId>   session + exam-sets-full, private, no-store
//   /api/content/public/mixed-review/<seed>[/<ids>]  public, edge-cached, per-IP budget on misses
//   /api/content/_health                             unauthenticated probe (topicCount > 0)
//
// Content is bundled INTO the Lambda at build time (esbuild, like every other function), so a content
// deploy ships atomically with the code that serves it — no extra IAM, no cold-start fetch, no second
// source of truth. The handler therefore reads the generated content registries directly.

// --- Budgets / constants ---------------------------------------------------------

/** Public route: 60 draws per IP per hour — generous for a real user, useless as a bulk harvester. */
export const CONTENT_PUBLIC_REQUESTS_PER_WINDOW = 60;
export const CONTENT_PUBLIC_WINDOW_SECONDS = 3600;

/**
 * Premium route (Phase 2): 30 deliveries per ACCOUNT per hour.
 *
 * Be honest about what this buys (plan §8). The whole premium corpus is 15 sets, so an entitled
 * subscriber can pull all of it in 15 requests — no budget that leaves the product usable can stop
 * that, and the accepted residual is "an entitled subscriber can copy what they receive". What the
 * budget bounds is sustained RATE (a scripted puller looping the corpus, or one account rented out
 * to a group), and what makes an attempt visible is the anomaly log below. Keyed by account, not IP:
 * a paid puller is authenticated, so the IP is the one thing they can rotate.
 */
export const CONTENT_PREMIUM_REQUESTS_PER_WINDOW = 30;
export const CONTENT_PREMIUM_WINDOW_SECONDS = 3600;

/**
 * Emit an attributable warning once per account per window at this many premium deliveries. Set
 * BELOW the budget on purpose: a sweep should be visible while it is happening, not only once it has
 * been refused and the information is already lost.
 */
export const CONTENT_PREMIUM_ANOMALY_THRESHOLD = 10;

/** Cap on the weak-topic id list a client may send (keeps the URL well under any limit). */
export const CONTENT_MAX_TOPIC_IDS = 40;

export const CONTENT_PRIVATE_CACHE_CONTROL = 'private, no-store';
/**
 * Public content is free by design (plan §1.1 decision 10), so the edge MAY cache it: 5 minutes in
 * the browser, an hour at the edge. No `Vary: Cookie` — the response is never personalised, which is
 * exactly why sharing a cached copy between viewers is safe.
 */
export const CONTENT_PUBLIC_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

export const PREMIUM_PAPERS_PATH = '/api/content/premium/papers';
export const PUBLIC_MIXED_REVIEW_PATH = '/api/content/public/mixed-review';
export const CONTENT_HEALTH_PATH = '/api/content/_health';

// --- Path parsing (pure — shared by the Next route and the Lambda) ---------------

/** Topic ids and seeds become path segments, so both are strictly bounded and charset-checked. */
const TOPIC_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SEED_RE = /^[A-Za-z0-9_:.-]{1,80}$/;

/**
 * `/api/content/premium/papers/<courseId>/<setId>` → ids, or null when the path does not match (a
 * non-match must 404 rather than serve something adjacent).
 */
export function parsePremiumPaperPath(pathname: string): { courseId: string; setId: string } | null {
  if (!pathname.startsWith(`${PREMIUM_PAPERS_PATH}/`)) return null;
  const rest = pathname.slice(PREMIUM_PAPERS_PATH.length + 1);
  const parts = rest.split('/');
  if (parts.length !== 2) return null;
  const [courseId, setId] = parts;
  if (!TOPIC_ID_RE.test(courseId) || !TOPIC_ID_RE.test(setId)) return null;
  return { courseId, setId };
}

/**
 * `/api/content/public/mixed-review/<seed>` (all topics) or `/…/<seed>/<id,id,id>` (weak topics).
 * Returns null when the path does not match or carries unusable input.
 */
export function parseMixedReviewPath(
  pathname: string,
): { seed: string; topicIds: string[] | null } | null {
  if (!pathname.startsWith(`${PUBLIC_MIXED_REVIEW_PATH}/`)) return null;
  const parts = pathname.slice(PUBLIC_MIXED_REVIEW_PATH.length + 1).split('/');
  if (parts.length < 1 || parts.length > 2) return null;
  const [seed, ids] = parts;
  if (!SEED_RE.test(seed)) return null;
  if (ids === undefined) return { seed, topicIds: null };
  const topicIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
  if (topicIds.length === 0 || topicIds.length > CONTENT_MAX_TOPIC_IDS) return null;
  if (!topicIds.every((id) => TOPIC_ID_RE.test(id))) return null;
  return { seed, topicIds };
}

// --- Response payloads -----------------------------------------------------------

/**
 * Phase 2's leak-tracing marker (plan §5, decision 1(b)). Premium papers are issued with a note of the
 * account they went to, and the payload carries the same fact machine-readably. Three deliberate
 * choices, each of which a reviewer should be able to re-derive:
 *
 *  - `issuedTo` is MASKED (first character + domain). A screenshot must not hand the world a student's
 *    full address, and the mask plus the ref is still enough for us to name one account.
 *  - `ref` is a truncated hash of the userId, not the id itself: opaque inside a leak, and recomputable
 *    over `octav-users` to find its owner. It is a pointer, NOT a security control.
 *  - `issuedAt` is the delivery time, so a leaked copy's vintage is checkable against our logs.
 *
 * The honest ceiling, stated in the code because a marker invites over-claiming: a determined leaker
 * can crop the line, and any text marker can be edited. What this buys is attribution for the ordinary
 * case — a screenshot or a paste that was not scrubbed — plus the deterrence of being visible at all.
 * It does not make content un-copyable (plan §8).
 */
export interface PremiumAttribution {
  issuedTo: string;
  ref: string;
  issuedAt: string;
}

/** The premium paper payload: the whole paper, questions and mark schemes included. */
export interface PremiumPaperPayload {
  paper: unknown;
  /** Present for premium sets only — never on the free set 1 (see handlePremiumPaperGet). */
  attribution?: PremiumAttribution;
}
export interface MixedReviewPayload {
  questions: MixedReviewQuestion[];
}

/**
 * `m***@example.com` — first character, then the domain. Total by construction: it never throws, and it
 * degrades to a phrase rather than an empty string, because a missing email must not blank the line.
 */
export function maskEmail(email: string | undefined | null): string {
  const value = (email ?? '').trim();
  const at = value.indexOf('@');
  if (at <= 0 || at === value.length - 1) return 'your account';
  return `${value[0]}***@${value.slice(at + 1)}`;
}

/**
 * Opaque account reference for the marker: the first 10 hex digits of sha256(userId).
 *
 * Tracing a leaked copy means hashing every row of `octav-users` and looking for this value — an
 * instant at our size, and no lookup table to keep in sync. Storing issued markers instead would mean
 * a new table, new IAM and a new retention row to disclose, for no extra capability here.
 */
export function accountRef(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 10);
}

// --- Storage interface -----------------------------------------------------------

// Session-validation subset (one source of truth: src/lib/auth/session.ts) plus the public route's
// per-IP budget. There is NO content table: the content is bundled, and the only durable state this
// API touches lives in the shared auth tables and octav-rate-limits.
export interface ContentStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Fixed-window budget on octav-rate-limits, keyed by `scope` (`content:ip:<ip>` for the public
   * route, `content:acct:<userId>` for the premium one) plus the window epoch.
   *
   * The public scope sees ORIGIN MISSES only — CloudFront never invokes the function for a cache hit,
   * which is what makes it a harvest guard rather than a tax on normal users. The premium scope sees
   * every request, because premium responses are never cached at all.
   */
  incrementContentRequestCount(scope: string, limit: number, windowSeconds: number): Promise<ContentBudgetResult>;
}

/**
 * One fixed-window increment. `count` is the requests used in the window INCLUDING this one, which is
 * what lets the handler log a threshold crossing. The auth/analytics limiters return a bare boolean;
 * this one needs the count, so it returns it rather than paying for a second read. On refusal `count`
 * is the limit: the DynamoDB conditional update does not write, so the item stays exactly at the cap
 * (the dummy mirrors that).
 */
export interface ContentBudgetResult {
  allowed: boolean;
  count: number;
}

// --- Pure helpers (shared by BOTH storage implementations — the parity lesson) ---

/** Public route scope: the viewer's IP (CloudFront appends it — see clientIp() in the handler). */
export function contentIpScope(ip: string): string {
  return `content:ip:${ip}`;
}

/** Premium route scope: the account, so the budget follows a user across devices and IPs. */
export function contentAccountScope(userId: string): string {
  return `content:acct:${userId}`;
}

/** The window epoch for an epoch-ms instant. */
export function contentWindowEpoch(nowMs: number, windowSeconds: number = CONTENT_PUBLIC_WINDOW_SECONDS): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

/** Bucket key `<scope>:<epoch>` (octav-rate-limits PK), e.g. `content:ip:1.2.3.4:495113`. */
export function contentRateLimitBucket(
  scope: string,
  nowMs: number,
  windowSeconds: number = CONTENT_PUBLIC_WINDOW_SECONDS,
): string {
  return `${scope}:${contentWindowEpoch(nowMs, windowSeconds)}`;
}

/**
 * ISO timestamp at which the current window rolls — the 429 body's `resetAt`, same shape and same
 * reason as `aiMarkResetAt`: the client can say "try again at ..." instead of "try again later".
 */
export function contentWindowResetAt(
  nowMs: number,
  windowSeconds: number = CONTENT_PUBLIC_WINDOW_SECONDS,
): string {
  return new Date((contentWindowEpoch(nowMs, windowSeconds) + 1) * windowSeconds * 1000).toISOString();
}
