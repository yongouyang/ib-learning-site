import { resolveSession } from '../auth/session';
import {
  AI_MARK_PREMIUM_MONTHLY_CAP,
  aiMarkQuotaForTier,
  tierSchema,
} from '../entitlements/features';
import { getFeedbackDeps, type FeedbackDeps } from './deps';
import {
  getFeedbackProvider,
  isFeedbackConfigured,
  markRequestSchema,
  markResultSchema,
  marksFromPerPoint,
  FeedbackNotConfiguredError,
  type MarkResult,
} from './index';
import { aiMarkMonthKey, aiMarkResetAt } from './types';

// Phase 5 — framework-agnostic feedback handler. This is the single source of
// truth for the /api/feedback contract: the Next route handler
// (src/app/api/feedback/route.ts, dev/e2e path) and the production Lambda
// (lambda/feedback, behind the CloudFront /api/* behavior) both delegate here.
// Graceful degradation: 501 when unconfigured — the UI hides the
// "Mark with AI" button and students self-mark.
//
// Phase E2 (docs/entitlement-implementation-plan.md): AI marking is the first
// REAL enforcement — POST requires a session (401 login_required when
// anonymous) and a durable monthly quota (bucket aimark:<userId>:<YYYY-MM> in
// octav-rate-limits; 30/month free, 1000/month premium safety cap) checked
// BEFORE any LLM call, so an exhausted quota never spends money.

const RATE_PER_MIN = () => Number(process.env.FEEDBACK_RATE_LIMIT_PER_MIN ?? 10);
const RATE_PER_DAY = () => Number(process.env.FEEDBACK_RATE_LIMIT_PER_DAY ?? 50);

// Per-IP sliding windows, in-memory. NOTE: on serverless this is per-instance,
// not global — a first line against casual abuse, not a hard quota (see
// docs/phase-5-implementation-plan.md §3.5; Upstash is the follow-up).
const hits = new Map<string, { minute: number[]; day: number[] }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = hits.get(ip) ?? { minute: [], day: [] };
  entry.minute = entry.minute.filter((t) => now - t < 60_000);
  entry.day = entry.day.filter((t) => now - t < 86_400_000);
  hits.set(ip, entry);
  if (entry.minute.length >= RATE_PER_MIN() || entry.day.length >= RATE_PER_DAY()) {
    return true;
  }
  entry.minute.push(now);
  entry.day.push(now);
  return false;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'local';
}

/** Authenticated responses carry the session refresh cookie — never cacheable. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

/**
 * GET /api/feedback — `{ configured }` for everyone (the anonymous button-
 * visibility probe keeps its pre-E2 shape); a session adds the quota state
 * (`remaining`, `resetAt`) so the UI can render "N marks left this month"
 * without a wasted POST.
 */
export async function handleFeedbackGet(
  req: Request,
  deps: FeedbackDeps = getFeedbackDeps()
): Promise<Response> {
  const configured = isFeedbackConfigured();

  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return Response.json({ configured });

  const monthKey = aiMarkMonthKey(deps.clock());
  const limit = aiMarkQuotaForTier(auth.user.tier);
  const used = await deps.storage.getAiMarkCount(auth.user.userId, monthKey);
  const res = json({
    configured,
    remaining: Math.max(0, limit - used),
    resetAt: aiMarkResetAt(deps.clock()),
  });
  return withCookie(res, auth.refreshCookie);
}

export async function handleFeedbackPost(
  req: Request,
  deps: FeedbackDeps = getFeedbackDeps()
): Promise<Response> {
  // 1. Parse + validate the payload (unchanged).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (deps.testMode && process.env.NODE_ENV === 'production') {
    console.warn('[feedback] FEEDBACK_TEST_MODE is on in production — injection is active!');
  }

  // Test-mode injection keys are stripped BEFORE schema validation (the
  // _testCode precedent) and honored only under testMode + dummy deps below.
  const { _testResponse, _testAiMarkUsed, _testTier, ...requestBody } = (body ?? {}) as Record<string, unknown>;
  const parsedReq = markRequestSchema.safeParse(requestBody);
  if (!parsedReq.success) {
    return Response.json(
      { error: 'Invalid request', issues: parsedReq.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400 }
    );
  }
  const request = parsedReq.data;

  // 2. Per-IP in-memory limits (unchanged — first line against casual abuse).
  if (isRateLimited(clientIp(req), deps.clock())) {
    return Response.json({ error: 'Rate limit exceeded — try again later' }, { status: 429 });
  }

  // 3. Session required (E2 login gate — shared resolution, one source of
  // truth with auth/progress/analytics).
  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return json({ error: 'login_required' }, 401);

  // Provider wiring check BEFORE charging quota (E2 refinement): constructing
  // the provider costs nothing (no LLM call), and a 501 on an unconfigured
  // deployment must not burn the user's free marks.
  let provider;
  try {
    provider = getFeedbackProvider();
  } catch (err) {
    if (err instanceof FeedbackNotConfiguredError) {
      return withCookie(json({ error: 'AI feedback is not configured' }, 501), auth.refreshCookie);
    }
    throw err;
  }

  const monthKey = aiMarkMonthKey(deps.clock());

  // Test-mode injections (the _testCode precedent): honored ONLY with dummy
  // storage + test mode — never with real DynamoDB (dummyMode is false there).
  // _testAiMarkUsed forces the month's counter (e2e quota exhaustion without
  // 30 real marks); _testTier overrides the tier used for the quota limit
  // (dummy accounts are always "free").
  let tier = auth.user.tier;
  if (deps.testMode && deps.dummyMode) {
    if (
      typeof _testAiMarkUsed === 'number' &&
      Number.isInteger(_testAiMarkUsed) &&
      _testAiMarkUsed >= 0 &&
      _testAiMarkUsed <= AI_MARK_PREMIUM_MONTHLY_CAP
    ) {
      await deps.storage.setAiMarkCount?.(auth.user.userId, monthKey, _testAiMarkUsed);
    }
    const injectedTier = tierSchema.safeParse(_testTier);
    if (injectedTier.success) tier = injectedTier.data;
  }

  // 4. Durable quota (E2): ONE conditional increment on the monthly bucket,
  // BEFORE any LLM call — an exhausted quota never spends money.
  const allowed = await deps.storage.incrementAiMarkCount(
    auth.user.userId,
    aiMarkQuotaForTier(tier),
    monthKey
  );
  if (!allowed) {
    return withCookie(
      json({ error: 'quota_exceeded', resetAt: aiMarkResetAt(deps.clock()) }, 429),
      auth.refreshCookie
    );
  }

  // 5. Provider call + result validation (unchanged).
  // Test-mode injection: only with the dummy provider (never production).
  let rawResult: unknown;
  if (deps.testMode && process.env.FEEDBACK_PROVIDER === 'dummy' && _testResponse !== undefined) {
    rawResult = _testResponse;
  } else {
    try {
      rawResult = await provider.markAnswer(request);
    } catch (err) {
      return withCookie(
        json(
          { error: 'AI provider failed', detail: err instanceof Error ? err.message : String(err) },
          502
        ),
        auth.refreshCookie
      );
    }
  }

  // Validate the result shape (same schema for provider output and injections)
  // and enforce the contract: one entry per markscheme point, marks recomputed.
  const parsedResult = markResultSchema.safeParse(rawResult);
  if (!parsedResult.success || parsedResult.data.perPoint.length !== request.markscheme.length) {
    const status = deps.testMode && _testResponse !== undefined ? 400 : 502;
    return withCookie(
      json({ error: 'Malformed marking result', detail: 'perPoint must match the markscheme, one entry per point' }, status),
      auth.refreshCookie
    );
  }

  const result: MarkResult = {
    ...parsedResult.data,
    marks: marksFromPerPoint(parsedResult.data),
  };
  return withCookie(json(result), auth.refreshCookie);
}
