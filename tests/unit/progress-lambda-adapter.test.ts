import { describe, it, expect, afterEach, vi } from 'vitest';
import { handler } from '../../lambda/progress/index';
import { toLambdaResult } from '../../lambda/shared/lambda-adapter';

// Adapter tests: the Lambda Function URL event shape → shared progress
// handler. Covers routing, method guards, body gating, the unauth 401, the
// controlled 500, and the cookies-array Set-Cookie conversion (re-exported
// from the shared lambda-adapter).

function event(partial: {
  rawPath?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}) {
  return {
    rawPath: partial.rawPath ?? '/api/progress',
    headers: { host: 'lambda.test', ...(partial.headers ?? {}) },
    requestContext: { http: { method: partial.method ?? 'GET' } },
    body: partial.body,
  };
}

describe('lambda/progress adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handler(event({ rawPath: '/api/nope' }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await handler(event({ rawPath: '/api/progress', method: 'POST' }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' });
  });

  it('GET /api/progress/_health → 200 {ok:true}', async () => {
    const res = await handler(event({ rawPath: '/api/progress/_health' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('POST /api/progress/sync without a cookie → 401', async () => {
    const res = await handler(event({ rawPath: '/api/progress/sync', method: 'POST' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('ignores a body on GET (no Request constructor crash — the event body is gated)', async () => {
    const res = await handler(event({ rawPath: '/api/progress', method: 'GET', body: '{"x":1}' }));
    expect(res.statusCode).toBe(401); // unauth, but crucially no throw/500
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('converts a storage failure into a controlled JSON 500', async () => {
    vi.stubEnv('PROGRESS_STORAGE', 'dynamodb');
    // No table names → getProgressDeps throws inside the handler → the
    // adapter's catch converts it to the uniform 500 shape.
    const res = await handler(event({ rawPath: '/api/progress' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal error' });
  });

  it('emits Set-Cookie values in the HTTP API v2 cookies array (shared adapter)', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'octav_session=abc; Path=/; HttpOnly; Max-Age=2592000');
    const response = new Response(JSON.stringify({ ok: true }), { status: 200, headers });

    const result = await toLambdaResult(response);

    expect(result.statusCode).toBe(200);
    expect(result.headers['set-cookie']).toBeUndefined(); // folded out, not double-emitted
    expect(result.cookies).toHaveLength(1);
    expect(result.cookies![0]).toContain('octav_session=abc');
  });
});
