import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  OTP_MAX_ATTEMPTS,
  OTP_REQUESTS_PER_EMAIL_PER_WINDOW,
  OTP_REQUESTS_PER_IP_PER_WINDOW,
  OTP_TTL_SECONDS,
  RATE_WINDOW_MS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  accountUpdateSchema,
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
// Security measures (§2.5): OTP 6 digits, 10-min TTL, max 5 attempts,
// 3 requests/10 min per email (+ per-IP line), no email enumeration (always
// the same 200), httpOnly+Secure+SameSite=Lax cookie, opaque session ids, no
// JWT, SHA-256(OTP) with per-code salt, constant-time comparison.

const DUMMY_TEST_CODE = '123456'; // deterministic default under test mode + dummy deps

// --- Rate limiting (in-memory per-instance, same tradeoff as the feedback
// --- handler's limiter: a first line, not a hard quota).

const emailWindow = new Map<string, number[]>();
const ipWindow = new Map<string, number[]>();

function isWindowLimited(map: Map<string, number[]>, key: string, limit: number, now: number): boolean {
  const hits = (map.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  map.set(key, hits);
  if (hits.length >= limit) return true;
  hits.push(now);
  return false;
}

// --- Request plumbing ---------------------------------------------------------

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'local';
}

function sessionIdFromCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
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

function sessionCookieValue(sessionId: string, req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearedCookieValue(req: Request): string {
  const secure = cookieIsSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

async function parseJson(req: Request): Promise<{ body: unknown; error: Response | null }> {
  try {
    return { body: await req.json(), error: null };
  } catch {
    return { body: null, error: Response.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
}

function schemaError(): Response {
  return Response.json({ error: 'Invalid request' }, { status: 400 });
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

async function createSessionRecord(
  userId: string,
  email: string,
  req: Request,
  now: string
): Promise<SessionRecord> {
  return {
    sessionId: randomUUID(),
    userId,
    email,
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    userAgent: req.headers.get('user-agent') ?? '',
    ip: clientIp(req),
  };
}

/** Resolve the authenticated user from the request cookie, or return a 401. */
async function requireAuth(
  req: Request,
  deps: AuthDeps
): Promise<{ user: UserRecord; session: SessionRecord } | { response: Response }> {
  const sessionId = sessionIdFromCookie(req);
  if (!sessionId) return { response: Response.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const session = await deps.storage.getSession(sessionId);
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    if (session) await deps.storage.deleteSession(sessionId);
    return { response: Response.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }

  const user = await deps.storage.getUserById(session.userId);
  if (!user) {
    await deps.storage.deleteSession(sessionId);
    return { response: Response.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }

  // Sliding expiry (plan §2.2): refresh lastAccessedAt + TTL on every access.
  await deps.storage.updateSession(sessionId, {
    lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });

  return { user, session };
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
  if (isWindowLimited(emailWindow, `email:${email}`, OTP_REQUESTS_PER_EMAIL_PER_WINDOW, now)) {
    return Response.json({ error: 'Too many requests. Try again in 10 minutes.' }, { status: 429 });
  }
  if (isWindowLimited(ipWindow, `ip:${clientIp(req)}`, OTP_REQUESTS_PER_IP_PER_WINDOW, now)) {
    return Response.json({ error: 'Too many requests. Try again in 10 minutes.' }, { status: 429 });
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
    return Response.json({ error: 'Could not send your code. Please try again.' }, { status: 502 });
  }

  return Response.json({ message: 'If an account exists, a code has been sent.' });
}

/** POST /api/auth/verify-otp — first login auto-creates the account (plan §2.4). */
export async function handleVerifyOtp(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return schemaError();
  const { email, otp } = parsed.data;

  const record = await deps.storage.getOtp(email);
  if (!record) return Response.json({ error: 'Invalid or expired code.' }, { status: 400 });

  const expired = record.expiresAt <= Math.floor(Date.now() / 1000);
  const locked = record.attempts >= OTP_MAX_ATTEMPTS;
  if (expired || locked) {
    await deps.storage.deleteOtp(email);
    return expired
      ? Response.json({ error: 'Invalid or expired code.' }, { status: 400 })
      : Response.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
  }

  if (!otpMatches(otp, record)) {
    const attempts = record.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await deps.storage.deleteOtp(email);
      return Response.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
    }
    await deps.storage.updateOtp(email, { attempts });
    return Response.json({ error: 'Invalid or expired code.' }, { status: 400 });
  }

  // Success — the code is single-use.
  await deps.storage.deleteOtp(email);

  const now = new Date().toISOString();
  let user = await deps.storage.getUserByEmail(email);
  if (!user) {
    user = await newUserFor(email, now);
    await deps.storage.createUser(user);
  } else {
    await deps.storage.updateUser(user.userId, { lastLoginAt: now });
  }

  const session = await createSessionRecord(user.userId, user.email, req, now);
  await deps.storage.createSession(session);

  return withCookie(Response.json({ user: publicUser(user) }), sessionCookieValue(session.sessionId, req));
}

/** POST /api/auth/logout — clears the cookie and deletes the session. */
export async function handleLogout(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const sessionId = sessionIdFromCookie(req);
  if (sessionId) await deps.storage.deleteSession(sessionId);
  return withCookie(Response.json({ message: 'Logged out.' }), clearedCookieValue(req));
}

/** GET /api/auth/me — called on app load to check login state. */
export async function handleMe(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;
  return Response.json({ user: publicUser(auth.user) });
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
    return Response.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const user = await deps.storage.updateUser(auth.user.userId, parsed.data);
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  return Response.json({ user: publicUser(user) });
}

/** GET /api/auth/sessions — the user's devices via the sessions GSI (plan §2.2). */
export async function handleSessionsGet(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const sessions = await deps.storage.listSessionsByUser(auth.user.userId);
  const current = sessionIdFromCookie(req);
  const sorted = [...sessions].sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt));

  return Response.json({
    sessions: sorted.map((s) => ({
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt,
      userAgent: s.userAgent,
      current: s.sessionId === current,
    })),
  });
}

/** POST /api/auth/sessions/revoke — revoke a session; clearing the current one logs out. */
export async function handleRevokeSession(req: Request, deps: AuthDeps = getAuthDeps()): Promise<Response> {
  const auth = await requireAuth(req, deps);
  if ('response' in auth) return auth.response;

  const { body, error } = await parseJson(req);
  if (error) return error;

  const parsed = revokeSessionSchema.safeParse(body);
  if (!parsed.success) return schemaError();

  const target = await deps.storage.getSession(parsed.data.sessionId);
  if (!target || target.userId !== auth.user.userId) {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }
  await deps.storage.deleteSession(target.sessionId);

  let res = Response.json({ message: 'Session revoked.' });
  if (target.sessionId === sessionIdFromCookie(req)) {
    res = withCookie(res, clearedCookieValue(req));
  }
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

  return Response.json({
    exportedAt: new Date().toISOString(),
    user: auth.user,
    sessions,
    progress,
  });
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

  return withCookie(Response.json({ message: 'Account deleted.' }), clearedCookieValue(req));
}
