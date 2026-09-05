import type {
  AuthStorage,
  EmailClaimMarker,
  EmailSender,
  OtpRecord,
  SessionRecord,
  SubscriptionFields,
  UserRecord,
} from './types';
import { SUBSCRIPTION_UPDATE_FIELDS, withTierDefault } from './types';

// In-memory dummy for the accounts feature — the controllable-dummy directive
// (AGENTS.md): dev and e2e run against this with zero AWS resources and zero
// emails sent. Same role as src/lib/feedback/dummy.ts. Deterministic by
// construction (plain maps), and the OTP code is logged by the dummy sender so
// manual dev sessions can complete a login without any mail infrastructure.
// The dev server holds ONE shared instance per process (see deps.ts), so
// state survives hot reloads between requests but resets on restart.
//
// SEMANTICS MIRROR DynamoDB exactly (round-2 review): the creation-claim
// marker lives in the OTP item space under the email key (getOtp returns null
// for items without codeHash, deleteOtp removes it, request-otp overwrites
// it), and the request-otp counter uses FIXED epoch windows like the
// DynamoDB bucket-key design — an injectable clock makes both testable.

export class InMemoryAuthStorage implements AuthStorage {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>(); // email → userId
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly sessionsByUser = new Map<string, Set<string>>();
  private readonly otps = new Map<string, OtpRecord | EmailClaimMarker>();
  private readonly progressByUser = new Map<string, unknown[]>();
  private readonly otpRequests = new Map<string, number>();

  // `protected` (not private) so the progress/analytics subclasses can read
  // the SAME clock for their fixed-window limiters — one injectable clock for
  // the whole shared universe, no per-subclass copies.
  constructor(protected readonly clock: () => number = Date.now) {}

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.usersByEmail.get(email);
    const user = userId ? (this.users.get(userId) ?? null) : null;
    // Phase E0: mirror DynamoDB — a missing tier reads back as "free".
    return user ? withTierDefault(user) : null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const user = this.users.get(userId) ?? null;
    return user ? withTierDefault(user) : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.userId, { ...user });
    this.usersByEmail.set(user.email, user.userId);
  }

  async updateUser(
    userId: string,
    updates: {
      displayName?: string;
      childProfiles?: UserRecord['childProfiles'];
      lastLoginAt?: string;
      tier?: UserRecord['tier'];
    } & SubscriptionFields
  ): Promise<UserRecord | null> {
    const existing = this.users.get(userId);
    if (!existing) return null;
    // E4 billing fields: pass through only the ones actually present, so an
    // update that omits them cannot blank a cached subscription state.
    const billing: SubscriptionFields = {};
    for (const [field] of SUBSCRIPTION_UPDATE_FIELDS) {
      const value = updates[field];
      if (value !== undefined) (billing as Record<string, unknown>)[field] = value;
    }
    const updated: UserRecord = {
      ...existing,
      ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
      ...(updates.childProfiles !== undefined ? { childProfiles: updates.childProfiles.map((p) => ({ ...p })) } : {}),
      ...(updates.lastLoginAt !== undefined ? { lastLoginAt: updates.lastLoginAt } : {}),
      ...(updates.tier !== undefined ? { tier: updates.tier } : {}),
      ...billing,
    };
    this.users.set(userId, updated);
    return withTierDefault({ ...updated, childProfiles: updated.childProfiles.map((p) => ({ ...p })) });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.usersByEmail.delete(user.email);
    this.users.delete(userId);
    this.progressByUser.delete(userId);
    const sessionIds = this.sessionsByUser.get(userId);
    if (sessionIds) {
      for (const id of sessionIds) this.sessions.delete(id);
      this.sessionsByUser.delete(userId);
    }
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
    const set = this.sessionsByUser.get(session.userId) ?? new Set<string>();
    set.add(session.sessionId);
    this.sessionsByUser.set(session.userId, set);
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return;
    this.sessions.set(sessionId, { ...existing, ...updates });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    if (session) {
      const set = this.sessionsByUser.get(session.userId);
      set?.delete(sessionId);
    }
  }

  async listSessionsByUser(userId: string): Promise<SessionRecord[]> {
    const ids = this.sessionsByUser.get(userId) ?? new Set<string>();
    return [...ids].map((id) => this.sessions.get(id)).filter((s): s is SessionRecord => s !== undefined);
  }

  async createOtp(otp: OtpRecord): Promise<void> {
    // Unconditional put — overwrites any creation-claim marker, exactly like
    // the DynamoDB PutCommand.
    this.otps.set(otp.email, { ...otp });
  }

  async getOtp(email: string): Promise<OtpRecord | null> {
    const item = this.otps.get(email) as OtpRecord | EmailClaimMarker | undefined;
    // Items without codeHash are creation-claim markers, not codes (round 2:
    // a blind cast here made verify-otp 500 on the marker).
    if (!item || typeof (item as Partial<OtpRecord>).codeHash !== 'string') return null;
    return item as OtpRecord;
  }

  async incrementOtpAttempts(email: string, max: number): Promise<number | null> {
    const item = this.otps.get(email) as OtpRecord | EmailClaimMarker | undefined;
    const rec = item as Partial<OtpRecord> | undefined;
    // Marker-safe (round 2): items without codeHash/attempts behave exactly
    // like DynamoDB's condition failure → null (lockout), never a 500.
    if (!rec || typeof rec.codeHash !== 'string' || typeof rec.attempts !== 'number') return null;
    if (rec.attempts >= max) return null;
    const attempts = rec.attempts + 1;
    this.otps.set(email, { ...rec, attempts } as OtpRecord);
    return attempts;
  }

  async deleteOtp(email: string): Promise<void> {
    // Removes the code AND any claim marker (DynamoDB DeleteCommand does both).
    this.otps.delete(email);
  }

  // Durable-limiter mirror (review H3, round 2): FIXED epoch windows, exactly
  // like the DynamoDB bucket-key design — the window epoch is part of the key,
  // so the counter resets atomically when the window rolls.
  async incrementOtpRequestCount(email: string, limit: number, windowSeconds: number): Promise<boolean> {
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clock() / windowMs);
    const key = `${email}#${epoch}`;
    const count = this.otpRequests.get(key) ?? 0;
    if (count >= limit) {
      this.otpRequests.set(key, count);
      return false;
    }
    this.otpRequests.set(key, count + 1);
    return true;
  }

  // First-creation uniqueness claim (review M3, round 2): the marker is stored
  // AS the OTP-table entry under the email key — identical to the DynamoDB
  // conditional put. The next request-otp overwrites it; deleteOtp removes it.
  async claimEmailForUserCreation(email: string): Promise<boolean> {
    if (this.otps.has(email)) return false;
    this.otps.set(email, { email, marker: 'user-creation-claim', createdAt: new Date().toISOString() });
    return true;
  }

  async listProgressByUser(userId: string): Promise<unknown[]> {
    return [...(this.progressByUser.get(userId) ?? [])];
  }

  async deleteProgressByUser(userId: string): Promise<void> {
    this.progressByUser.delete(userId);
  }
}

export class DummyEmailSender implements EmailSender {
  /** Outbox — every "sent" email, for assertions and manual dev inspection. */
  readonly sent: { to: string; code: string; expiresInMinutes: number }[] = [];

  async sendOtpEmail(args: { to: string; code: string; expiresInMinutes: number }): Promise<void> {
    this.sent.push({ ...args });
    // Never log OTP code values (review M1), even in dummy mode — enable
    // AUTH_TEST_MODE=1 for the deterministic 123456 instead.
    console.log(`[auth:dummy] OTP email sent to ${args.to} (code withheld; expires in ${args.expiresInMinutes} min)`);
  }
}
