import type { AuthStorage, EmailSender, OtpRecord, SessionRecord, UserRecord } from './types';

// In-memory dummy for the accounts feature — the controllable-dummy directive
// (AGENTS.md): dev and e2e run against this with zero AWS resources and zero
// emails sent. Same role as src/lib/feedback/dummy.ts. Deterministic by
// construction (plain maps), and the OTP code is logged by the dummy sender so
// manual dev sessions can complete a login without any mail infrastructure.
// The dev server holds ONE shared instance per process (see deps.ts), so
// state survives hot reloads between requests but resets on restart.

export class InMemoryAuthStorage implements AuthStorage {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>(); // email → userId
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly sessionsByUser = new Map<string, Set<string>>();
  private readonly otps = new Map<string, OtpRecord>();
  private readonly progressByUser = new Map<string, unknown[]>();

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.usersByEmail.get(email);
    return userId ? (this.users.get(userId) ?? null) : null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.userId, { ...user });
    this.usersByEmail.set(user.email, user.userId);
  }

  async updateUser(
    userId: string,
    updates: { displayName?: string; childProfiles?: UserRecord['childProfiles']; lastLoginAt?: string }
  ): Promise<UserRecord | null> {
    const existing = this.users.get(userId);
    if (!existing) return null;
    const updated: UserRecord = {
      ...existing,
      ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
      ...(updates.childProfiles !== undefined ? { childProfiles: updates.childProfiles.map((p) => ({ ...p })) } : {}),
      ...(updates.lastLoginAt !== undefined ? { lastLoginAt: updates.lastLoginAt } : {}),
    };
    this.users.set(userId, updated);
    return { ...updated, childProfiles: updated.childProfiles.map((p) => ({ ...p })) };
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
    this.otps.set(otp.email, { ...otp });
  }

  async getOtp(email: string): Promise<OtpRecord | null> {
    return this.otps.get(email) ?? null;
  }

  async updateOtp(email: string, updates: { attempts: number }): Promise<void> {
    const existing = this.otps.get(email);
    if (!existing) return;
    this.otps.set(email, { ...existing, ...updates });
  }

  async deleteOtp(email: string): Promise<void> {
    this.otps.delete(email);
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
    // The dummy never delivers — log the code so a manual dev session can log in.
    console.log(`[auth:dummy] OTP for ${args.to}: ${args.code} (expires in ${args.expiresInMinutes} min)`);
  }
}
