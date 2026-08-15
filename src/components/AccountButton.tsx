'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronDown, CircleUserRound, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ChildProfile } from '@/lib/auth-client';

const STAGE_LABELS: Record<ChildProfile['stage'], string> = {
  ks3: 'KS3',
  igcse: 'IGCSE',
  dp: 'IB DP',
};

// Account entry point for both chrome variants. Logged out: a "Sign in" link
// (desktop) or icon button (mobile). Logged in: a dropdown with the active
// profile, the profile switcher, account settings and sign-out.
export function AccountButton({ variant }: { variant: 'desktop' | 'mobile' }) {
  const { user, activeProfile, setActiveProfile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Custom popover: close on click outside the trigger/menu or on Escape,
  // returning focus to the trigger (review low) so keyboard users don't get
  // dropped at the top of the page.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    close();
    try {
      await logout(); // clears local state regardless; rethrows on failure
    } catch (err) {
      // The UI is already logged out; surface the server-side failure so it
      // isn't silent — the cookie may still be valid until it expires.
      console.error('[auth] sign-out request failed:', err instanceof Error ? err.message : err);
    }
  }

  // Logged out (and the first-paint state while the session loads — same
  // hydration-swap convention as ProgressContext; no skeleton needed).
  if (!user) {
    if (variant === 'mobile') {
      return (
        <Link
          href="/login"
          aria-label="Sign in"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <UserRound className="w-6 h-6" aria-hidden="true" />
        </Link>
      );
    }
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const displayName = activeProfile?.displayName ?? user.displayName;

  const trigger =
    variant === 'mobile' ? (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls="account-menu"
        className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <CircleUserRound className="w-6 h-6" aria-hidden="true" />
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="account-menu"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="max-w-[12rem] truncate">{displayName}</span>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>
    );

  return (
    <div ref={containerRef} className="relative">
      {trigger}

      {/* Disclosure panel with plain tabbable buttons/links — no role="menu",
          which would demand the full ARIA menu keyboard contract (arrow keys,
          roving tabindex, focus management). A disclosure avoids that. */}
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          <div
            title={user.email}
            className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate border-b border-gray-100 dark:border-gray-800"
          >
            Signed in as {user.email}
          </div>

          <div className="py-1">
            {user.childProfiles.map((profile) => {
              const isActive = activeProfile?.profileId === profile.profileId;
              return (
                <button
                  key={profile.profileId}
                  type="button"
                  onClick={() => {
                    setActiveProfile(profile.profileId);
                    close();
                  }}
                  className={`w-full min-h-[44px] flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isActive
                      ? 'font-semibold text-gray-900 dark:text-gray-50'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate">{profile.displayName}</span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{STAGE_LABELS[profile.stage]}</span>
                  {isActive && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

          <Link
            href="/account"
            onClick={close}
            className="flex items-center min-h-[44px] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Account settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[44px] text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
