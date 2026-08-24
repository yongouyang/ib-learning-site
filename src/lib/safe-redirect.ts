// Return-URL sanitiser for post-login redirects (`/login?next=...`).
//
// The value comes straight from the query string, so it is attacker-influenced
// input. Only a same-site path may survive; anything else falls back to '/'.
// Vectors rejected: absolute URLs (`https://evil.com`), protocol-relative
// (`//evil.com`), backslash smuggling (`/\evil.com` — some browsers normalise
// backslashes to slashes in URLs), control characters / whitespace, and the
// login page itself (a signed-in user redirected back to /login would just see
// the signed-in redirect fire again — pointless churn).

const MAX_LENGTH = 2048;

/**
 * Validate an untrusted `next` value for use as a post-login redirect target.
 * Returns a same-site path (always starting with a single '/'), or '/' when
 * the input is missing or unsafe. Accepts the raw searchParams value(s).
 */
export function sanitizeReturnPath(raw: string | string[] | null | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '/';

  const path = value.trim();
  if (path.length === 0 || path.length > MAX_LENGTH) return '/';
  // Must be site-relative: one leading slash, never '//' (protocol-relative).
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  // Backslashes normalise to slashes in some browsers (`/\evil.com` → `//evil.com`).
  if (path.includes('\\')) return '/';
  // Whitespace / control characters enable further URL-smuggling tricks.
  if (/[\s\u0000-\u001f\u007f]/.test(path)) return '/';
  // Never redirect back into the login page itself.
  if (path === '/login' || path.startsWith('/login?') || path.startsWith('/login#')) return '/';

  return path;
}

/**
 * Build the `/login` href that returns the user to `returnTo` after signing
 * in. Falls back to a plain `/login` link for '/', the login page itself, or
 * any value the sanitiser rejects.
 */
export function loginHref(returnTo: string): string {
  const next = sanitizeReturnPath(returnTo);
  if (next === '/') return '/login';
  return `/login?next=${encodeURIComponent(next)}`;
}
