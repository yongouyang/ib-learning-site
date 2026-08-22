import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  requestOtp,
  verifyOtp,
  logout,
  me,
  updateAccount,
  listSessions,
  revokeSession,
  exportData,
  deleteAccount,
  AuthApiError,
  setOnUnauthorized,
} from '@/lib/auth-client';

const fetchMock = vi.fn();

function jsonBody(body: unknown, status = 200, ok = status >= 200 && status < 300) {
  return { ok, status, json: async () => body };
}

const USER = {
  userId: 'u1',
  email: 'a@example.com',
  displayName: 'Alex',
  role: 'parent' as const,
  tier: 'free' as const,
  childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' as const }],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth-client', () => {
  it('requestOtp POSTs the email and returns the message (200)', async () => {
    fetchMock.mockResolvedValue(jsonBody({ message: 'sent' }));

    const result = await requestOtp('a@example.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/request-otp');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@example.com' });
    expect(result).toEqual({ message: 'sent' });
  });

  it('verifyOtp POSTs email+otp and returns the user', async () => {
    fetchMock.mockResolvedValue(jsonBody({ user: USER }));

    const user = await verifyOtp('a@example.com', '123456');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/verify-otp');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@example.com', otp: '123456' });
    expect(user).toEqual(USER);
  });

  it('logout POSTs to the logout endpoint', async () => {
    fetchMock.mockResolvedValue(jsonBody({ message: 'Logged out.' }));

    await logout();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('me() resolves null on 401', async () => {
    fetchMock.mockResolvedValue(jsonBody({ error: 'Not authenticated.' }, 401, false));

    await expect(me()).resolves.toBeNull();
  });

  it('me() returns the user and entitlements on 200 (E1)', async () => {
    fetchMock.mockResolvedValue(jsonBody({ user: USER, entitlements: ['ai-marking'] }));

    await expect(me()).resolves.toEqual({ user: USER, entitlements: ['ai-marking'] });
  });

  it('non-ok responses throw AuthApiError with the server message', async () => {
    fetchMock.mockResolvedValue(jsonBody({ error: 'Invalid or expired code.' }, 400, false));

    const err = await verifyOtp('a@example.com', '000000').catch((e) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Invalid or expired code.');
  });

  it('falls back to a generic message when the error body is unreadable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    const err = await me().catch((e) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.message).toBe('Something went wrong. Please try again.');
  });

  it('updateAccount POSTs the payload and returns the user', async () => {
    fetchMock.mockResolvedValue(jsonBody({ user: USER }));

    const user = await updateAccount({ displayName: 'New' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/account');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ displayName: 'New' });
    expect(user).toEqual(USER);
  });

  it('listSessions GETs and returns the sessions array', async () => {
    const sessions = [
      { sessionId: 's1', createdAt: 'x', lastAccessedAt: 'x', userAgent: 'Chrome', current: true },
    ];
    fetchMock.mockResolvedValue(jsonBody({ sessions }));

    await expect(listSessions()).resolves.toEqual(sessions);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/sessions');
  });

  it('revokeSession POSTs the sessionId', async () => {
    fetchMock.mockResolvedValue(jsonBody({ message: 'Session revoked.' }));

    await revokeSession('s1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/sessions/revoke');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ sessionId: 's1' });
  });

  it('exportData GETs the export endpoint', async () => {
    const payload = { exportedAt: 'now' };
    fetchMock.mockResolvedValue(jsonBody(payload));

    await expect(exportData()).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/export');
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it('deleteAccount POSTs to the delete endpoint', async () => {
    fetchMock.mockResolvedValue(jsonBody({ message: 'Account deleted.' }));

    await deleteAccount();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/delete');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('notifies the unauthorized handler when an authenticated call returns 401 (M5a)', async () => {
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);
    fetchMock.mockResolvedValue(jsonBody({ error: 'Not authenticated.' }, 401, false));

    await expect(updateAccount({ displayName: 'X' })).rejects.toBeInstanceOf(AuthApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    // Cleanup: other tests must not see this handler.
    setOnUnauthorized(null);
  });

  it('does not notify the unauthorized handler for non-401 failures', async () => {
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);
    fetchMock.mockResolvedValue(jsonBody({ error: 'Bad request' }, 400, false));

    await expect(updateAccount({ displayName: 'X' })).rejects.toBeInstanceOf(AuthApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();

    setOnUnauthorized(null);
  });
});
