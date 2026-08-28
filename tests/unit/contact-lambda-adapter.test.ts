import { describe, it, expect, afterEach, vi } from 'vitest';
import { handler } from '../../lambda/contact/index';

// Adapter tests (mirrors admin-lambda-adapter.test.ts): the Lambda Function
// URL event shape → shared contact handler. Covers routing, method guards,
// the public POST, the unauth public _health, and the controlled 500.

function event(partial: {
  rawPath?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}) {
  return {
    rawPath: partial.rawPath ?? '/api/contact',
    headers: { host: 'lambda.test', ...(partial.headers ?? {}) },
    requestContext: { http: { method: partial.method ?? 'POST' } },
    body: partial.body,
  };
}

describe('lambda/contact adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handler(event({ rawPath: '/api/nope' }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await handler(event({ rawPath: '/api/contact', method: 'GET' }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' });
  });

  it('POST /api/contact → 200 {success:true} (public; dummy wiring)', async () => {
    const res = await handler(
      event({
        headers: { 'x-forwarded-for': '9.9.9.9' },
        body: JSON.stringify({
          name: 'Ada',
          email: 'ada@example.com',
          subject: 'question',
          message: 'How do I reset my progress?',
        }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it('GET /api/contact/_health → 200 {ok:true} (public probe)', async () => {
    const res = await handler(event({ rawPath: '/api/contact/_health', method: 'GET' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('converts a deps failure into a controlled JSON 500', async () => {
    vi.stubEnv('CONTACT_STORAGE', 'dynamodb');
    // No table names → getContactDeps throws inside the handler → the
    // adapter's catch converts it to the uniform 500 shape.
    const res = await handler(event({ rawPath: '/api/contact/_health', method: 'GET' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal error' });
  });
});
