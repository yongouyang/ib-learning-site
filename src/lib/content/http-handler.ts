import { resolveSession } from '../auth/session';
import { featuresForTier } from '../entitlements/features';
import { isFreePaperSet } from '../entitlements/exam-access';
import { getPaperContent } from '@/content/registry.papers';
import { getAllContentTopics } from '@/content/registry.content';
import { drawMixedReviewQuestions } from '../mixed-review-draw';
import { getContentDeps, type ContentDeps } from './deps';
import {
  CONTENT_HEALTH_PATH,
  CONTENT_PREMIUM_REQUESTS_PER_WINDOW,
  CONTENT_PREMIUM_ANOMALY_THRESHOLD,
  CONTENT_PREMIUM_WINDOW_SECONDS,
  CONTENT_PRIVATE_CACHE_CONTROL,
  CONTENT_PUBLIC_CACHE_CONTROL,
  CONTENT_PUBLIC_REQUESTS_PER_WINDOW,
  CONTENT_PUBLIC_WINDOW_SECONDS,
  accountRef,
  contentAccountScope,
  contentIpScope,
  contentWindowResetAt,
  maskEmail,
  parseMixedReviewPath,
  parsePremiumPaperPath,
  type PremiumPaperPayload,
} from './types';

// Phase 1b — the content API (docs/premium-content-protection-plan.md §4). Framework-agnostic single
// source of truth: the Next catch-all route (src/app/api/content/[...slug]/route.ts, the dev/e2e
// path) and the production Lambda (lambda/content, behind the /api/content/* CloudFront behaviors)
// both delegate here, exactly like the contact/leaderboard handlers.
//
// WHY THIS EXISTS: premium paper sets used to be prerendered static pages, so anyone who guessed
// /papers/<course>/<course>-set-2 could read every mark scheme with no session. They are now served
// from here: `exam-sets-full` + a resolved session, `private, no-store`. The public route carries
// only free content (topic questions), which is why the edge may cache it.
//
// THE ONE MISTAKE THAT WOULD LEAK PAID CONTENT SITE-WIDE (plan §6.1): a premium response sharing the
// public route's cache policy. CloudFront would then serve a mark scheme to anonymous viewers FROM
// CACHE. The two prefixes are separate CloudFront behaviors with separate cache policies, the
// premium response is `private, no-store`, and tests/unit/content-iam.test.ts pins the ordering.
//
// Phase 2 (plan §5) added the second half of goal 1(b) — a subscriber's bulk pull is now THROTTLED
// (a per-account fixed-window budget, charged only on a delivery that actually happens) and
// ATTRIBUTABLE (one structured warning per account per window at a threshold below the budget, so a
// sweep is visible while it is happening). The data policy needed no new grant: both scopes are the
// same conditional UpdateCommand on octav-rate-limits.

/** Every response carries an explicit cache policy — there is no default here on purpose. */
function json(body: unknown, status: number, cacheControl: string): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', cacheControl);
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return 'local';
  const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
  // CloudFront APPENDS the real viewer IP to any client-supplied XFF, so the LAST entry is the
  // trusted value; earlier entries are client-controlled (the analytics/contact rule).
  return parts[parts.length - 1] ?? 'local';
}

/**
 * GET /api/content/_health — unauthenticated CI smoke probe. Asserts `topicCount > 0`, which is what
 * catches an esbuild that silently dropped the bundled JSON (a DynamoDB-style probe would not: the
 * content is in the bundle, not in a table). The body also carries `"ok":true`, so the probe stays
 * path-discriminating — the /api/* catch-all (feedback Lambda) answers `{"configured":true}` for any
 * unclaimed path, and only a body field the wrong Lambda cannot produce proves the routing.
 */
export function handleContentHealth(deps: ContentDeps = getContentDeps()): Response {
  void deps;
  const topicCount = getAllContentTopics().length;
  if (topicCount === 0) {
    console.error('[content] health probe failed: the bundled content is empty');
    return json({ ok: false, topicCount }, 500, CONTENT_PRIVATE_CACHE_CONTROL);
  }
  return json({ ok: true, topicCount }, 200, CONTENT_PRIVATE_CACHE_CONTROL);
}

/** GET /api/content/premium/papers/<courseId>/<setId> — session + exam-sets-full. */
export async function handlePremiumPaperGet(
  req: Request,
  deps: ContentDeps = getContentDeps(),
  ids: { courseId: string; setId: string }
): Promise<Response> {
  // Session first: an anonymous crawler gets 401 and never reaches the entitlement check, which is
  // what closes the URL-guessing hole this API exists for.
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return json({ error: 'login_required' }, 401, CONTENT_PRIVATE_CACHE_CONTROL);

  if (!featuresForTier(auth.user.tier).includes('exam-sets-full')) {
    return json({ error: 'not_entitled' }, 403, CONTENT_PRIVATE_CACHE_CONTROL);
  }

  const paper = getPaperContent(ids.courseId, ids.setId);
  if (!paper) return json({ error: 'not_found' }, 404, CONTENT_PRIVATE_CACHE_CONTROL);

  // Phase 2 budget, charged AFTER the lookup on purpose: a repeated 404 or a typo'd set id must not
  // spend a student's window, and this is the first point at which a real delivery is certain.
  // Keyed by account, not IP — a paid puller is authenticated, so the IP is what they can rotate.
  const userId = auth.user.userId;
  const budget = await deps.storage.incrementContentRequestCount(
    contentAccountScope(userId),
    CONTENT_PREMIUM_REQUESTS_PER_WINDOW,
    CONTENT_PREMIUM_WINDOW_SECONDS
  );
  if (!budget.allowed) {
    console.warn(
      `[content] premium budget exhausted — userId=${userId} course=${ids.courseId} setId=${ids.setId} ` +
        `count=${budget.count}/${CONTENT_PREMIUM_REQUESTS_PER_WINDOW}`
    );
    // `resetAt` + the slid session cookie, exactly like the AI-mark quota's 429 (src/lib/feedback):
    // the user IS authenticated and legitimately active, so their session must not appear to lapse.
    return withCookie(
      json(
        { error: 'quota_exceeded', resetAt: contentWindowResetAt(deps.clock(), CONTENT_PREMIUM_WINDOW_SECONDS) },
        429,
        CONTENT_PRIVATE_CACHE_CONTROL
      ),
      auth.refreshCookie
    );
  }

  if (budget.count === CONTENT_PREMIUM_ANOMALY_THRESHOLD) {
    // Fires exactly once per account per window: the counter is incremented atomically, so only one
    // request can observe this value.
    //
    // ponytail: this counts REQUESTS in the window, not distinct sets. The premium corpus is 15 sets,
    // so a complete sweep is 15 requests — read this line as "this account crossed N premium
    // deliveries this hour", not "it swept the corpus". Storing the requested set ids per window
    // would be the upgrade if an incident ever needs the stronger claim.
    console.warn(
      `[content] premium anomaly — userId=${userId} count=${budget.count}/` +
        `${CONTENT_PREMIUM_REQUESTS_PER_WINDOW} threshold=${CONTENT_PREMIUM_ANOMALY_THRESHOLD} setId=${ids.setId}`
    );
  }

  // Phase 2's leak-tracing marker, for PREMIUM sets only. Set 1 is free and public — its page is
  // prerendered and never reaches this route in the UI — so stamping it would put an account
  // identifier on content that is not the paid asset, and would widen what the notice has to describe.
  const payload: PremiumPaperPayload = { paper };
  if (!isFreePaperSet(ids.setId)) {
    payload.attribution = {
      issuedTo: maskEmail(auth.user.email),
      ref: accountRef(userId),
      issuedAt: new Date(deps.clock()).toISOString(),
    };
  }

  const res = json(payload, 200, CONTENT_PRIVATE_CACHE_CONTROL);
  // Slide the session TTL exactly like every other authenticated handler (one shared resolution path).
  return withCookie(res, auth.refreshCookie);
}

/**
 * GET /api/content/public/mixed-review/<seed>[/<topicIds>] — PUBLIC and edge-cached.
 *
 * Free content only, which is why caching a shared copy is safe (no personalisation, no cookies in
 * the response). The per-IP budget runs on origin misses only: CloudFront never invokes the function
 * for a cache hit, so normal users are never throttled while a first-seen bulk harvest is.
 */
export async function handlePublicMixedReviewGet(
  req: Request,
  deps: ContentDeps = getContentDeps(),
  input: { seed: string; topicIds: string[] | null }
): Promise<Response> {
  const budget = await deps.storage.incrementContentRequestCount(
    contentIpScope(clientIp(req)),
    CONTENT_PUBLIC_REQUESTS_PER_WINDOW,
    CONTENT_PUBLIC_WINDOW_SECONDS
  );
  if (!budget.allowed) {
    console.warn('[content] public mixed-review budget exhausted');
    return json({ error: 'quota_exceeded' }, 429, CONTENT_PRIVATE_CACHE_CONTROL);
  }

  const questions = drawMixedReviewQuestions({ topicIds: input.topicIds, seed: input.seed });
  if (questions.length === 0) {
    return json({ error: 'no_questions' }, 404, CONTENT_PRIVATE_CACHE_CONTROL);
  }

  return json({ questions }, 200, CONTENT_PUBLIC_CACHE_CONTROL);
}

/**
 * The whole GET surface as one router, so both entry points (Next route, Lambda adapter) stay thin
 * and the path parsing is tested once.
 */
export async function handleContentGet(
  req: Request,
  deps: ContentDeps = getContentDeps()
): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname === CONTENT_HEALTH_PATH) return handleContentHealth(deps);

  const premium = parsePremiumPaperPath(pathname);
  if (premium) return handlePremiumPaperGet(req, deps, premium);

  const mixed = parseMixedReviewPath(pathname);
  if (mixed) return handlePublicMixedReviewGet(req, deps, mixed);

  return json({ error: 'Not found' }, 404, CONTENT_PRIVATE_CACHE_CONTROL);
}
