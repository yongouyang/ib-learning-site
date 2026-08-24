'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { FeatureId } from '@/lib/entitlements/features';

// Phase E1 — client access to the session's entitlements
// (docs/entitlement-implementation-plan.md). Populated from the me() payload
// via AuthContext — the server derives the list from the user's tier and is
// the ONE source of truth. Client gating is UX ONLY (entitlement-policy
// §Enforcement): every premium API re-checks server-side from the session.
//
// Anonymous users have NO entitlements — Tier-0 content (notes, flashcards,
// quizzes, diagnostics) is never gated, so it needs no feature flag.
// `loaded` settles with AuthContext's authLoaded: until the first me()
// round-trip completes, gates must not flash a locked state over content the
// user may be entitled to (LockedFeature renders children while !loaded).
//
// Dev/e2e run against the shared dummy auth universe (deterministic: fresh
// dummy accounts are tier "free"); unit tests inject arbitrary lists by
// mocking auth-client's me() — the standing per-test injection pattern.

interface EntitlementsContextType {
  entitlements: FeatureId[];
  /** False until the first me() round-trip completes (mirrors AuthContext.loaded). */
  loaded: boolean;
  has: (feature: FeatureId) => boolean;
}

const EntitlementsContext = createContext<EntitlementsContextType | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { entitlements, loaded } = useAuth();
  const has = useCallback((feature: FeatureId) => entitlements.includes(feature), [entitlements]);
  return (
    <EntitlementsContext.Provider value={{ entitlements, loaded, has }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('useEntitlements must be used within EntitlementsProvider');
  return ctx;
}
