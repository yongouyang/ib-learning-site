// DEV environment access control — docs/stripe-subscriptions-plan.md §6.8.
//
// Why this exists: the DEV and PROD CloudFront distributions are served by the
// SAME Lambdas against the SAME DynamoDB tables. Without this gate anyone who
// finds dev.octavlearning.com can register and use the app against PRODUCTION
// data. That hole predates E4; putting live Stripe keys in the shared Lambda
// is what makes it urgent.
//
// How the environment is identified: a CloudFront viewer-request Function on
// the DEV distribution sets `X-Octav-Env: dev`, OVERWRITING any client-supplied
// value. Overwriting is essential — otherwise a client could spoof the header
// and walk straight past the gate. Local dev (`next dev`), the Next route
// handlers and the e2e suite never see the header, so they are untouched: no
// `X-Octav-Env` means "not DEV", which is exactly today's behaviour.

export const DEV_ENV_HEADER = 'x-octav-env';

/** The response body/error code handlers use when the gate rejects a request. */
export const DEV_GATE_ERROR = 'dev_allowlist';

/** True only when the request arrived through the DEV distribution. */
export function isDevRequest(req: Request): boolean {
  return req.headers.get(DEV_ENV_HEADER)?.trim().toLowerCase() === 'dev';
}

/** Comma-separated allowlist -> trimmed, lowercased, deduped, empties dropped. */
export function parseAllowedEmails(raw: string | undefined): string[] {
  return [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isDevAllowedEmail(email: string | undefined, allowed: string[]): boolean {
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * True when the caller should reject with 403: a DEV request whose
 * authenticated email is not on the allowlist.
 *
 * An EMPTY allowlist leaves the gate INERT (today's behaviour) rather than
 * locking the team out of staging on a missing env var. That is deliberate —
 * and it is guarded from the other side, because the deploy-dev CI smoke test
 * asserts a 403 on request-otp, so an unset DEV_ALLOWED_EMAILS turns that
 * smoke red instead of silently leaving dev wide open.
 */
export function devGateDenied(
  req: Request,
  email: string | undefined,
  raw: string | undefined = process.env.DEV_ALLOWED_EMAILS,
): boolean {
  if (!isDevRequest(req)) return false;
  const allowed = parseAllowedEmails(raw);
  if (allowed.length === 0) return false;
  return !isDevAllowedEmail(email, allowed);
}

/**
 * Gate for endpoints that are NOT yet authenticated but carry the email in the
 * body (request-otp). Rejecting here stops a non-allowlisted address from ever
 * obtaining a session on DEV, rather than letting it log in and fail later.
 */
export function devGateDeniesEmail(
  req: Request,
  email: string | undefined,
  raw: string | undefined = process.env.DEV_ALLOWED_EMAILS,
): boolean {
  if (!isDevRequest(req)) return false;
  const allowed = parseAllowedEmails(raw);
  if (allowed.length === 0) return false;
  return !isDevAllowedEmail(email, allowed);
}
