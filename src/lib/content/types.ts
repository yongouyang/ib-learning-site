import type { SessionRecord, UserRecord } from '../auth/types';
import type { MixedReviewQuestion } from '../mixed-review';

// Phase 1b — the content API (docs/premium-content-protection-plan.md §4/§5).
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

/** The premium paper payload: the whole paper, questions and mark schemes included. */
export interface PremiumPaperPayload {
  paper: unknown;
}
export interface MixedReviewPayload {
  questions: MixedReviewQuestion[];
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
   * Fixed-window per-IP budget (octav-rate-limits): true = within budget, false = limit reached for
   * the current window. Applied on ORIGIN MISSES only — CloudFront never invokes the function for a
   * cache hit, which is what makes the budget a harvest guard rather than a tax on normal users.
   */
  incrementContentRequestCount(ip: string, limit: number, windowSeconds: number): Promise<boolean>;
}

// --- Pure helpers (shared by BOTH storage implementations — the parity lesson) ---

/** The window epoch for an epoch-ms instant. */
export function contentWindowEpoch(nowMs: number, windowSeconds: number = CONTENT_PUBLIC_WINDOW_SECONDS): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

/** Bucket key `content:<ip>:<epoch>` (octav-rate-limits PK). */
export function contentRateLimitBucket(
  ip: string,
  nowMs: number,
  windowSeconds: number = CONTENT_PUBLIC_WINDOW_SECONDS,
): string {
  return `content:${ip}:${contentWindowEpoch(nowMs, windowSeconds)}`;
}
