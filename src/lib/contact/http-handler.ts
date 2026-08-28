import { randomUUID } from 'node:crypto';
import { resolveSession } from '../auth/session';
import { getContactDeps, type ContactDeps } from './deps';
import { contactEmailSubject, renderContactEmailHtml, renderContactEmailText } from './email';
import {
  CONTACT_MAX_BODY_BYTES,
  CONTACT_MESSAGES_PER_WINDOW,
  CONTACT_WINDOW_SECONDS,
  contactMessageTtl,
  contactRequestSchema,
  type ContactMessage,
} from './types';

// Feature 3 — framework-agnostic contact handler (docs/supportability-
// features-plan.md §C1). Single source of truth for the /api/contact contract:
// the Next route (src/app/api/contact/route.ts, dev/e2e path) and the
// production Lambda (lambda/contact, behind the CloudFront /api/contact/*
// behavior) both delegate here, exactly like the analytics/feedback handlers.
//
// Security model: the endpoint is PUBLIC (no 401 — logged-out users can ask
// for help) but bounded per IP by the durable fixed-window budget in
// octav-rate-limits (3 messages/hour; bucket contact:<ip>:<epoch>). A resolved
// session only attributes the message (userId) and re-issues the sliding
// refresh cookie. Client clocks are never trusted — createdAt/expiresAt come
// from the injected server clock.
//
// Email-failure semantics (documented decision): the message is persisted
// BEFORE the notification email is sent, and an email failure NEVER fails the
// request — the message is durably stored (readable via the admin CRUD
// dashboard, Feature 2) and a 5xx would invite a user retry and a duplicate
// row. The failure is logged ([contact] notification email failed). This
// deliberately differs from the analytics-report precedent (throw →
// EventBridge retry): a user-facing POST has no retry mechanism.

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

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return 'local';
  const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
  // CloudFront APPENDS the real viewer IP to any client-supplied XFF, so the
  // LAST entry is the trusted value; earlier entries are client-controlled
  // and trivially spoofable (the analytics handler's rule, same class).
  return parts[parts.length - 1] ?? 'local';
}

/** POST /api/contact — public, rate-limited, persisted + emailed. */
export async function handleContactPost(
  req: Request,
  deps: ContactDeps = getContactDeps()
): Promise<Response> {
  // 8KB body budget: the message caps at 2000 chars; anything larger is junk
  // or abuse (the analytics 4KB precedent).
  const text = await req.text();
  if (text.length > CONTACT_MAX_BODY_BYTES) return json({ error: 'Invalid request' }, 400);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: 'Invalid request', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      400
    );
  }

  // Per-IP fixed-window budget BEFORE any write (the analytics ordering).
  const allowed = await deps.storage.incrementContactCount(
    clientIp(req),
    CONTACT_MESSAGES_PER_WINDOW,
    CONTACT_WINDOW_SECONDS
  );
  if (!allowed) return json({ error: 'Too many messages — try again later' }, 429);

  // Public endpoint: a session, when one resolves, only attributes the message.
  const auth = await resolveSession(req, deps.storage);

  const nowMs = deps.clock();
  const message: ContactMessage = {
    messageId: randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    userId: auth.ok ? auth.user.userId : null,
    createdAt: new Date(nowMs).toISOString(),
    status: 'new',
    expiresAt: contactMessageTtl(nowMs),
  };
  await deps.storage.saveContactMessage(message);

  // Notification email — best-effort (see header). No recipients configured
  // (dev with the dummy wiring) = skipped.
  if (deps.recipients.length === 0) {
    console.warn('[contact] no recipients configured (ANALYTICS_ADMIN_EMAILS) — notification email skipped');
  } else {
    try {
      await deps.sender.send({
        to: deps.recipients,
        subject: contactEmailSubject(message),
        html: renderContactEmailHtml(message),
        text: renderContactEmailText(message),
      });
    } catch (err) {
      console.error('[contact] notification email failed:', err instanceof Error ? err.message : err);
    }
  }

  const res = json({ success: true });
  return auth.ok ? withCookie(res, auth.refreshCookie) : res;
}

/** GET /api/contact/_health — unauthenticated IAM probe (CI smoke). */
export async function handleContactHealth(
  _req: Request,
  deps: ContactDeps = getContactDeps()
): Promise<Response> {
  // GetItem on a fixed probe key — exercises the real failure class (missing
  // table / missing grant) with zero data exposure. 200 = the table AND the
  // IAM grant work; anything else = 500.
  try {
    await deps.storage.probeContactTable();
    return json({ ok: true });
  } catch (err) {
    console.error('[contact] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}
