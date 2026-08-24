import { resolveSession } from '../auth/session';
import type { ChildProfile } from '../auth/types';
import { getLeaderboardDeps } from './deps';
import type { LeaderboardDeps } from './deps';
import {
  isLeaderboardScope,
  prevWeekKey,
  rankBoard,
  stageScope,
  toLeaderboardRow,
  weekEndMs,
  weekKeyFor,
  type LeaderboardBoardResponse,
  type LeaderboardScope,
  type LeaderboardTeaserResponse,
} from './types';

// Phase D3 — framework-agnostic leaderboard handler (docs/leaderboard-plan.md
// §6). Single source of truth for the /api/leaderboard/* contract: the Next
// routes (dev/e2e) and the production Lambda (the fifth Lambda, behind the
// CloudFront /api/leaderboard/* behavior — D7) both delegate here, exactly
// like the progress/analytics handlers.
//
// Security model: the board endpoint requires a session (shared
// resolveSession — src/lib/auth/session.ts) and the profileId in the query is
// DATA, validated against the session user's childProfiles (the progress
// handler's IDOR rule). The teaser endpoint is PUBLIC by design (plan §6:
// handles are pseudonymous, so top-3 handle+xp leaks no PII) — it powers the
// logged-out conversion card. No write endpoints exist here: XP accrues
// inside the progress sync handler (D4, single-writer invariant).
//
// Privacy: LeaderboardEntryItem.entry (the profileId) NEVER leaves this
// module — rankBoard's RankedEntry rows are mapped through toLeaderboardRow
// (rank/handle/xp/isSelf only) before they enter a response body.

/** Every response is built here so Cache-Control: no-store is uniform. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

// Same 401 shape as the progress handler (session-cookie endpoints share it).
const NOT_AUTHENTICATED = () => json({ error: 'Not authenticated.' }, 401);

/**
 * GET /api/leaderboard?scope=stage:ks3|stage:igcse|stage:dp|global
 *                      &week=current|prev&profileId=<p>
 *
 * Session-gated. Defaults: week=current; profileId = the session user's FIRST
 * child profile (the solo-student case); scope = that profile's stage board
 * (stageScope(profile.stage)).
 */
export async function handleLeaderboardBoard(
  req: Request,
  deps: LeaderboardDeps = getLeaderboardDeps()
): Promise<Response> {
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return NOT_AUTHENTICATED();

  const url = new URL(req.url);

  const weekRaw = url.searchParams.get('week') ?? 'current';
  if (weekRaw !== 'current' && weekRaw !== 'prev') return json({ error: 'Invalid request' }, 400);

  // Rule 5 (the progress handler's rule): profileId is data — it must name
  // one of THIS user's child profiles; a foreign profileId (including another
  // account's) is the same generic 400 the progress sync returns.
  const profileIdRaw = url.searchParams.get('profileId');
  let profile: ChildProfile | undefined;
  if (profileIdRaw !== null) {
    profile = auth.user.childProfiles.find((p) => p.profileId === profileIdRaw);
  } else {
    profile = auth.user.childProfiles[0];
  }
  if (!profile) return json({ error: 'Invalid request' }, 400);

  const scopeRaw = url.searchParams.get('scope');
  if (scopeRaw !== null && !isLeaderboardScope(scopeRaw)) {
    return json({ error: 'Invalid request' }, 400);
  }
  const scope: LeaderboardScope = scopeRaw !== null ? scopeRaw : stageScope(profile.stage);

  // Week resolution happens on the SERVER clock (plan §4.1: the client never
  // picks the week key) — week=prev is "last week" relative to right now.
  const currentWeekKey = weekKeyFor(deps.clock());
  const weekKey = weekRaw === 'current' ? currentWeekKey : prevWeekKey(currentWeekKey);

  // Ranking is the pure, shared rankBoard (the dummy and the DynamoDB adapter
  // can never diverge on ordering); the entry/profileId is stripped by
  // toLeaderboardRow before anything leaves the handler.
  const board = rankBoard(await deps.storage.listBoard(scope, weekKey), profile.profileId);

  const body: LeaderboardBoardResponse = {
    scope,
    weekKey,
    week: weekRaw,
    resetAt: new Date(weekEndMs(weekKey)).toISOString(),
    top: board.top.map((e) => toLeaderboardRow(e, profile.profileId)),
    neighbourhood: board.neighbourhood.map((e) => toLeaderboardRow(e, profile.profileId)),
    self: board.self ? { rank: board.self.rank, handle: board.self.handle, xp: board.self.xp } : null,
    totalEntries: board.totalEntries,
    profile: { profileId: profile.profileId, optedIn: profile.leaderboardOptIn ?? false },
  };
  return withCookie(json(body), auth.refreshCookie);
}

/**
 * GET /api/leaderboard/teaser?scope=stage:ks3 — PUBLIC (no session): the
 * current week's top 3 (handle + xp only) for the logged-out conversion card
 * (plan §7).
 */
export async function handleLeaderboardTeaser(
  req: Request,
  deps: LeaderboardDeps = getLeaderboardDeps()
): Promise<Response> {
  const url = new URL(req.url);
  const scopeRaw = url.searchParams.get('scope') ?? 'stage:ks3';
  if (!isLeaderboardScope(scopeRaw)) return json({ error: 'Invalid request' }, 400);

  // DEVIATION from plan §6's "Limit 3 Query" sketch: DynamoDB can't sort a
  // Query by xp (a non-key attribute), so the teaser reads the board
  // partition and ranks in-memory exactly like the board endpoint, then
  // slices 3. Boards are tens-to-hundreds of items (plan §5), so this is the
  // same one-read cost either way.
  const weekKey = weekKeyFor(deps.clock());
  const board = rankBoard(await deps.storage.listBoard(scopeRaw, weekKey), null);

  const body: LeaderboardTeaserResponse = {
    scope: scopeRaw,
    weekKey,
    top: board.top.slice(0, 3).map((e) => ({ rank: e.rank, handle: e.handle, xp: e.xp })),
  };
  return json(body);
}

/** GET /api/leaderboard/_health — unauthenticated IAM probe (CI smoke). */
export async function handleLeaderboardHealth(
  _req: Request,
  deps: LeaderboardDeps = getLeaderboardDeps()
): Promise<Response> {
  // Limit-1 Query on a fixed probe key — exercises the real failure class
  // (missing table / missing Query grant) with zero data exposure. 200 = the
  // table AND the IAM grant work; anything else = 500.
  try {
    await deps.storage.probeLeaderboardTable();
    return json({ ok: true });
  } catch (err) {
    console.error('[leaderboard] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}
