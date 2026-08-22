import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { EntitlementsProvider, useEntitlements } from '@/context/EntitlementsContext';
import type { FeatureId } from '@/lib/entitlements/features';

// EntitlementsProvider reads useAuth(), so the harness renders it inside
// AuthProvider with a mocked auth-client — per-test entitlement injection via
// the me() mock (the standing dummy-injection pattern).

const USER = {
  userId: 'u1',
  email: 'a@example.com',
  displayName: 'Alex',
  role: 'parent' as const,
  tier: 'free' as const,
  childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' as const }],
};

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
  me: meMock,
  verifyOtp: vi.fn(),
  logout: vi.fn(),
  updateAccount: vi.fn(),
  setOnUnauthorized: vi.fn(),
}));

// Mock localStorage (same pattern as auth-context.test.tsx).
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
});

let probe: ReturnType<typeof useEntitlements>;
function Probe() {
  probe = useEntitlements();
  return (
    <div>
      <span data-testid="loaded">{String(probe.loaded)}</span>
      <span data-testid="ai">{String(probe.has('ai-marking'))}</span>
      <span data-testid="unlimited">{String(probe.has('ai-marking-unlimited'))}</span>
      <span data-testid="exams">{String(probe.has('exam-sets-full'))}</span>
    </div>
  );
}

function renderProviders() {
  return render(
    <AuthProvider>
      <EntitlementsProvider>
        <Probe />
      </EntitlementsProvider>
    </AuthProvider>
  );
}

describe('EntitlementsContext', () => {
  it('logged out: no entitlements once auth settles', async () => {
    meMock.mockResolvedValue(null);
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(probe.entitlements).toEqual([]);
    expect(screen.getByTestId('ai').textContent).toBe('false');
    expect(screen.getByTestId('exams').textContent).toBe('false');
  });

  it('free user: ai-marking only', async () => {
    meMock.mockResolvedValue({ user: USER, entitlements: ['ai-marking'] satisfies FeatureId[] });
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('ai').textContent).toBe('true');
    expect(screen.getByTestId('unlimited').textContent).toBe('false');
    expect(screen.getByTestId('exams').textContent).toBe('false');
  });

  it('premium user: the full list', async () => {
    meMock.mockResolvedValue({
      user: { ...USER, tier: 'premium' },
      entitlements: ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'],
    });
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('ai').textContent).toBe('true');
    expect(screen.getByTestId('unlimited').textContent).toBe('true');
    expect(screen.getByTestId('exams').textContent).toBe('true');
  });

  it('settles with authLoaded: false until the first me() round-trip completes', async () => {
    let resolveMe: (v: unknown) => void = () => {};
    meMock.mockReturnValue(new Promise((res) => { resolveMe = res; }));
    renderProviders();

    expect(screen.getByTestId('loaded').textContent).toBe('false');
    resolveMe({ user: USER, entitlements: ['ai-marking'] });
    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(screen.getByTestId('ai').textContent).toBe('true');
  });

  it('a rejected me() settles loaded with no entitlements (logged-out fallback)', async () => {
    meMock.mockRejectedValue(new Error('lambda 500'));
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'));
    expect(probe.entitlements).toEqual([]);
    expect(screen.getByTestId('ai').textContent).toBe('false');
  });
});
