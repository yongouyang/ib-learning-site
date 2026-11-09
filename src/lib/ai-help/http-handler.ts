import { getContentTopic } from '@/content/registry.content';
import { devGateDenied, DEV_GATE_ERROR } from '@/lib/auth/dev-gate';
import { resolveSession } from '@/lib/auth/session';
import { getFeedbackDeps, type FeedbackDeps } from '@/lib/feedback/deps';
import { aiMarkMonthKey, aiMarkResetAt } from '@/lib/feedback/types';
import { FeedbackNotConfiguredError } from '@/lib/feedback/types';
import { tierSchema } from '@/lib/entitlements/features';
import { getAiHelpProvider } from './index';
import { aiHelpQuotaForTier, aiHelpRequestSchema, aiHelpResultSchema, aiHelpUsageSchema } from './types';

function json(body: unknown, status = 200): Response {
  const response = Response.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function withCookie(response: Response, cookie: string): Response {
  response.headers.append('Set-Cookie', cookie);
  return response;
}

export async function handleAiHelpPost(req: Request, deps: FeedbackDeps = getFeedbackDeps()): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { _testResponse, _testAiHelpUsed, _testTier, ...requestBody } = (body ?? {}) as Record<string, unknown>;
  const parsed = aiHelpRequestSchema.safeParse(requestBody);
  if (!parsed.success) return json({ error: 'Invalid request' }, 400);

  const auth = await resolveSession(req, deps.storage);
  if (!auth.ok) return json({ error: 'login_required' }, 401);
  if (devGateDenied(req, auth.user.email)) return json({ error: DEV_GATE_ERROR }, 403);

  let provider;
  try {
    provider = getAiHelpProvider();
  } catch (error) {
    if (error instanceof FeedbackNotConfiguredError) {
      return withCookie(json({ error: 'AI help is not configured' }, 501), auth.refreshCookie);
    }
    throw error;
  }

  const topic = getContentTopic(parsed.data.subjectId, parsed.data.topicId);
  if (!topic) return withCookie(json({ error: 'not_found' }, 404), auth.refreshCookie);
  const notes = topic.notes.map((note) => `${note.heading}: ${note.body}`).join('\n');

  const monthKey = aiMarkMonthKey(deps.clock());
  let tier = auth.user.tier;
  if (deps.testMode && deps.dummyMode) {
    if (typeof _testAiHelpUsed === 'number' && Number.isInteger(_testAiHelpUsed) && _testAiHelpUsed >= 0 && _testAiHelpUsed <= 1000) {
      await deps.storage.setAiHelpCount?.(auth.user.userId, monthKey, _testAiHelpUsed);
    }
    const injectedTier = tierSchema.safeParse(_testTier);
    if (injectedTier.success) tier = injectedTier.data;
  }
  const allowed = await deps.storage.incrementAiHelpCount(auth.user.userId, aiHelpQuotaForTier(tier), monthKey);
  if (!allowed) {
    return withCookie(json({ error: 'quota_exceeded', resetAt: aiMarkResetAt(deps.clock()) }, 429), auth.refreshCookie);
  }

  try {
    const injected = deps.testMode && deps.dummyMode && _testResponse !== undefined;
    const startedAt = deps.clock();
    const raw = injected
      ? _testResponse
      : await provider.help(parsed.data, { topicTitle: topic.title, year: topic.year, notes });
    const result = aiHelpResultSchema.parse(raw);
    if (!injected) {
      const usage = aiHelpUsageSchema.safeParse((raw as { usage?: unknown }).usage);
      console.info('[ai-help] completion', JSON.stringify({
        action: parsed.data.action,
        subjectId: parsed.data.subjectId,
        topicId: parsed.data.topicId,
        latencyMs: Math.max(0, deps.clock() - startedAt),
        ...(usage.success ? usage.data : {}),
      }));
    }
    return withCookie(json(result), auth.refreshCookie);
  } catch (error) {
    return withCookie(json({
      error: 'AI provider failed',
      detail: error instanceof Error ? error.message : String(error),
    }, 502), auth.refreshCookie);
  }
}
