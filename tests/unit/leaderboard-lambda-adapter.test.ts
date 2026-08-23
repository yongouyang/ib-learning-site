import { describe, it, expect, afterEach, vi } from 'vitest';
import { handler } from '../../lambda/leaderboard/index';

// Adapter tests (mirrors progress-lambda-adapter.test.ts): the Lambda Function
// URL event shape → shared leaderboard handler. Covers routing, method guards,
// the unauth 401 on the session-gated board, the PUBLIC teaser, the
// controlled 500, and query-string pass-through (the shared adapter's
// cookies-array Set-Cookie conversion is covered by the progress suite).

function event(partial: {
  rawPath?: string;
  rawQueryString?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}) {
  return {
    rawPath: partial.rawPath ?? '/api/leaderboard',
    rawQueryString: partial.rawQueryString,
    headers: { host: 'lambda.test', ...(partial.headers ?? {}) },
    requestContext: { http: { method: partial.method ?? 'GET' } },
    body: partial.body,
  };
}

describe('lambda/leaderboard adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handler(event({ rawPath: '/api/nope' }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await handler(event({ rawPath: '/api/leaderboard', method: 'POST' }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' });
  });

  it('GET /api/leaderboard/_health → 200 {ok:true}', async () => {
    const res = await handler(event({ rawPath: '/api/leaderboard/_health' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('GET /api/leaderboard without a cookie → 401 (session-gated)', async () => {
    const res = await handler(event({ rawPath: '/api/leaderboard' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('GET /api/leaderboard/teaser without a cookie → 200 (public), query string reaches the handler', async () => {
    const res = await handler(
      event({ rawPath: '/api/leaderboard/teaser', rawQueryString: 'scope=stage:dp' })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.scope).toBe('stage:dp');
    expect(body.top).toEqual([]);
  });

  it('converts a deps failure into a controlled JSON 500', async () => {
    vi.stubEnv('LEADERBOARD_STORAGE', 'dynamodb');
    // No table names → getLeaderboardDeps throws inside the handler → the
    // adapter's catch converts it to the uniform 500 shape.
    const res = await handler(event({ rawPath: '/api/leaderboard' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal error' });
  });
});
