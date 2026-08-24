import { describe, it, expect } from 'vitest';
import { DummyEmailSender, InMemoryAuthStorage } from '@/lib/auth/dummy';
import type { OtpRecord, SessionRecord, UserRecord } from '@/lib/auth/types';

function makeUser(userId: string, email: string): UserRecord {
  return {
    userId,
    email,
    displayName: 'Test',
    role: 'parent',
    tier: 'free',
    childProfiles: [{ profileId: `p-${userId}`, displayName: 'Me', stage: 'ks3' }],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

function makeSession(sessionId: string, userId: string, email: string): SessionRecord {
  return {
    sessionId,
    userId,
    email,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    userAgent: 'test',
    ip: '127.0.0.1',
  };
}

describe('InMemoryAuthStorage', () => {
  it('round-trips users by id and email', async () => {
    const s = new InMemoryAuthStorage();
    await s.createUser(makeUser('u1', 'a@example.com'));
    expect((await s.getUserById('u1'))?.userId).toBe('u1');
    expect((await s.getUserByEmail('a@example.com'))?.userId).toBe('u1');
    expect(await s.getUserByEmail('missing@example.com')).toBeNull();
  });

  it('tier (E0): premium round-trips; a stored row WITHOUT tier reads back as "free" (DynamoDB parity)', async () => {
    const s = new InMemoryAuthStorage();
    await s.createUser({ ...makeUser('u1', 'a@example.com'), tier: 'premium' });
    expect((await s.getUserById('u1'))?.tier).toBe('premium');
    expect((await s.getUserByEmail('a@example.com'))?.tier).toBe('premium');

    // Legacy pre-E0 row: no tier attribute (cast simulates the old shape).
    const legacy = makeUser('u2', 'b@example.com') as Partial<UserRecord>;
    delete legacy.tier;
    await s.createUser(legacy as UserRecord);
    expect((await s.getUserById('u2'))?.tier).toBe('free');
    expect((await s.getUserByEmail('b@example.com'))?.tier).toBe('free');
    // updateUser normalizes the returned record too.
    expect((await s.updateUser('u2', { displayName: 'X' }))?.tier).toBe('free');
  });

  it('updateUser returns null for unknown users and applies partial updates', async () => {
    const s = new InMemoryAuthStorage();
    expect(await s.updateUser('nope', { displayName: 'X' })).toBeNull();
    await s.createUser(makeUser('u1', 'a@example.com'));

    const updated = await s.updateUser('u1', { displayName: 'Renamed' });
    expect(updated!.displayName).toBe('Renamed');
    expect(updated!.childProfiles).toHaveLength(1); // untouched fields survive

    const withProfiles = await s.updateUser('u1', {
      childProfiles: [
        { profileId: 'p1', displayName: 'Alex', stage: 'igcse' },
        { profileId: 'p2', displayName: 'Sam', stage: 'dp' },
      ],
    });
    expect(withProfiles!.childProfiles).toHaveLength(2);
  });

  it('deleteUser cascades to the email index, sessions, and progress', async () => {
    const s = new InMemoryAuthStorage();
    await s.createUser(makeUser('u1', 'a@example.com'));
    await s.createSession(makeSession('s1', 'u1', 'a@example.com'));

    await s.deleteUser('u1');
    expect(await s.getUserById('u1')).toBeNull();
    expect(await s.getUserByEmail('a@example.com')).toBeNull();
    expect(await s.listSessionsByUser('u1')).toEqual([]);
  });

  it('sessions: create/get/update/delete and list by user', async () => {
    const s = new InMemoryAuthStorage();
    await s.createSession(makeSession('s1', 'u1', 'a@example.com'));
    await s.createSession(makeSession('s2', 'u1', 'a@example.com'));
    await s.createSession(makeSession('s3', 'u2', 'b@example.com'));

    expect(await s.listSessionsByUser('u1')).toHaveLength(2);

    await s.updateSession('s1', { lastAccessedAt: '2026-08-15T00:00:00.000Z', expiresAt: 1 });
    expect((await s.getSession('s1'))!.expiresAt).toBe(1);

    await s.deleteSession('s1');
    expect(await s.getSession('s1')).toBeNull();
    expect(await s.listSessionsByUser('u1')).toHaveLength(1);
  });

  it('OTP records: create/get/increment-attempts/delete by email', async () => {
    const s = new InMemoryAuthStorage();
    const otp: OtpRecord = {
      email: 'a@example.com', codeHash: 'hash', salt: 'salt',
      attempts: 0, createdAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 600,
    };
    await s.createOtp(otp);
    expect((await s.getOtp('a@example.com'))?.codeHash).toBe('hash');

    expect(await s.incrementOtpAttempts('a@example.com', 5)).toBe(1);
    expect(await s.incrementOtpAttempts('a@example.com', 5)).toBe(2);
    expect((await s.getOtp('a@example.com'))!.attempts).toBe(2);

    // Missing records → null (lockout semantics).
    expect(await s.incrementOtpAttempts('missing@example.com', 5)).toBeNull();

    await s.deleteOtp('a@example.com');
    expect(await s.getOtp('a@example.com')).toBeNull();
  });

  it('incrementOtpAttempts returns null for missing keys and at max', async () => {
    const s = new InMemoryAuthStorage();
    expect(await s.incrementOtpAttempts('missing@example.com', 5)).toBeNull();

    await s.createOtp({
      email: 'locked@example.com', codeHash: 'h', salt: 's', attempts: 5,
      createdAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await s.incrementOtpAttempts('locked@example.com', 5)).toBeNull();
  });

  it('incrementOtpRequestCount enforces the fixed window and resets when it rolls', async () => {
    // Injectable clock (round 2): 600s windows, epoch-aligned.
    let now = 300_000; // inside window epoch 0 (0–600s)
    const s = new InMemoryAuthStorage(() => now);
    for (let i = 0; i < 3; i++) {
      expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(true);
    }
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(false);
    // A different email has its own bucket.
    expect(await s.incrementOtpRequestCount('b@example.com', 3, 600)).toBe(true);

    // Window rolls → the counter resets atomically (new epoch key) — no
    // dependence on any TTL deletion.
    now = 900_000; // window epoch 1
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(true);
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(true);
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(true);
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(false);
  });

  it('claimEmailForUserCreation grants exactly one winner per email and the marker occupies the OTP slot', async () => {
    const s = new InMemoryAuthStorage();
    expect(await s.claimEmailForUserCreation('a@example.com')).toBe(true);
    expect(await s.claimEmailForUserCreation('a@example.com')).toBe(false);
    expect(await s.claimEmailForUserCreation('b@example.com')).toBe(true);

    // The marker lives in the OTP item space: getOtp returns null (round 2 —
    // a blind cast here made verify-otp 500) and deleteOtp removes it.
    expect(await s.getOtp('a@example.com')).toBeNull();
    await s.deleteOtp('a@example.com');
    expect(await s.claimEmailForUserCreation('a@example.com')).toBe(true);

    // A real OTP overwrites the marker (unconditional put), and the claim
    // then loses — mirroring DynamoDB.
    await s.createOtp({
      email: 'b@example.com', codeHash: 'h', salt: 's', attempts: 0,
      createdAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await s.getOtp('b@example.com')).not.toBeNull();
    expect(await s.claimEmailForUserCreation('b@example.com')).toBe(false);
  });

  it('incrementOtpAttempts is marker-safe: null for items without codeHash/attempts', async () => {
    const s = new InMemoryAuthStorage();
    await s.claimEmailForUserCreation('marker@example.com');
    expect(await s.incrementOtpAttempts('marker@example.com', 5)).toBeNull();
  });

  it('updateSession is a no-op for missing keys', async () => {
    const s = new InMemoryAuthStorage();
    await expect(s.updateSession('missing', { lastAccessedAt: '', expiresAt: 0 })).resolves.toBeUndefined();
  });

  it('deleteProgressByUser clears progress entries', async () => {
    const s = new InMemoryAuthStorage();
    await expect(s.deleteProgressByUser('u1')).resolves.toBeUndefined();
  });
});

describe('DummyEmailSender', () => {
  it('records sent emails without delivering', async () => {
    const sender = new DummyEmailSender();
    await sender.sendOtpEmail({ to: 'a@example.com', code: '123456', expiresInMinutes: 10 });
    expect(sender.sent).toEqual([{ to: 'a@example.com', code: '123456', expiresInMinutes: 10 }]);
  });
});
