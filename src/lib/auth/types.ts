import { z } from 'zod';

// Accounts feature (Phase B) — shared types and contract constants
// (docs/architecture-evolution-plan.md §2). The auth http-handler is the
// single source of truth; storage and email delivery are interfaces so
// dev/e2e run against an in-memory dummy (controllable-dummy directive,
// AGENTS.md) and the prod Lambda wires real DynamoDB + SES.

// --- Cookie (plan §2.2) -------------------------------------------------------

export const SESSION_COOKIE_NAME = 'octav_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, refreshed on access
export const OTP_TTL_SECONDS = 600; // 10 minutes from creation
export const OTP_MAX_ATTEMPTS = 5; // then the code is deleted; request a new one

// Rate limits (plan §2.5): per-email and per-IP sliding windows, in-memory —
// on serverless this is per-instance, a first line against casual abuse (the
// same tradeoff documented for the feedback handler's limiter).
export const OTP_REQUESTS_PER_EMAIL_PER_WINDOW = 3;
// Coarse per-IP line only (the per-email limit is the per-target defense):
// generous on purpose — schools and mobile carriers share IPs via NAT/CGNAT.
export const OTP_REQUESTS_PER_IP_PER_WINDOW = 30;
export const RATE_WINDOW_MS = 10 * 60_000;

// --- Records ------------------------------------------------------------------

export type Stage = 'ks3' | 'igcse' | 'dp';

export interface ChildProfile {
  profileId: string;
  displayName: string;
  stage: Stage;
}

export interface UserRecord {
  userId: string; // ULID-shaped opaque string (crypto.randomUUID here)
  email: string; // lowercased
  displayName: string;
  role: 'parent' | 'student';
  childProfiles: ChildProfile[]; // parent→child model (plan §2.6); a solo student is a parent with one "Me" profile
  createdAt: string; // ISO
  lastLoginAt: string; // ISO
}

export interface SessionRecord {
  sessionId: string; // opaque UUID, the cookie value (no JWT — plan §2.2)
  userId: string;
  email: string;
  createdAt: string; // ISO
  lastAccessedAt: string; // ISO
  expiresAt: number; // epoch seconds — DynamoDB TTL on octav-sessions
  userAgent: string;
  ip: string;
}

export interface OtpRecord {
  email: string; // lowercased, table PK
  codeHash: string; // sha256(salt + code) — never the plaintext code
  salt: string;
  attempts: number;
  createdAt: string; // ISO
  expiresAt: number; // epoch seconds — DynamoDB TTL on octav-otp-codes
}

/** Public user shape returned by verify-otp/me/account — never internal-only fields. */
export type PublicUser = Pick<UserRecord, 'userId' | 'email' | 'displayName' | 'role' | 'childProfiles'>;

// --- Dependency interfaces (controllable dummies, AGENTS.md) -------------------

export interface AuthStorage {
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(
    userId: string,
    updates: { displayName?: string; childProfiles?: ChildProfile[]; lastLoginAt?: string }
  ): Promise<UserRecord | null>;
  deleteUser(userId: string): Promise<void>;

  createSession(session: SessionRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionsByUser(userId: string): Promise<SessionRecord[]>;

  createOtp(otp: OtpRecord): Promise<void>;
  getOtp(email: string): Promise<OtpRecord | null>;
  updateOtp(email: string, updates: { attempts: number }): Promise<void>;
  deleteOtp(email: string): Promise<void>;

  // Progress table (Phase C is the real consumer; §9 Q8 export/delete needs
  // the plumbing now so erase/portability work from day one).
  listProgressByUser(userId: string): Promise<unknown[]>;
  deleteProgressByUser(userId: string): Promise<void>;
}

export interface EmailSender {
  sendOtpEmail(args: { to: string; code: string; expiresInMinutes: number }): Promise<void>;
}

/** Everything the http-handler needs, injected (unit tests pass fresh dummies). */
export interface AuthDeps {
  storage: AuthStorage;
  emailSender: EmailSender;
  /** AUTH_TEST_MODE=1: deterministic default code + _testCode injection. */
  testMode: boolean;
  /** True only when storage AND email are the in-memory dummies — the ONLY
   *  combination under which test-mode codes may be used (never with real
   *  DynamoDB/SES — that would be a universal login key in production). */
  dummyMode: boolean;
}

// --- Request schemas (§2.4) ----------------------------------------------------

// The feedback route's precedent: no .strict() — unknown fields are ignored,
// and the handler strips the test-injection key itself.
export const requestOtpSchema = z.object({
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
});

export const verifyOtpSchema = z.object({
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const accountUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  childProfiles: z
    .array(
      z.object({
        profileId: z.string().min(1).max(64),
        displayName: z.string().trim().min(1).max(40),
        stage: z.enum(['ks3', 'igcse', 'dp']),
      })
    )
    .min(1)
    .max(6)
    .optional(),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1).max(128),
});
