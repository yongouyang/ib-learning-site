import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const USER = {
  userId: 'u1',
  email: 'a@example.com',
  displayName: 'Alex',
  role: 'parent' as const,
  tier: 'free' as const,
  childProfiles: [
    { profileId: 'p1', displayName: 'Me', stage: 'ks3' as const },
    { profileId: 'p2', displayName: 'Kid', stage: 'igcse' as const },
  ],
};

// me() resolves the E1 payload shape: { user, entitlements }.
const meResult = (
  user: Omit<typeof USER, 'tier'> & { tier: 'free' | 'premium' },
  entitlements: string[] = ['ai-marking']
) => ({ user, entitlements });

const { meMock, verifyOtpMock, logoutMock, updateAccountMock, setOnUnauthorizedMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  logoutMock: vi.fn(),
  updateAccountMock: vi.fn(),
  setOnUnauthorizedMock: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  me: meMock,
  verifyOtp: verifyOtpMock,
  logout: logoutMock,
  updateAccount: updateAccountMock,
  setOnUnauthorized: setOnUnauthorizedMock,
}));

// Probe component that exposes the context value to assertions.
let probe: ReturnType<typeof useAuth>;
function Probe() {
  probe = useAuth();
  return (
    <div>
      <span data-testid="loaded">{String(probe.loaded)}</span>
      <span data-testid="user">{probe.user?.email ?? 'null'}</span>
      <span data-testid="active">{probe.activeProfile?.profileId ?? 'null'}</span>
      <span data-testid="entitlements">{probe.entitlements.join(',')}</span>
    </div>
  );
}

// Mock localStorage (same pattern as progress-context.test.tsx).
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
  meMock.mockReset();
  verifyOtpMock.mockReset();
  logoutMock.mockReset();
  updateAccountMock.mockReset();
  setOnUnauthorizedMock.mockReset();
});

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  it('starts logged out, then loads the session after mount (loaded flips)', async () => {
    meMock.mockResolvedValue(meResult(USER));
    renderProvider();

    expect(screen.getByTestId('loaded').textContent).toBe('false');
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('a@example.com');
    // No stored profile id → falls back to the first (auto-created "Me") profile.
    expect(screen.getByTestId('active').textContent).toBe('p1');
  });

  it('me() resolving null (401) leaves the user logged out', async () => {
    meMock.mockResolvedValue(null);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login() verifies and sets the user', async () => {
    meMock.mockResolvedValue(null);
    verifyOtpMock.mockResolvedValue(USER);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    let result: unknown;
    await act(async () => {
      result = await probe.login('a@example.com', '123456');
    });

    expect(verifyOtpMock).toHaveBeenCalledWith('a@example.com', '123456');
    expect(result).toEqual(USER);
    expect(screen.getByTestId('user').textContent).toBe('a@example.com');
  });

  it('logout() clears the user and the active-profile key', async () => {
    meMock.mockResolvedValue(meResult(USER));
    store['octav_active_profile'] = 'p1';
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    logoutMock.mockResolvedValue(undefined);
    await act(async () => {
      await probe.logout();
    });

    expect(logoutMock).toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(store['octav_active_profile']).toBeUndefined();
  });

  it('setActiveProfile persists and clamps unknown ids to the first profile', async () => {
    meMock.mockResolvedValue(meResult(USER));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    act(() => {
      probe.setActiveProfile('p2');
    });
    expect(store['octav_active_profile']).toBe('p2');
    expect(screen.getByTestId('active').textContent).toBe('p2');

    act(() => {
      probe.setActiveProfile('nope');
    });
    expect(store['octav_active_profile']).toBe('p1'); // clamped to first profile
    expect(screen.getByTestId('active').textContent).toBe('p1');
  });

  it('updateAccount passes through and sets the user', async () => {
    meMock.mockResolvedValue(meResult(USER));
    const updated = { ...USER, displayName: 'New Name' };
    updateAccountMock.mockResolvedValue(updated);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    await act(async () => {
      await probe.updateAccount({ displayName: 'New Name' });
    });

    expect(updateAccountMock).toHaveBeenCalledWith({ displayName: 'New Name' });
    expect(probe.user?.displayName).toBe('New Name');
  });

  it('a rejected me() still flips loaded and treats the user as logged out (H4)', async () => {
    meMock.mockRejectedValue(new Error('lambda 500'));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('a stale mount me() cannot overwrite a completed login (H4)', async () => {
    let resolveMe: (value: unknown) => void = () => {};
    meMock.mockReturnValue(new Promise((resolve) => { resolveMe = resolve; }));
    verifyOtpMock.mockResolvedValue(USER);
    renderProvider();

    // Login completes while the mount me() is still in flight.
    await act(async () => {
      await probe.login('a@example.com', '123456');
    });
    expect(screen.getByTestId('user').textContent).toBe('a@example.com');

    // The stale me() now resolves null — it must NOT clear the fresh user.
    await act(async () => {
      resolveMe(null);
      await Promise.resolve();
    });
    expect(screen.getByTestId('user').textContent).toBe('a@example.com');
  });

  it('an authenticated call returning 401 clears the user via the notification hook (M5a)', async () => {
    meMock.mockResolvedValue(meResult(USER));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('a@example.com');

    // The context registered a handler on mount.
    const handler = setOnUnauthorizedMock.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(handler).toBeTypeOf('function');

    act(() => {
      handler?.();
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(store['octav_active_profile']).toBeUndefined();
  });

  it('logout clears local state even when the server request fails (M5b)', async () => {
    meMock.mockResolvedValue(meResult(USER));
    store['octav_active_profile'] = 'p2';
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));

    logoutMock.mockRejectedValue(new Error('network down'));
    await act(async () => {
      await expect(probe.logout()).rejects.toThrow('network down');
    });

    // Local state is cleared regardless; the failure is surfaced to callers.
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(store['octav_active_profile']).toBeUndefined();
  });

  it('exposes the entitlements from the me() payload (E1)', async () => {
    meMock.mockResolvedValue(meResult({ ...USER, tier: 'premium' }, ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full']));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('entitlements').textContent).toBe('ai-marking,ai-marking-unlimited,exam-sets-full');
  });

  it('login() derives entitlements from the fresh user tier (verify-otp has no entitlements field)', async () => {
    meMock.mockResolvedValue(null);
    verifyOtpMock.mockResolvedValue({ ...USER, tier: 'premium' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('entitlements').textContent).toBe('');

    await act(async () => {
      await probe.login('a@example.com', '123456');
    });
    expect(screen.getByTestId('entitlements').textContent).toBe('ai-marking,ai-marking-unlimited,exam-sets-full');
  });

  it('logout clears the entitlements along with the user', async () => {
    meMock.mockResolvedValue(meResult(USER));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('entitlements').textContent).toBe('ai-marking');

    logoutMock.mockResolvedValue(undefined);
    await act(async () => {
      await probe.logout();
    });
    expect(screen.getByTestId('entitlements').textContent).toBe('');
  });

  it('a slow me() resolving after logout must not re-apply the user (round 2)', async () => {
    let resolveMe: (value: unknown) => void = () => {};
    meMock.mockReturnValue(new Promise((resolve) => { resolveMe = resolve; }));
    logoutMock.mockResolvedValue(undefined);
    renderProvider();

    // Log out while the mount me() is still in flight.
    await act(async () => {
      await probe.logout();
    });
    expect(screen.getByTestId('user').textContent).toBe('null');

    // The stale me() resolves with a user AFTER the logout — generation
    // bumping in clearLocalSession must discard it.
    await act(async () => {
      resolveMe(meResult(USER));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});
