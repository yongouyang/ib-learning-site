import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAICompatibleProvider } from '@/lib/feedback/openai-compatible';
import type { MarkRequest } from '@/lib/feedback/types';

const REQ: MarkRequest = {
  stem: 'Work out $347 + 586$.',
  markscheme: ['M1: correct column-addition method', 'A1: 933'],
  modelAnswer: 'Column addition gives 933.',
  studentAnswer: 'I got 933 by column addition.',
  maxMarks: 2,
};

const VALID_LLM_JSON = JSON.stringify({
  perPoint: [
    { point: 'M1: correct column-addition method', awarded: true, comment: 'method shown' },
    { point: 'A1: 933', awarded: true, comment: 'correct value' },
  ],
  feedback: 'Full marks.',
});

function fetchReturning(content: string, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as unknown as typeof fetch;
}

function makeProvider() {
  return new OpenAICompatibleProvider({
    apiKey: 'sk-test',
    model: 'test-model',
    baseUrl: 'https://api.example.com/v1',
  });
}

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends an OpenAI-shaped request (auth, JSON mode, temperature 0)', async () => {
    const mock = fetchReturning(VALID_LLM_JSON);
    vi.stubGlobal('fetch', mock);
    await makeProvider().markAnswer(REQ);

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = (mock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('347 + 586');
    expect(body.messages[1].content).toContain('I got 933');
  });

  it('parses a valid response into the result shape', async () => {
    vi.stubGlobal('fetch', fetchReturning(VALID_LLM_JSON));
    const result = await makeProvider().markAnswer(REQ);
    expect(result.perPoint).toHaveLength(2);
    expect(result.perPoint[0]).toEqual({
      point: 'M1: correct column-addition method',
      awarded: true,
      comment: 'method shown',
    });
    expect(result.feedback).toBe('Full marks.');
  });

  it('retries once with a nudge when the first response is malformed', async () => {
    const mock = vi
      .fn()
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: VALID_LLM_JSON } }] }),
      }));
    vi.stubGlobal('fetch', mock as unknown as typeof fetch);

    const result = await makeProvider().markAnswer(REQ);
    expect(result.feedback).toBe('Full marks.');
    expect(mock).toHaveBeenCalledTimes(2);
    // The retry includes the malformed assistant turn + a JSON-only nudge.
    const retryBody = JSON.parse((mock.mock.calls[1][1] as { body: string }).body);
    expect(retryBody.messages).toHaveLength(4);
    expect(retryBody.messages[2]).toEqual({ role: 'assistant', content: 'not json at all' });
    expect(retryBody.messages[3].content).toContain('ONLY as the JSON object');
  });

  it('also retries on schema-invalid JSON, then throws after two failures', async () => {
    const mock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        // missing awarded/comment — fails the response schema
        choices: [{ message: { content: '{"perPoint":[{"point":"x"}]}' } }],
      }),
    }));
    vi.stubGlobal('fetch', mock as unknown as typeof fetch);

    await expect(makeProvider().markAnswer(REQ)).rejects.toThrow('malformed JSON twice');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('throws on a non-OK provider response', async () => {
    vi.stubGlobal('fetch', fetchReturning('', false, 500));
    await expect(makeProvider().markAnswer(REQ)).rejects.toThrow('provider responded 500');
  });

  it('throws when the provider returns no content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) })) as unknown as typeof fetch
    );
    await expect(makeProvider().markAnswer(REQ)).rejects.toThrow('no content');
  });
});
