import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { EntitlementsProvider } from '@/context/EntitlementsContext';
import { LockedFeature } from '@/components/LockedFeature';

// LockedFeature reads useEntitlements() → useAuth(), so the harness renders
// the real provider stack with a mocked auth-client (per-test me() injection).

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

function renderLocked() {
  return render(
    <AuthProvider>
      <EntitlementsProvider>
        <LockedFeature feature="exam-sets-full" title="Full exam sets" benefit="Every paper set, every course.">
          <button type="button">Start set 2</button>
        </LockedFeature>
      </EntitlementsProvider>
    </AuthProvider>
  );
}

describe('LockedFeature', () => {
  it('renders children untouched when the session has the feature', async () => {
    meMock.mockResolvedValue({ user: USER, entitlements: ['exam-sets-full'] });
    renderLocked();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start set 2' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Start set 2' })).toBeEnabled();
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('locks with benefit copy and a /pricing link when the feature is missing', async () => {
    meMock.mockResolvedValue({ user: USER, entitlements: ['ai-marking'] });
    renderLocked();

    // The lock card appears once auth settles…
    await waitFor(() => expect(screen.getByText('Premium')).toBeInTheDocument());
    expect(screen.getByText('Full exam sets')).toBeInTheDocument();
    expect(screen.getByText('Every paper set, every course.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'See Premium plans' });
    expect(link).toHaveAttribute('href', '/pricing');

    // …and the preview stays visible but inert: out of the tab order and
    // hidden from assistive tech (the button is inside the inert wrapper, so
    // getByRole no longer finds it).
    expect(screen.queryByRole('button', { name: 'Start set 2' })).toBeNull();
    const preview = screen.getByText('Start set 2').closest('div');
    expect(preview).toHaveAttribute('aria-hidden', 'true');
  });

  it('logged out (entitlements empty) renders the locked state', async () => {
    meMock.mockResolvedValue(null);
    renderLocked();

    await waitFor(() => expect(screen.getByText('Premium')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Start set 2' })).toBeNull();
  });

  it('while entitlements are still resolving, children render unlocked (no flash of the lock)', () => {
    meMock.mockReturnValue(new Promise(() => {})); // me() never settles
    renderLocked();

    // UX-only gate: never flash a lock over content the user may be entitled to.
    expect(screen.getByRole('button', { name: 'Start set 2' })).toBeEnabled();
    expect(screen.queryByText('Premium')).toBeNull();
  });

  it('compact mode swaps the benefit card for a small lock row linking to /pricing', async () => {
    meMock.mockResolvedValue({ user: USER, entitlements: [] });
    render(
      <AuthProvider>
        <EntitlementsProvider>
          <LockedFeature compact feature="exam-sets-full" title="Timed mock mode" benefit="Not shown in compact mode.">
            <button type="button">Start paper 1</button>
          </LockedFeature>
        </EntitlementsProvider>
      </AuthProvider>
    );

    // No full benefit card…
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Premium · Timed mock mode' })).toHaveAttribute('href', '/pricing')
    );
    expect(screen.queryByText('Not shown in compact mode.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'See Premium plans' })).toBeNull();
    // …and the preview still stays inert.
    expect(screen.queryByRole('button', { name: 'Start paper 1' })).toBeNull();
    expect(screen.getByText('Start paper 1').closest('div')).toHaveAttribute('aria-hidden', 'true');
  });
});
