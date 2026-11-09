import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAiHelpPost } from '@/lib/ai-help/http-handler';
import { OpenAICompatibleHelpProvider } from '@/lib/ai-help/openai-compatible';
import { AI_HELP_FREE_MONTHLY_QUOTA, type AiHelpRequest } from '@/lib/ai-help/types';
import { InMemoryFeedbackStorage } from '@/lib/feedback/dummy';
import type { FeedbackDeps } from '@/lib/feedback/deps';
import { hashSessionToken, type UserRecord } from '@/lib/auth/types';

const BODY: AiHelpRequest = {
  action: 'why-wrong', subjectId: 'math', topicId: 'math-yr7-angles', selectedIndex: 0,
  question: { id: 'q1', stem: 'Which angle is reflex?', choices: ['150°', '90°', '200°', '45°'], correctIndex: 2, explanation: 'Reflex angles are between 180 and 360 degrees.' },
};

async function fixture(testMode = true): Promise<{ deps: FeedbackDeps; cookie: string }> {
  const storage = new InMemoryFeedbackStorage();
  const user: UserRecord = {
    userId: 'help-user', email: 'help@example.com', displayName: 'Student', role: 'student', tier: 'free',
    childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }], createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(),
  };
  await storage.createUser(user);
  await storage.createSession({
    sessionId: hashSessionToken('help-token'), userId: user.userId, email: user.email,
    createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 3600, userAgent: 'vitest', ip: '127.0.0.1',
  });
  return { deps: { storage, clock: () => Date.now(), testMode, dummyMode: true }, cookie: 'octav_session=help-token' };
}

async function post(body: unknown, deps?: FeedbackDeps, cookie?: string) {
  return handleAiHelpPost(new Request('http://localhost/api/ai-help', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }), deps);
}

describe('AI help', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requires a session', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    expect((await post(BODY)).status).toBe(401);
  });

  it('returns validated dummy help with no-store and a refreshed session', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const { deps, cookie } = await fixture();
    const response = await post({ ...BODY, _testResponse: { help: '150° is obtuse, not reflex.' } }, deps, cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=');
    expect(await response.json()).toEqual({ help: '150° is obtuse, not reflex.' });
  });

  it('uses a separate 60-per-month help quota', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const { deps, cookie } = await fixture();
    const response = await post({ ...BODY, _testAiHelpUsed: AI_HELP_FREE_MONTHLY_QUOTA }, deps, cookie);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe('quota_exceeded');
    const marking = await deps.storage.incrementAiMarkCount('help-user', 30, '2026-11');
    expect(marking).toBe(true);
  });

  it('rejects malformed provider output and invalid payloads', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const { deps, cookie } = await fixture();
    expect((await post({ ...BODY, _testResponse: { wrong: true } }, deps, cookie)).status).toBe(502);
    expect((await post({ ...BODY, topicId: 'not-real' }, deps, cookie)).status).toBe(404);
    expect((await post({ action: 'chat' }, deps, cookie)).status).toBe(400);
  });

  it('captures provider token usage for cost reporting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"help":"Try another angle."}' } }],
      usage: { prompt_tokens: 500, completion_tokens: 40, total_tokens: 540 },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleHelpProvider({ apiKey: 'test', model: 'test-model', baseUrl: 'https://provider.test/v1' });
    await expect(provider.help(BODY, { topicTitle: 'Angles', year: 7, notes: 'Reflex angles are over 180 degrees.' })).resolves.toEqual({
      help: 'Try another angle.',
      usage: { inputTokens: 500, outputTokens: 40, totalTokens: 540 },
    });
    vi.unstubAllGlobals();
  });
});
