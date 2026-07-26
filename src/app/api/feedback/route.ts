import {
  getFeedbackProvider,
  isFeedbackConfigured,
  isTestMode,
  markRequestSchema,
  markResultSchema,
  marksFromPerPoint,
  FeedbackNotConfiguredError,
  type MarkResult,
} from '@/lib/feedback';

// Phase 5 — AI feedback route. Key is server-side only (FEEDBACK_API_KEY,
// never NEXT_PUBLIC_). Graceful degradation: 501 when unconfigured — the UI
// hides the "Mark with AI" button and students self-mark.

const RATE_PER_MIN = () => Number(process.env.FEEDBACK_RATE_LIMIT_PER_MIN ?? 10);
const RATE_PER_DAY = () => Number(process.env.FEEDBACK_RATE_LIMIT_PER_DAY ?? 50);

// Per-IP sliding windows, in-memory. NOTE: on serverless this is per-instance,
// not global — a first line against casual abuse, not a hard quota (see
// phase-5-implementation-plan.md §3.5; Upstash is the follow-up).
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

export async function GET() {
  return Response.json({ configured: isFeedbackConfigured() });
}

export async function POST(req: Request) {
  // Parse + validate the payload.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const testMode = isTestMode();
  if (testMode && process.env.NODE_ENV === 'production') {
    console.warn('[feedback] FEEDBACK_TEST_MODE is on in production — injection is active!');
  }

  const { _testResponse, ...requestBody } = (body ?? {}) as Record<string, unknown>;
  const parsedReq = markRequestSchema.safeParse(requestBody);
  if (!parsedReq.success) {
    return Response.json(
      { error: 'Invalid request', issues: parsedReq.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400 }
    );
  }
  const request = parsedReq.data;

  // Rate limit before spending anything.
  if (isRateLimited(clientIp(req), Date.now())) {
    return Response.json({ error: 'Rate limit exceeded — try again later' }, { status: 429 });
  }

  // Provider.
  let provider;
  try {
    provider = getFeedbackProvider();
  } catch (err) {
    if (err instanceof FeedbackNotConfiguredError) {
      return Response.json({ error: 'AI feedback is not configured' }, { status: 501 });
    }
    throw err;
  }

  // Test-mode injection: only with the dummy provider (never production).
  let rawResult: unknown;
  if (testMode && process.env.FEEDBACK_PROVIDER === 'dummy' && _testResponse !== undefined) {
    rawResult = _testResponse;
  } else {
    try {
      rawResult = await provider.markAnswer(request);
    } catch (err) {
      return Response.json(
        { error: 'AI provider failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }
  }

  // Validate the result shape (same schema for provider output and injections)
  // and enforce the contract: one entry per markscheme point, marks recomputed.
  const parsedResult = markResultSchema.safeParse(rawResult);
  if (!parsedResult.success || parsedResult.data.perPoint.length !== request.markscheme.length) {
    const status = testMode && _testResponse !== undefined ? 400 : 502;
    return Response.json(
      { error: 'Malformed marking result', detail: 'perPoint must match the markscheme, one entry per point' },
      { status }
    );
  }

  const result: MarkResult = {
    ...parsedResult.data,
    marks: marksFromPerPoint(parsedResult.data),
  };
  return Response.json(result);
}
