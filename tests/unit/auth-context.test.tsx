import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const USER = {
  userId: 'u1',
  email: 'a@example.com',
  displayName: 'Alex',
  role: 'parent' as const,
  childProfiles: [
    { profileId: 'p1', displayName: 'Me', stage: 'ks3' as const },
    { profileId: 'p2', displayName: 'Kid', stage: 'igcse' as const },
  ],
};

const { meMock, verifyOtpMock, logoutMock, updateAccountMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  logoutMock: vi.fn(),
  updateAccountMock: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  me: meMock,
  verifyOtp: verifyOtpMock,
  logout: logoutMock,
  updateAccount: updateAccountMock,
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
    meMock.mockResolvedValue(USER);
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
    meMock.mockResolvedValue(USER);
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
    meMock.mockResolvedValue(USER);
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
    meMock.mockResolvedValue(USER);
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
});
