import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  hashSessionToken,
  type SessionRecord,
  type UserRecord,
} from './types';

// Phase C — shared session validation (rule: ONE source of truth). Both the
// auth handler and the progress handler authenticate the same way: cookie →
// sha256(token) → session row → user row, with the 30-day sliding refresh.
// This module is the single implementation; handlers only build their own
// 401 response (each handler controls its own response headers, e.g.
// Cache-Control: no-store).

/** The storage subset session validation needs (satisfied by AuthStorage). */
export interface SessionAuthStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export function sessionTokenFromCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  // Split on both separators: Function URLs / some proxies join duplicate
  // Cookie headers with ", " rather than ";" (review low).
  for (const part of cookie.split(/[;,]\s*/)) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return rest.join('=') || null;
  }
  return null;
}

/** Secure cookies only over https (localhost counts as a trustworthy origin). */
export function cookieIsSecure(req: Request): boolean {
  const url = new URL(req.url);
  return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function sessionCookieValue(token: string, req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearedCookieValue(req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export type SessionResolution =
  | { ok: true; user: UserRecord; session: SessionRecord; token: string; refreshCookie: string }
  | { ok: false };

/**
 * Resolve the authenticated user from the request cookie. Callers map
 * `ok: false` to their own 401 response. Side effects on success: the
 * session's lastAccessedAt + expiresAt slide 30 days (plan §2.2 / M7) — the
 * returned refreshCookie re-issues the cookie so daily users aren't
 * hard-logged-out at day 30.
 */
export async function resolveSession(req: Request, storage: SessionAuthStorage): Promise<SessionResolution> {
  const token = sessionTokenFromCookie(req);
  if (!token) return { ok: false };

  // Storage only ever sees the token hash (review M2).
  const sessionId = hashSessionToken(token);
  const session = await storage.getSession(sessionId);
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    if (session) await storage.deleteSession(sessionId);
    return { ok: false };
  }

  const user = await storage.getUserById(session.userId);
  if (!user) {
    await storage.deleteSession(sessionId);
    return { ok: false };
  }

  await storage.updateSession(sessionId, {
    lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true, user, session, token, refreshCookie: sessionCookieValue(token, req) };
}
