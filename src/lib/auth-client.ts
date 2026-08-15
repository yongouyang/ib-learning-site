// Phase B — client-side auth API wrapper. Thin fetch helpers over the
// /api/auth/* contract (see src/lib/auth/http-handler.ts for the server side).
// Plain fetch with same-origin credentials (the session cookie) and JSON bodies.

export type Stage = 'ks3' | 'igcse' | 'dp';

export interface ChildProfile {
  profileId: string;
  displayName: string;
  stage: Stage;
}

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'parent' | 'student';
  childProfiles: ChildProfile[];
}

export interface SessionInfo {
  sessionId: string;
  createdAt: string;
  lastAccessedAt: string;
  userAgent: string;
  current: boolean;
}

/** Non-2xx API response with the server's `{error}` message surfaced. */
export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<AuthApiError> {
  let message = 'Something went wrong. Please try again.';
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // Non-JSON error body — fall through to the generic message.
  }
  return new AuthApiError(message, res.status);
}

/** JSON request helper: throws AuthApiError on any non-ok status. */
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** POST /api/auth/request-otp — always 200 (anti-enumeration); 429 / 502 on limits/failure. */
export async function requestOtp(email: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** POST /api/auth/verify-otp — first login auto-creates the account. */
export async function verifyOtp(email: string, otp: string): Promise<AuthUser> {
  const body = await requestJson<{ user: AuthUser }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
  return body.user;
}

/** POST /api/auth/logout — clears the session cookie. */
export async function logout(): Promise<void> {
  await requestJson<{ message: string }>('/api/auth/logout', { method: 'POST' });
}

/** GET /api/auth/me — resolves null when unauthenticated (401). */
export async function me(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.status === 401) return null;
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

/** POST /api/auth/account — displayName and/or childProfiles (full replace). */
export async function updateAccount(payload: {
  displayName?: string;
  childProfiles?: ChildProfile[];
}): Promise<AuthUser> {
  const body = await requestJson<{ user: AuthUser }>('/api/auth/account', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return body.user;
}

/** GET /api/auth/sessions — the user's active sessions/devices. */
export async function listSessions(): Promise<SessionInfo[]> {
  const body = await requestJson<{ sessions: SessionInfo[] }>('/api/auth/sessions');
  return body.sessions;
}

/** POST /api/auth/sessions/revoke — revoking the current session clears the cookie. */
export async function revokeSession(sessionId: string): Promise<void> {
  await requestJson<{ message: string }>('/api/auth/sessions/revoke', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/** GET /api/auth/export — full data-portability payload. */
export async function exportData(): Promise<unknown> {
  return requestJson<unknown>('/api/auth/export');
}

/** POST /api/auth/delete — erases the account and clears the cookie. */
export async function deleteAccount(): Promise<void> {
  await requestJson<{ message: string }>('/api/auth/delete', { method: 'POST' });
}
