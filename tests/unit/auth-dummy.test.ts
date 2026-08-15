import { describe, it, expect } from 'vitest';
import { DummyEmailSender, InMemoryAuthStorage } from '@/lib/auth/dummy';
import type { OtpRecord, SessionRecord, UserRecord } from '@/lib/auth/types';

function makeUser(userId: string, email: string): UserRecord {
  return {
    userId,
    email,
    displayName: 'Test',
    role: 'parent',
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

  it('OTP records: create/get/update/delete by email', async () => {
    const s = new InMemoryAuthStorage();
    const otp: OtpRecord = {
      email: 'a@example.com', codeHash: 'hash', salt: 'salt',
      attempts: 0, createdAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 600,
    };
    await s.createOtp(otp);
    expect((await s.getOtp('a@example.com'))?.codeHash).toBe('hash');

    await s.updateOtp('a@example.com', { attempts: 3 });
    expect((await s.getOtp('a@example.com'))!.attempts).toBe(3);

    await s.deleteOtp('a@example.com');
    expect(await s.getOtp('a@example.com')).toBeNull();
  });

  it('updateOtp and updateSession are no-ops for missing keys', async () => {
    const s = new InMemoryAuthStorage();
    await expect(s.updateOtp('missing@example.com', { attempts: 1 })).resolves.toBeUndefined();
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
