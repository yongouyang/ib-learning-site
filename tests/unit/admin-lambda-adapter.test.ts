import { describe, it, expect, afterEach, vi } from 'vitest';
import { handler } from '../../lambda/admin/index';

// Adapter tests (mirrors leaderboard-lambda-adapter.test.ts): the Lambda
// Function URL event shape → shared admin handler. Covers routing, method
// guards, the unauth 401 on the session-gated CRUD endpoint, the unauth public
// _health, and the controlled 500.

function event(partial: {
  rawPath?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}) {
  return {
    rawPath: partial.rawPath ?? '/api/admin/dynamodb',
    headers: { host: 'lambda.test', ...(partial.headers ?? {}) },
    requestContext: { http: { method: partial.method ?? 'POST' } },
    body: partial.body,
  };
}

describe('lambda/admin adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handler(event({ rawPath: '/api/nope' }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await handler(event({ rawPath: '/api/admin/dynamodb', method: 'GET' }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' });
  });

  it('GET /api/admin/_health → 200 {ok:true} (public probe)', async () => {
    const res = await handler(event({ rawPath: '/api/admin/_health', method: 'GET' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('POST /api/admin/dynamodb without a cookie → 401 (session-gated)', async () => {
    const res = await handler(
      event({ body: JSON.stringify({ operation: 'listTables' }) })
    );
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('GET /api/admin/access without a cookie → 401 (session-gated)', async () => {
    const res = await handler(event({ rawPath: '/api/admin/access', method: 'GET' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('converts a deps failure into a controlled JSON 500', async () => {
    vi.stubEnv('ADMIN_STORAGE', 'dynamodb');
    // No table names → getAdminDeps throws inside the handler → the adapter's
    // catch converts it to the uniform 500 shape.
    const res = await handler(event({ rawPath: '/api/admin/_health', method: 'GET' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal error' });
  });
});
