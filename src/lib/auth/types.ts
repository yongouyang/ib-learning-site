import { createHash } from 'node:crypto';
import { z } from 'zod';
import { tierSchema, type Tier } from '../entitlements/features';
import { LEADERBOARD_HANDLE_RE } from '../leaderboard/handles';
import type { LeaderboardStorage } from '../leaderboard/types';

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

// Rate limits (plan §2.5). The per-EMAIL request-otp budget is enforced by a
// DURABLE DynamoDB counter via the storage interface (H3 — in-memory Maps
// reset per Lambda instance and would multiply the email-bomb budget by the
// instance count). The per-IP lines (request-otp + verify-otp) stay in-memory:
// a coarse first line only — schools and carriers share IPs via NAT/CGNAT.
export const OTP_REQUESTS_PER_EMAIL_PER_WINDOW = 3;
export const OTP_REQUESTS_PER_IP_PER_WINDOW = 30;
export const VERIFY_OTP_REQUESTS_PER_EMAIL_PER_WINDOW = 20; // enough for 2 codes × 5 attempts + margin
export const VERIFY_OTP_REQUESTS_PER_IP_PER_WINDOW = 60;
export const RATE_WINDOW_MS = 10 * 60_000;

/**
 * Sessions at rest are keyed by the SHA-256 of the cookie token (review M2):
 * the cookie keeps the high-entropy raw token, DynamoDB only ever sees the
 * hash, so a table dump is not a credential bundle. The token is a UUIDv4
 * (122 bits) — a plain unsalted hash suffices (no offline brute force).
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- Records ------------------------------------------------------------------

export type Stage = 'ks3' | 'igcse' | 'dp';

export interface ChildProfile {
  profileId: string;
  displayName: string;
  stage: Stage;
  // Phase D (docs/leaderboard-plan.md §5): per-profile leaderboard opt-in.
  // Absent = not opted in (no migration needed for pre-D3 user rows). The
  // accountUpdateSchema write path + UI land in D5; the D3 read handler
  // reports leaderboardOptIn ?? false. The handle is normally derived
  // deterministically from the profileId (leaderboard/handles.ts); a stored
  // leaderboardHandle exists only for the one allowed change.
  leaderboardOptIn?: boolean;
  leaderboardHandle?: string;
}

// --- E4 subscriptions (docs/stripe-subscriptions-plan.md §6.3) -------------

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type SubscriptionPlan = 'monthly' | 'annual';

/**
 * Billing state cached on the user row. **Stripe is the source of truth** — this
 * is a cache the webhook keeps fresh, and that GET /api/subscriptions/status
 * re-reads from Stripe whenever it is stale (plan §6.4.1). Every field is
 * optional, so rows written before E4 read back unchanged and need no migration.
 *
 * No card data lives here: we never touch the PAN or the CVV. Only the
 * non-sensitive display metadata below (brand + last4) is stored — which is what
 * keeps us in PCI SAQ A (plan §4).
 */
export interface SubscriptionFields {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan;
  currentPeriodEnd?: string; // ISO
  trialEndsAt?: string; // ISO
  cancelAtPeriodEnd?: boolean;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
}

/**
 * The scalar billing fields `updateUser` passes through, paired with the short
 * token used to build DynamoDB expression names/values. Kept here (not in
 * src/lib/subscriptions) so the auth storage never imports the subscriptions
 * module.
 */
export const SUBSCRIPTION_UPDATE_FIELDS: Array<[keyof SubscriptionFields, string]> = [
  ['stripeCustomerId', 'sci'],
  ['stripeSubscriptionId', 'ssi'],
  ['subscriptionStatus', 'sst'],
  ['subscriptionPlan', 'spl'],
  ['currentPeriodEnd', 'cpe'],
  ['trialEndsAt', 'tea'],
  ['cancelAtPeriodEnd', 'cap'],
  ['cardBrand', 'cbr'],
  ['cardLast4', 'cl4'],
  ['cardExpMonth', 'cem'],
  ['cardExpYear', 'cey'],
];

/**
 * Tier derived from the cached billing state (plan §6.4.1).
 *
 * `past_due` stays premium on purpose — Stripe is retrying the card, and a
 * failed payment should not instantly strip access. `cancel_at_period_end` does
 * NOT appear here: it does not change `status`, so a user who cancels on day 3
 * of a trial correctly keeps premium until the trial boundary, and it is the
 * `customer.subscription.deleted` event at that boundary that downgrades them.
 */
export function tierFromSubscription(status: SubscriptionStatus | undefined): Tier {
  return status === 'trialing' || status === 'active' || status === 'past_due' ? 'premium' : 'free';
}

export interface UserRecord extends SubscriptionFields {
  userId: string; // ULID-shaped opaque string (crypto.randomUUID here)
  email: string; // lowercased
  displayName: string;
  role: 'parent' | 'student';
  // Phase E0: entitlement tier (docs/entitlement-policy.md). Default "free" on
  // registration; set manually (admin grant) until Stripe lands in E4.
  tier: Tier;
  childProfiles: ChildProfile[]; // parent→child model (plan §2.6); a solo student is a parent with one "Me" profile
  createdAt: string; // ISO
  lastLoginAt: string; // ISO
}

/**
 * Phase E0: user rows written before the tier attribute existed read back as
 * "free" — existing users need no migration. Anything other than a stored
 * "premium" fails closed to "free" (a corrupted/unknown tier must never
 * accidentally grant premium features).
 */
export function withTierDefault(user: UserRecord): UserRecord {
  const parsed = tierSchema.safeParse(user.tier);
  return parsed.success ? user : { ...user, tier: 'free' };
}

export interface SessionRecord {
  sessionId: string; // sha256 of the cookie token (review M2) — the raw token never touches storage
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

/**
 * First-account-creation uniqueness marker (review M3, round 2): it lives in
 * the SAME octav-otp-codes item space under the email key (no codeHash), so
 * storage MUST treat items without codeHash as "no OTP" — see getOtp. The
 * marker is overwritten by the next request-otp and removed by deleteOtp.
 */
export interface EmailClaimMarker {
  email: string;
  marker: 'user-creation-claim';
  createdAt: string;
}

/** Public user shape returned by verify-otp/me/account — never internal-only fields. */
export type PublicUser = Pick<UserRecord, 'userId' | 'email' | 'displayName' | 'role' | 'tier' | 'childProfiles'>;

// --- Dependency interfaces (controllable dummies, AGENTS.md) -------------------

export interface AuthStorage {
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  /**
   * `tier` is writable because the E4 webhook DERIVES it from the Stripe
   * subscription status (plan §6.3) — tier stays the single entitlement source
   * of truth, and this is the only path that changes it automatically.
   */
  updateUser(
    userId: string,
    updates: {
      displayName?: string;
      childProfiles?: ChildProfile[];
      lastLoginAt?: string;
      tier?: Tier;
    } & SubscriptionFields
  ): Promise<UserRecord | null>;
  deleteUser(userId: string): Promise<void>;

  createSession(session: SessionRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionsByUser(userId: string): Promise<SessionRecord[]>;

  createOtp(otp: OtpRecord): Promise<void>;
  getOtp(email: string): Promise<OtpRecord | null>;
  /**
   * Atomically increment the OTP attempt counter (review H2). Returns the new
   * count, or null when the record is missing or already at/over `max`
   * (lockout) — the DynamoDB implementation backs this with
   * `SET attempts = attempts + 1` + `ConditionExpression: attempts < :max`,
   * so N concurrent guesses cannot each ride the same read count (a
   * read-then-write would allow ~5×N).
   */
  incrementOtpAttempts(email: string, max: number): Promise<number | null>;
  deleteOtp(email: string): Promise<void>;

  /**
   * Durable request-otp per-EMAIL rate limit (review H3). Atomically
   * increments a windowed counter (TTL'd); false = over budget. The dummy
   * mirrors the same semantics in memory.
   */
  incrementOtpRequestCount(email: string, limit: number, windowSeconds: number): Promise<boolean>;

  /**
   * Atomically claim an email for FIRST account creation (review M3) — a
   * uniqueness marker that serializes two concurrent logins for the same new
   * email inside the GSI propagation window, so only one userId is created.
   * True = this caller won; false = another caller already claimed (the
   * handler then re-queries the email GSI for the winner's user row).
   */
  claimEmailForUserCreation(email: string): Promise<boolean>;

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
  /**
   * Phase D5 (docs/leaderboard-plan.md §7): opt-out erasure target — when a
   * profile's leaderboardOptIn flips true→false, its leaderboard rows are
   * deleted via deleteEntriesByUser(userId, profileId). Undefined = erasure
   * DISABLED (DynamoDB wiring without a LEADERBOARD_TABLE env — terraform
   * grants land in D7); the account update still succeeds.
   */
  leaderboardStorage?: LeaderboardStorage;
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
        // Same charset as the progress payload ids (round 3, completing the
        // round-1 L7 requirement): '#' (and ':') in a profileId would break
        // the progress SK parsing — a stored bad id makes that profile
        // permanently unsyncable (every batch 400s). Reject at the source.
        profileId: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(64),
        displayName: z.string().trim().min(1).max(40),
        stage: z.enum(['ks3', 'igcse', 'dp']),
        // Phase D5 (docs/leaderboard-plan.md §4.3/§5): per-profile leaderboard
        // opt-in. Both optional — the handler MERGES them with the stored
        // values so an account-page save that doesn't touch the leaderboard
        // never silently wipes the opt-in state (the childProfiles array is
        // otherwise a full replace).
        leaderboardOptIn: z.boolean().optional(),
        leaderboardHandle: z.string().trim().regex(LEADERBOARD_HANDLE_RE).optional(),
      })
    )
    .min(1)
    .max(6)
    .optional(),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1).max(128),
});
