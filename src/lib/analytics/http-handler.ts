import { resolveSession } from '../auth/session';
import { devGateDenied, DEV_GATE_ERROR } from '../auth/dev-gate';
import { getAnalyticsDeps } from './deps';
import type { AnalyticsDeps } from './deps';
import {
  ANALYTICS_ADMIN_DAYS,
  ANALYTICS_EVENTS_PER_WINDOW,
  ANALYTICS_MAX_BODY_BYTES,
  ANALYTICS_MAX_UA,
  ANALYTICS_MAX_URL,
  ANALYTICS_WINDOW_SECONDS,
  analyticsEventSchema,
  type NormalizedAnalyticsEvent,
} from './types';

// Phase A — framework-agnostic analytics handler. Single source of truth for
// the /api/analytics/* contract (docs/phase-a-analytics-plan.md): the Next
// routes (dev/e2e — A2) and the production Lambda (A2/A6) will both delegate
// here, exactly like the progress handler.
//
// Security model: the event endpoint is PUBLIC and unauthenticated (no
// session lookup — ingest must be fast) but bounded per IP by the fixed-window
// budget; the summary endpoint requires a session AND an admin allowlist
// match. Attribution is anonymous-only (locked decision 3).

/** Every response is built here so Cache-Control: no-store is uniform. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function empty(status: number): Response {
  const res = new Response(null, { status });
  res.headers.set('Cache-Control', 'no-store');
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
  // CloudFront APPENDS the real viewer IP to any client-supplied XFF, so the
  // LAST entry is the trusted value; earlier entries are client-controlled
  // and trivially spoofable (auth review H1 — same rule).
  return parts[parts.length - 1] ?? 'local';
}

/** Server-side normalization: full URL → path only (query + hash stripped). */
export function normalizeUrlPath(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Malformed client url → bucket under "/" rather than fail the ingest.
    return '/';
  }
  const path = url.pathname === '' ? '/' : url.pathname;
  return path.length > ANALYTICS_MAX_URL ? path.slice(0, ANALYTICS_MAX_URL) : path;
}

/** Server-side normalization: referrer → host only; empty/unparseable → "direct". */
export function normalizeReferrer(raw: string): string {
  if (!raw) return 'direct';
  try {
    return new URL(raw).hostname || 'direct';
  } catch {
    return 'direct';
  }
}

/** Case-insensitive, comma-separated admin allowlist membership. */
export function isAdminEmail(email: string, adminEmails: string): boolean {
  const allow = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}

/** POST /api/analytics/event — public ingest (fire-and-forget from the client). */
export async function handleAnalyticsEvent(
  req: Request,
  deps: AnalyticsDeps = getAnalyticsDeps()
): Promise<Response> {
  // 4KB body budget: events are tiny; anything larger is junk or abuse.
  const text = await req.text();
  if (text.length > ANALYTICS_MAX_BODY_BYTES) return json({ error: 'Invalid request' }, 400);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const parsed = analyticsEventSchema.safeParse(body);
  if (!parsed.success) {
    // Generic message — never leak schema internals (field names, zod paths).
    return json({ error: 'Invalid request' }, 400);
  }
  const event = parsed.data;

  // Fixed-window per-IP budget (120 events / 10 min). The window epoch is in
  // the bucket key, so the counter resets atomically on rollover.
  const allowed = await deps.storage.incrementAnalyticsEventCount(
    clientIp(req),
    ANALYTICS_EVENTS_PER_WINDOW,
    ANALYTICS_WINDOW_SECONDS
  );
  if (!allowed) return json({ error: 'Too many events' }, 429);

  const requestUrl = new URL(req.url);
  const normalized: NormalizedAnalyticsEvent = {
    name: event.name,
    props: event.props as Record<string, unknown>,
    urlPath: normalizeUrlPath(event.url),
    referrer: normalizeReferrer(event.referrer),
    // The viewer host arrives in `X-Forwarded-Host`: CloudFront's /api/*
    // origin request policy (AllViewerExceptHostHeader) rewrites `Host` to the
    // origin (Function URL) domain, and the api_host_header viewer-request
    // CloudFront Function (terraform/modules/site/main.tf) copies the ORIGINAL
    // viewer host there — read it so the dev (dev.octavlearning.com) vs prod
    // (octavlearning.com) traffic split stays real. Fallback: direct Function
    // URL hits (origin domain) and the dev/e2e Next route (localhost).
    host: req.headers.get('x-forwarded-host') ?? requestUrl.hostname,
    sessionId: event.sessionId,
    ua: (req.headers.get('user-agent') ?? '').slice(0, ANALYTICS_MAX_UA),
    clientTs: event.clientTs,
  };

  await deps.storage.recordEvent(normalized);
  return empty(204);
}

/** GET /api/analytics/summary?days=7|30|90 — session-gated, admin allowlist. */
export async function handleAnalyticsSummary(
  req: Request,
  deps: AnalyticsDeps = getAnalyticsDeps()
): Promise<Response> {
  const url = new URL(req.url);
  const daysRaw = url.searchParams.get('days');
  const days = daysRaw === null ? 30 : Number(daysRaw);
  if (!(ANALYTICS_ADMIN_DAYS as readonly number[]).includes(days)) {
    return json({ error: 'Invalid days parameter' }, 400);
  }

  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return json({ error: 'Not authenticated.' }, 401);
  if (devGateDenied(req, auth.user.email)) return json({ error: DEV_GATE_ERROR }, 403);

  if (!isAdminEmail(auth.user.email, deps.adminEmails)) {
    return json({ error: 'Not authorized.' }, 403);
  }

  const summary = await deps.storage.getSummary(days);
  return withCookie(json(summary), auth.refreshCookie);
}

/** GET /api/analytics/_health — unauthenticated IAM probe (CI smoke). */
export async function handleAnalyticsHealth(
  _req: Request,
  deps: AnalyticsDeps = getAnalyticsDeps()
): Promise<Response> {
  // Limit-1 Query on a fixed probe key — exercises the real failure class
  // (missing table / missing Query grant) with zero data exposure. 200 = the
  // table AND the IAM grant work; anything else = 500.
  try {
    await deps.storage.probeAnalyticsTable();
    return json({ ok: true });
  } catch (err) {
    console.error('[analytics] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}
