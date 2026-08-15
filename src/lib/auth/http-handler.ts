import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  OTP_MAX_ATTEMPTS,
  OTP_REQUESTS_PER_EMAIL_PER_WINDOW,
  OTP_REQUESTS_PER_IP_PER_WINDOW,
  OTP_TTL_SECONDS,
  RATE_WINDOW_MS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  VERIFY_OTP_REQUESTS_PER_EMAIL_PER_WINDOW,
  VERIFY_OTP_REQUESTS_PER_IP_PER_WINDOW,
  accountUpdateSchema,
  hashSessionToken,
  requestOtpSchema,
  revokeSessionSchema,
  verifyOtpSchema,
  type AuthDeps,
  type ChildProfile,
  type PublicUser,
  type SessionRecord,
  type UserRecord,
} from './types';
import { getAuthDeps } from './deps';

// Phase B — framework-agnostic auth handler. The single source of truth for
// the /api/auth/* contract (docs/architecture-evolution-plan.md §2.4):
// the Next routes (src/app/api/auth/*, dev/e2e path) and the production
// Lambda (lambda/auth, behind the CloudFront /api/auth/* behavior) both
// delegate here. Dependencies (storage + email) are injected so unit tests
// pass fresh in-memory dummies; the route/lambda call sites use getAuthDeps().
//
// Security measures (§2.5 + review fixes): OTP 6 digits, 10-min TTL, max 5
// attempts enforced by an ATOMIC counter increment (H2), a durable
// DynamoDB-backed per-email request-otp budget (H3), in-memory per-IP lines
// keyed on the LAST X-Forwarded-For entry (H1 — CloudFront appends the real
// viewer IP), no email enumeration, httpOnly+Secure+SameSite=Lax 30-day
// sliding cookie (refreshed on access, M7), sessions keyed by sha256(token)
// at rest (M2), first-account creation serialized by a uniqueness claim
// (M3), SHA-256(OTP) with per-code salt, constant-time comparison, and
// Cache-Control: no-store on every response (M7).

const DUMMY_TEST_CODE = '123456'; // deterministic default under test mode + dummy deps
const EMAIL_CLAIM_RETRIES = 5; // GSI propagation retries after losing the creation claim (M3)

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Rate limiting -------------------------------------------------------------
// In-memory per-IP + verify-otp windows (per-instance, first line — the
// durable per-EMAIL request-otp budget lives in the storage layer, H3).

const ipRequestWindow = new Map<string, number[]>();
const verifyEmailWindow = new Map<string, number[]>();
const verifyIpWindow = new Map<string, number[]>();

function isWindowLimited(map: Map<string, number[]>, key: string, limit: number, now: number): boolean {
  const hits = (map.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length === 0 && map.has(key)) map.delete(key); // evict idle keys
  if (hits.length >= limit) {
    map.set(key, hits);
    return true;
  }
  hits.push(now);
  map.set(key, hits);
  return false;
}

// Under test mode with dummy deps the e2e suite shares one server IP for
// every test — relax the coarse per-IP lines so unrelated tests never 429.
function relaxedIpLimit(deps: AuthDeps, base: number): number {
  return deps.testMode && deps.dummyMode ? 10_000 : base;
}

// --- Request plumbing ---------------------------------------------------------

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return 'local';
  const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
  // CloudFront APPENDS the real viewer IP to any client-supplied XFF, so the
  // LAST entry is the trusted value; earlier entries are client-controlled
  // and trivially spoofable (review H1).
  return parts[parts.length - 1] ?? 'local';
}

function sessionTokenFromCookie(req: Request): string | null {
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
function cookieIsSecure(req: Request): boolean {
  const url = new URL(req.url);
  return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function sessionCookieValue(token: string, req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearedCookieValue(req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

/** Every auth response is built here so Cache-Control: no-store is uniform (M7). */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

async function parseJson(req: Request): Promise<{ body: unknown; error: Response | null }> {
  try {
    return { body: await req.json(), error: null };
  } catch {
    return { body: null, error: json({ error: 'Invalid JSON body' }, 400) };
  }
}

function schemaError(): Response {
  return json({ error: 'Invalid request' }, 400);
}

// --- OTP ----------------------------------------------------------------------

function hashOtp(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function otpMatches(code: string, record: { codeHash: string; salt: string }): boolean {
  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(code, record.salt), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function generateOtpCode(deps: AuthDeps, injected: string | undefined): string {
  if (deps.testMode && deps.dummyMode) {
    if (injected !== undefined) return injected;
    return DUMMY_TEST_CODE;
  }
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// --- Account helpers ----------------------------------------------------------

function publicUser(user: UserRecord): PublicUser {
  const { userId, email, displayName, role, childProfiles } = user;
  return { userId, email, displayName, role, childProfiles: childProfiles.map((p) => ({ ...p })) };
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const cleaned = local.replace(/[^a-zA-Z0-9 ._-]/g, '').trim();
  return (cleaned || 'Learner').slice(0, 40);
}

function defaultChildProfile(): ChildProfile {
  // Q1 resolution: a "student" is a parent with one child profile — "Me"
  // (docs/architecture-evolution-plan.md §2.6 / §9 Q1).
  return { profileId: randomUUID(), displayName: 'Me', stage: 'ks3' };
}

async function newUserFor(email: string, now: string): Promise<UserRecord> {
  return {
    userId: randomUUID(),
    email,
    displayName: displayNameFromEmail(email),
    role: 'parent',
    childProfiles: [defaultChildProfile()],
    createdAt: now,
    lastLoginAt: now,
  };
}

/** Resolve the authenticated user from the request cookie, or return a 401. */
async function requireAuth(
  req: Request,
  deps: AuthDeps
): Promise<
  | { user: UserRecord; session: SessionRecord; refreshCookie: string }
  | { response: Response }
> {
  const token = sessionTokenFromCookie(req);
  if (!token) return { response: json({ error: 'Not authenticated.' }, 401) };

  // Storage only ever sees the token hash (review M2).
  const sessionId = hashSessionToken(token);
  const session = await deps.storage.getSession(sessionId);
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    if (session) await deps.storage.deleteSession(sessionId);
    return { response: json({ error: 'Not authenticated.' }, 401) };
  }

  const user = await deps.storage.getUserById(session.userId);
  if (!user) {
    await deps.storage.deleteSession(sessionId);
    return { response: json({ error: 'Not authenticated.' }, 401) };
  }

  // Sliding expiry (plan §2.2): refresh lastAccessedAt + TTL on every access,
  // and re-issue the cookie so daily users aren't hard-logged-out at day 30
  // (review M7).
  await deps.storage.updateSession(sessionId, {
    lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });

  return { user, session, refreshCookie: sessionCookieValue(token, req) };
}

// --- Endpoints (§2.4) ---------------------------------------------------------

/** POST /api/auth/request-otp — always 200, same message (no enumeration). */
export async function handleRequestOtp(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  if (deps.testMode && !deps.dummyMode) {
    console.warn('[auth] AUTH_TEST_MODE is on with real dependencies — deterministic codes are DISABLED (dummy deps required).');
  }

  const { body, error } = await parseJson(req);
  if (error) return error;

  const { _testCode, ...requestBody } = (body ?? {}) as Record<string, unknown>;
  const parsed = requestOtpSchema.safeParse(requestBody);
  if (!parsed.success) return schemaError();

  // Test-mode injection path (feedback handler precedent): only honored with
  // dummy deps + AUTH_TEST_MODE=1, and still format-validated.
  let injected: string | undefined;
  if (typeof _testCode === 'string' && /^\d{6}$/.test(_testCode) && deps.testMode && deps.dummyMode) {
    injected = _testCode;
  }

  const email = parsed.data.email;
  const now = Date.now();

  // Rate limit before spending anything (sending an email or writing a code).
  // Per-EMAIL budget is the durable DynamoDB counter (H3); per-IP stays the
  // coarse in-memory line.
  const emailAllowed = await deps.storage.incrementOtpRequestCount(
    email,
    OTP_REQUESTS_PER_EMAIL_PER_WINDOW,
    RATE_WINDOW_MS / 1000
  );
  if (!emailAllowed) {
    return json({ error: 'Too many requests. Try again in 10 minutes.' }, 429);
  }
  if (isWindowLimited(ipRequestWindow, `ip:${clientIp(req)}`, relaxedIpLimit(deps, OTP_REQUESTS_PER_IP_PER_WINDOW), now)) {
    return json({ error: 'Too many requests. Try again in 10 minutes.' }, 429);
  }

  const code = generateOtpCode(deps, injected);
  const salt = randomBytes(16).toString('hex');
  await deps.storage.createOtp({
    email,
    codeHash: hashOtp(code, salt),
    salt,
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(now / 1000) + OTP_TTL_SECONDS,
  });

  try {
    await deps.emailSender.sendOtpEmail({ to: email, code, expiresInMinutes: OTP_TTL_SECONDS / 60 });
  } catch (err) {
    // Don't leave an unsent code behind — the user would get "invalid code".
    await deps.storage.deleteOtp(email);
    console.error('[auth] OTP email failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not send your code. Please try again.' }, 502);
  }

  return json({ message: 'If an account exists, a code has been sent.' });
}

/** POST /api/auth/verify-otp — first login auto-creates the account (plan §2.4). */
export async function handleVerifyOtp(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return schemaError();
  const { email, otp } = parsed.data;
  const now = Date.now();

  // verify-otp has its own budgets (review H2) — the 5-attempt lockout is per
  // code, so a per-email line stops unlimited code churn against one inbox.
  if (isWindowLimited(verifyEmailWindow, `email:${email}`, VERIFY_OTP_REQUESTS_PER_EMAIL_PER_WINDOW, now)) {
    return json({ error: 'Too many attempts. Try again in 10 minutes.' }, 429);
  }
  if (isWindowLimited(verifyIpWindow, `ip:${clientIp(req)}`, relaxedIpLimit(deps, VERIFY_OTP_REQUESTS_PER_IP_PER_WINDOW), now)) {
    return json({ error: 'Too many attempts. Try again in 10 minutes.' }, 429);
  }

  const record = await deps.storage.getOtp(email);
  if (!record) return json({ error: 'Invalid or expired code.' }, 400);

  const expired = record.expiresAt <= Math.floor(now / 1000);
  const locked = record.attempts >= OTP_MAX_ATTEMPTS;
  if (expired || locked) {
    await deps.storage.deleteOtp(email);
    return expired
      ? json({ error: 'Invalid or expired code.' }, 400)
      : json({ error: 'Too many attempts. Request a new code.' }, 429);
  }

  if (!otpMatches(otp, record)) {
    // Atomic counter increment (review H2): the storage layer's
    // condition-guarded increment makes concurrent guesses share ONE counter
    // instead of N parallel read-then-writes widening the window to ~5×N.
    const attempts = await deps.storage.incrementOtpAttempts(email, OTP_MAX_ATTEMPTS);
    if (attempts === null) {
      // null = record missing OR a user-creation-claim MARKER (round 3): a
      // marker belongs to an in-flight first login — deleting it here would
      // let a concurrent wrong guess destroy the uniqueness claim and reopen
      // the duplicate-account race. A missing OTP is already gone, and a
      // locked one is deleted by the path that set it, so 429 WITHOUT delete.
      return json({ error: 'Too many attempts. Request a new code.' }, 429);
    }
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await deps.storage.deleteOtp(email);
      return json({ error: 'Too many attempts. Request a new code.' }, 429);
    }
    return json({ error: 'Invalid or expired code.' }, 400);
  }

  // Success — the code is single-use.
  await deps.storage.deleteOtp(email);

  const nowIso = new Date().toISOString();
  let user = await deps.storage.getUserByEmail(email);
  if (!user) {
    // First login: serialize account creation with a uniqueness claim (M3) so
    // two concurrent verifies for the same new email cannot create two
    // userIds inside the users-GSI propagation window.
    const claimed = await deps.storage.claimEmailForUserCreation(email);
    if (claimed) {
      user = await newUserFor(email, nowIso);
      await deps.storage.createUser(user);
    } else {
      for (let i = 0; i < EMAIL_CLAIM_RETRIES; i++) {
        await sleep(25 * (i + 1));
        user = await deps.storage.getUserByEmail(email);
        if (user) break;
      }
      if (!user) {
        return json({ error: 'Account is being created. Try again in a moment.' }, 503);
      }
    }
  } else {
    await deps.storage.updateUser(user.userId, { lastLoginAt: nowIso });
  }

  // The cookie carries the raw high-entropy token; storage only sees its
  // sha256 (review M2).
  const token = randomUUID();
  await deps.storage.createSession({
    sessionId: hashSessionToken(token),
    userId: user.userId,
    email: user.email,
    createdAt: nowIso,
    lastAccessedAt: nowIso,
    expiresAt: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
    userAgent: req.headers.get('user-agent') ?? '',
    ip: clientIp(req),
  });

  return withCookie(json({ user: publicUser(user) }), sessionCookieValue(token, req));
}

/** POST /api/auth/logout — clears the cookie and deletes the session. */
export async function handleLogout(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const token = sessionTokenFromCookie(req);
  if (token) await deps.storage.deleteSession(hashSessionToken(token));
  return withCookie(json({ message: 'Logged out.' }), clearedCookieValue(req));
}

/** GET /api/auth/me — called on app load to check login state. */
export async function handleMe(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;
  return withCookie(json({ user: publicUser(auth.user) }), auth.refreshCookie);
}

/** POST /api/auth/account — update displayName and/or child profiles (full replace). */
export async function handleAccountPost(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) return schemaError();
  if (!parsed.data.displayName && !parsed.data.childProfiles) {
    return json({ error: 'Nothing to update.' }, 400);
  }

  const user = await deps.storage.updateUser(auth.user.userId, parsed.data);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  return withCookie(json({ user: publicUser(user) }), auth.refreshCookie);
}

/** GET /api/auth/sessions — the user's devices via the sessions GSI (plan §2.2). */
export async function handleSessionsGet(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const sessions = await deps.storage.listSessionsByUser(auth.user.userId);
  const currentToken = sessionTokenFromCookie(req);
  const currentHash = currentToken ? hashSessionToken(currentToken) : null;
  const sorted = [...sessions].sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt));

  const res = json({
    sessions: sorted.map((s) => ({
      // The stored id is the sha256 of the cookie token (M2) — safe to expose
      // (it cannot be used as a cookie) and stable for revocation.
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt,
      userAgent: s.userAgent,
      current: s.sessionId === currentHash,
    })),
  });
  return withCookie(res, auth.refreshCookie);
}

/** POST /api/auth/sessions/revoke — revoke a session; clearing the current one logs out. */
export async function handleRevokeSession(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = revokeSessionSchema.safeParse(body);
  if (!parsed.success) return schemaError();

  // The client sends the stored (hashed) id it got from GET /sessions.
  const target = await deps.storage.getSession(parsed.data.sessionId);
  if (!target || target.userId !== auth.user.userId) {
    return json({ error: 'Session not found.' }, 404);
  }
  await deps.storage.deleteSession(target.sessionId);

  const currentToken = sessionTokenFromCookie(req);
  const isCurrent = currentToken !== null && target.sessionId === hashSessionToken(currentToken);
  let res = json({ message: 'Session revoked.' });
  res = withCookie(res, isCurrent ? clearedCookieValue(req) : auth.refreshCookie);
  return res;
}

/** GET /api/auth/export — data portability (§9 Q8): everything the user has. */
export async function handleExportGet(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const [sessions, progress] = await Promise.all([
    deps.storage.listSessionsByUser(auth.user.userId),
    deps.storage.listProgressByUser(auth.user.userId),
  ]);

  // Session ids are deliberately EXCLUDED (review M2): the export must not be
  // a credential bundle — live ids have no business in a downloadable file.
  const res = json({
    exportedAt: new Date().toISOString(),
    user: auth.user,
    sessions: sessions.map((s) => ({
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt,
      userAgent: s.userAgent,
      ip: s.ip,
    })),
    progress,
  });
  return withCookie(res, auth.refreshCookie);
}

/** POST /api/auth/delete — right to erasure (§9 Q8): account + all data. */
export async function handleDeleteAccount(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const sessions = await deps.storage.listSessionsByUser(auth.user.userId);
  await Promise.all(sessions.map((s) => deps.storage.deleteSession(s.sessionId)));
  await deps.storage.deleteOtp(auth.user.email);
  await deps.storage.deleteProgressByUser(auth.user.userId);
  await deps.storage.deleteUser(auth.user.userId);

  return withCookie(json({ message: 'Account deleted.' }), clearedCookieValue(req));
}
