import { describe, expect, it, vi } from 'vitest';
import { DummyEmailSender } from '@/lib/auth/dummy';
import {
  handleAccountPost,
  handleDeleteAccount,
  handleExportGet,
  handleRequestOtp,
  handleVerifyOtp,
} from '@/lib/auth/http-handler';
import type { AuthDeps } from '@/lib/auth/types';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import type { LearningJourneyEventInput } from '@/lib/analytics/journey';

let counter = 0;

function request(method: string, path: string, body?: unknown, cookie = ''): Request {
  return new Request(`https://octavlearning.com${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeDeps() {
  const storage = new InMemoryAnalyticsStorage();
  const deps: AuthDeps = {
    storage,
    journeyStorage: storage,
    emailSender: new DummyEmailSender(),
    testMode: true,
    dummyMode: true,
  };
  return { storage, deps };
}

async function login(deps: AuthDeps) {
  const email = `journey-auth-${++counter}@example.com`;
  await handleRequestOtp(request('POST', '/api/auth/request-otp', { email }), deps);
  const response = await handleVerifyOtp(request('POST', '/api/auth/verify-otp', { email, otp: '123456' }), deps);
  const token = response.headers.get('set-cookie')?.split(';')[0].split('=')[1];
  const body = await response.json();
  return { cookie: `octav_session=${token}`, user: body.user };
}

function journeyEvent(userId: string, profileId: string): LearningJourneyEventInput {
  return {
    userId,
    profileId,
    eventId: '11111111-1111-4111-8111-111111111111',
    name: 'quiz_completed',
    props: { subjectId: 'math', topicId: 'algebra', attemptId: 'attempt-1', correctCount: 3, totalCount: 4 },
    urlPath: '/subjects/math/algebra/quiz',
    host: 'octavlearning.com',
    sessionId: 'session-1',
    occurredAt: new Date().toISOString(),
    test: false,
  };
}

describe('learning journey account preference, export and erasure', () => {
  it('defaults off, opts in explicitly, exports journey rows and deletes them on opt-out', async () => {
    const { storage, deps } = makeDeps();
    const session = await login(deps);
    expect(session.user.journeyAnalyticsOptIn).toBe(false);

    const enabled = await handleAccountPost(
      request('POST', '/api/auth/account', { journeyAnalyticsOptIn: true }, session.cookie),
      deps
    );
    expect(enabled.status).toBe(200);
    expect((await enabled.json()).user.journeyAnalyticsOptIn).toBe(true);

    await storage.recordJourneyEvent(journeyEvent(session.user.userId, session.user.childProfiles[0].profileId));
    const exported = await handleExportGet(request('GET', '/api/auth/export', undefined, session.cookie), deps);
    const exportedBody = await exported.json();
    expect(exportedBody.journeyEvents).toHaveLength(1);
    expect(exportedBody.journeyEvents[0].userId).toBe(session.user.userId);

    const disabled = await handleAccountPost(
      request('POST', '/api/auth/account', { journeyAnalyticsOptIn: false }, session.cookie),
      deps
    );
    expect(disabled.status).toBe(200);
    expect((await disabled.json()).user.journeyAnalyticsOptIn).toBe(false);
    expect(await storage.listJourneyEventsByUser(session.user.userId)).toEqual([]);
  });

  it('keeps the opt-out durable when deletion fails and allows a retry to finish erasure', async () => {
    const { storage, deps } = makeDeps();
    const session = await login(deps);
    await storage.updateUser(session.user.userId, { journeyAnalyticsOptIn: true });
    await storage.recordJourneyEvent(journeyEvent(session.user.userId, session.user.childProfiles[0].profileId));
    const deletion = vi.spyOn(storage, 'deleteJourneyEventsByUser').mockRejectedValueOnce(new Error('database unavailable'));

    const failed = await handleAccountPost(
      request('POST', '/api/auth/account', { journeyAnalyticsOptIn: false }, session.cookie),
      deps
    );
    expect(failed.status).toBe(500);
    expect((await storage.getUserById(session.user.userId))?.journeyAnalyticsOptIn).toBe(false);

    deletion.mockRestore();
    const retried = await handleAccountPost(
      request('POST', '/api/auth/account', { journeyAnalyticsOptIn: false }, session.cookie),
      deps
    );
    expect(retried.status).toBe(200);
    expect(await storage.listJourneyEventsByUser(session.user.userId)).toEqual([]);
  });

  it('deletes journey events with the account and isolates other accounts', async () => {
    const { storage, deps } = makeDeps();
    const session = await login(deps);
    const other = await login(deps);
    await storage.recordJourneyEvent(journeyEvent(session.user.userId, session.user.childProfiles[0].profileId));
    await storage.recordJourneyEvent(journeyEvent(other.user.userId, other.user.childProfiles[0].profileId));

    const deleted = await handleDeleteAccount(request('POST', '/api/auth/delete', undefined, session.cookie), deps);
    expect(deleted.status).toBe(200);
    expect(await storage.listJourneyEventsByUser(session.user.userId)).toEqual([]);
    expect(await storage.listJourneyEventsByUser(other.user.userId)).toHaveLength(1);
    expect(await storage.getUserById(session.user.userId)).toBeNull();
  });
});
