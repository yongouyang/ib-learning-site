import { describe, it, expect } from 'vitest';
import {
  handleRequestOtp,
  handleVerifyOtp,
  handleLogout,
  handleMe,
  handleAccountPost,
  handleSessionsGet,
  handleRevokeSession,
  handleExportGet,
  handleDeleteAccount,
} from '@/lib/auth/http-handler';

// The routes delegate 1:1 to these handlers (tested in depth in
// auth-http-handler.test.ts with injected deps). These smoke tests call the
// handlers with the DEFAULT deps (getAuthDeps() → in-memory dummy wiring) —
// the same wiring the routes/dev server use. NOTE: importing the route
// modules themselves from unit tests breaks build:static — the script stashes
// src/app/api aside during the export build and the imports stop resolving
// (same convention as tests/unit/api-feedback.test.ts).

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('auth handlers with default dummy deps (the route wiring)', () => {
  it('request-otp → 200 with the anti-enumeration message', async () => {
    const res = await handleRequestOtp(jsonRequest('POST', 'http://localhost/api/auth/request-otp', { email: 'route@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'If an account exists, a code has been sent.' });
  });

  it('verify-otp → 400 without a requested code', async () => {
    const res = await handleVerifyOtp(jsonRequest('POST', 'http://localhost/api/auth/verify-otp', { email: 'route@example.com', otp: '123456' }));
    expect(res.status).toBe(400);
  });

  it('me → 401 unauthenticated', async () => {
    const res = await handleMe(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('logout → 200 even without a cookie', async () => {
    const res = await handleLogout(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
  });

  it('account → 401 unauthenticated', async () => {
    const res = await handleAccountPost(jsonRequest('POST', 'http://localhost/api/auth/account', { displayName: 'X' }));
    expect(res.status).toBe(401);
  });

  it('sessions → 401 unauthenticated', async () => {
    const res = await handleSessionsGet(new Request('http://localhost/api/auth/sessions'));
    expect(res.status).toBe(401);
  });

  it('revoke → 401 unauthenticated', async () => {
    const res = await handleRevokeSession(jsonRequest('POST', 'http://localhost/api/auth/sessions/revoke', { sessionId: 'x' }));
    expect(res.status).toBe(401);
  });

  it('export → 401 unauthenticated', async () => {
    const res = await handleExportGet(new Request('http://localhost/api/auth/export'));
    expect(res.status).toBe(401);
  });

  it('delete → 401 unauthenticated', async () => {
    const res = await handleDeleteAccount(new Request('http://localhost/api/auth/delete', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});
