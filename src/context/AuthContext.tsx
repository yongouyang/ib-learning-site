'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  AuthUser,
  ChildProfile,
  me as meRequest,
  verifyOtp,
  logout as logoutRequest,
  updateAccount as updateAccountRequest,
  setOnUnauthorized,
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
  // Generation counter (review H4): a me() that STARTED before a completed
  // login must never apply its (stale, likely null) result over the fresh
  // user. refresh() and login() both bump the generation when they start.
  const generation = useRef(0);

  const clearLocalSession = useCallback(() => {
    // Invalidate any in-flight me() — a slow one resolving after a logout or
    // a 401-clear must not re-apply a stale user (round 2).
    ++generation.current;
    setUser(null);
    setActiveProfileId(null);
    // The session is DEFINITIVELY cleared: settle `loaded` here so a logout
    // that races the initial me() can't strand the UI on the skeleton (the
    // superseded me() no longer settles it — refresh() guards on generation).
    setLoaded(true);
    try {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore storage errors (e.g. private mode)
    }
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    try {
      const next = await meRequest();
      if (gen !== generation.current) return; // superseded by a newer call
      setUser(next);
    } catch {
      // /me failures (network, 500, wrong Lambda) must not strand the UI on
      // the loading skeleton forever — treat as logged-out so the guard
      // redirects and the logged-out experience renders (review H4).
      if (gen === generation.current) setUser(null);
    } finally {
      // Settle `loaded` ONLY from the CURRENT generation. A superseded me()
      // must NOT flip it: its finally would briefly expose (loaded=true,
      // user=null) — which the ProgressContext identity effect reads as a
      // genuine logout and PURGES the pending sync queue on a plain reload
      // (StrictMode's second refresh() supersedes the first me() — round 2,
      // found by the reload e2e). Logout settles `loaded` itself via
      // clearLocalSession, so a superseded call can't strand the skeleton.
      if (gen === generation.current) setLoaded(true);
    }
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

  // Mid-session expiry (review M5a): any authenticated API call returning 401
  // clears the local login state — the account-page guard then redirects to
  // /login instead of showing an invisible dead session until reload.
  useEffect(() => {
    setOnUnauthorized(clearLocalSession);
    return () => setOnUnauthorized(null);
  }, [clearLocalSession]);

  // Falls back to the first profile (the auto-created "Me") when the stored id
  // is missing or no longer present in the profile list.
  const activeProfile =
    user && user.childProfiles.length > 0
      ? user.childProfiles.find((p) => p.profileId === activeProfileId) ?? user.childProfiles[0]
      : null;

  const login = useCallback(async (email: string, otp: string): Promise<AuthUser> => {
    ++generation.current; // invalidate any in-flight mount me() (review H4)
    const next = await verifyOtp(email, otp);
    setUser(next);
    setLoaded(true);
    return next;
  }, []);

  const logout = useCallback(async () => {
    let error: unknown = null;
    try {
      await logoutRequest();
    } catch (err) {
      // Clear local state regardless (review M5b) — a failed logout request
      // still ends the session from the UI's perspective; rethrow so callers
      // can surface it.
      error = err;
    }
    clearLocalSession();
    if (error) throw error;
  }, [clearLocalSession]);

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
