'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  AuthUser,
  ChildProfile,
  me as meRequest,
  verifyOtp,
  logout as logoutRequest,
  updateAccount as updateAccountRequest,
} from '@/lib/auth-client';

// The account's active profile is a UI preference (which child's view you're
// in) — persisted locally, following the `octav_*` key convention for accounts.
const ACTIVE_PROFILE_KEY = 'octav_active_profile';

interface AuthContextType {
  user: AuthUser | null;
  /** False until the first me() round-trip completes (after mount). */
  loaded: boolean;
  activeProfileId: string | null;
  activeProfile: ChildProfile | null;
  login: (email: string, otp: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateAccount: (payload: { displayName?: string; childProfiles?: ChildProfile[] }) => Promise<AuthUser>;
  setActiveProfile: (profileId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await meRequest();
    setUser(next);
    setLoaded(true);
  }, []);

  // Same SSR-defaults + useEffect-load convention as ProgressContext: first
  // paint is always the logged-out state, then the real session swaps in.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore storage errors (e.g. private mode)
    }
    setActiveProfileId(stored);
    refresh();
  }, [refresh]);

  // Falls back to the first profile (the auto-created "Me") when the stored id
  // is missing or no longer present in the profile list.
  const activeProfile =
    user && user.childProfiles.length > 0
      ? user.childProfiles.find((p) => p.profileId === activeProfileId) ?? user.childProfiles[0]
      : null;

  const login = useCallback(async (email: string, otp: string): Promise<AuthUser> => {
    const next = await verifyOtp(email, otp);
    setUser(next);
    setLoaded(true);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setActiveProfileId(null);
    try {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updateAccount = useCallback(
    async (payload: { displayName?: string; childProfiles?: ChildProfile[] }): Promise<AuthUser> => {
      const next = await updateAccountRequest(payload);
      setUser(next);
      return next;
    },
    []
  );

  const setActiveProfile = useCallback(
    (profileId: string) => {
      const profiles = user?.childProfiles ?? [];
      if (profiles.length === 0) return;
      // Validate against the current user's profiles, clamping unknown ids to
      // the first profile before persisting.
      const valid = profiles.some((p) => p.profileId === profileId) ? profileId : profiles[0].profileId;
      setActiveProfileId(valid);
      try {
        localStorage.setItem(ACTIVE_PROFILE_KEY, valid);
      } catch {
        // Ignore storage errors
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, loaded, activeProfileId, activeProfile, login, logout, refresh, updateAccount, setActiveProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
