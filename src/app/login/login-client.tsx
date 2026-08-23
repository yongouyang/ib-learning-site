'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { requestOtp } from '@/lib/auth-client';
import { sanitizeReturnPath } from '@/lib/safe-redirect';
import { trackEvent } from '@/lib/analytics';

// Analytics auth events carry the email DOMAIN only — never the address. A
// null return means "no valid domain" (e.g. the user hasn't typed '@' yet).
function emailDomainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return /^[A-Za-z0-9.-]+$/.test(domain) ? domain : null;
}

const inputClass =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export default function LoginClient() {
  const { user, loaded, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Post-login return URL (`/login?next=...`) — sign-in prompts (AI marking,
  // analytics dashboard, header) link here so users land back where they came
  // from instead of `/`. Untrusted input: sanitizeReturnPath only ever returns
  // a same-site path.
  const returnTo = useMemo(() => sanitizeReturnPath(searchParams.get('next')), [searchParams]);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Resend cooldown (review M5c): 30s between code sends — two impatient
  // clicks used to burn 2 of the 3-per-10-min budget and self-lock the user.
  const RESEND_COOLDOWN_MS = 30_000;
  const [resendAllowedAt, setResendAllowedAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loaded && user) router.replace(returnTo);
  }, [loaded, user, router, returnTo]);

  async function handleRequestCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const domain = emailDomainOf(email);
    if (domain) trackEvent('auth_otp_requested', { emailDomain: domain });
    try {
      await requestOtp(email);
      setResendAllowedAt(Date.now() + RESEND_COOLDOWN_MS);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const next = await login(email, code);
      trackEvent('auth_login_completed', { role: next.role });
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    const domain = emailDomainOf(email);
    if (domain) trackEvent('auth_otp_requested', { emailDomain: domain });
    try {
      await requestOtp(email);
      setResendAllowedAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  // While the session round-trip runs, show a card-shaped skeleton (NOT a
  // blank page — the guidelines forbid the jarring full-block swap). The card
  // shell is stable, so the skeleton→form swap shifts nothing. Signed-in
  // users then redirect before the form ever appears.
  if (!loaded) {
    return <LoginSkeleton />;
  }
  if (loaded && user) return null; // redirecting — avoid a flash of the form

  return (
    <div className="max-w-2xl mx-auto px-4 pt-20 pb-6 md:py-6">
      {/* pt-20 on mobile clears the fixed top-right account/theme pill so it
          doesn't overlap the card's corner. */}
      <div className="max-w-md mx-auto">
        <div className="card p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Sign in</h1>

          {step === 'email' ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Pick up where you left off — your progress follows you on every device.
              </p>
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className={inputClass}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? 'Sending…' : 'Send sign-in code'}
                </button>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">No password needed</p>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Enter the 6-digit code we emailed to {email}.
              </p>
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    6-digit code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]*"
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ''));
                      if (error) setError(null);
                    }}
                    className={`${inputClass} text-center tracking-widest text-lg`}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? 'Verifying…' : 'Verify code'}
                </button>
              </form>

              <div className="mt-4 flex flex-col">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || nowTick < resendAllowedAt}
                  className="inline-flex items-center justify-start py-2 min-h-[44px] text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-60 transition-colors"
                >
                  {resending
                    ? 'Sending…'
                    : nowTick < resendAllowedAt
                      ? `Resend code (${Math.ceil((resendAllowedAt - nowTick) / 1000)}s)`
                      : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                  className="inline-flex items-center justify-start py-2 min-h-[44px] text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Card-shaped skeleton — also the Suspense fallback in page.tsx, so the
// prerendered HTML, the hydration swap and the session round-trip all show
// the same stable shape (no jarring full-block swap).
export function LoginSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-20 pb-6 md:py-6">
      <div className="max-w-md mx-auto">
        <div className="card p-6" aria-hidden="true">
          <div className="h-7 w-24 bg-gray-100 dark:bg-gray-800 rounded mb-6" />
          <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded mb-3" />
          <div className="h-11 w-full bg-gray-100 dark:bg-gray-800 rounded-xl mb-4" />
          <div className="h-11 w-full bg-blue-100 dark:bg-blue-950 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
