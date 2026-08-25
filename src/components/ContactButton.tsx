'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Feature 3 — Contact Us (docs/supportability-features-plan.md §"Frontend
// (ContactButton)"). Floating help button (bottom-left, above the mobile nav,
// clear of the top-right account/theme cluster) opening a modal form that
// POSTs to /api/contact. The endpoint is public and rate-limited per IP;
// a resolved session only attributes the message, and pre-fills name/email.

// Mirrors the server contract in src/lib/contact/types.ts — kept local so the
// client bundle doesn't pull in the zod schema module.
const MESSAGE_MAX = 2000;

const SUBJECTS = [
  { value: 'bug_report', label: 'Bug report' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
] as const;

type Subject = (typeof SUBJECTS)[number]['value'];

// The login form's input styling — one shared look for form fields.
const inputClass =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

// Server 400 issues look like "name: String must contain at least 1
// character(s)" — readable but not in our voice. Map them to friendly copy.
function friendlyIssue(raw: string): string {
  const sep = raw.indexOf(': ');
  const field = sep === -1 ? '' : raw.slice(0, sep);
  const detail = sep === -1 ? raw : raw.slice(sep + 2);
  const tooLong = detail.includes('at most');
  switch (field) {
    case 'name':
      return tooLong ? 'Keep your name under 100 characters.' : 'Tell us your name.';
    case 'email':
      return 'That email address doesn’t look right.';
    case 'subject':
      return 'Choose what your message is about.';
    case 'message':
      return tooLong ? `Keep your message under ${MESSAGE_MAX.toLocaleString()} characters.` : 'Write your message first.';
    default:
      return raw;
  }
}

export function ContactButton() {
  const { user, activeProfile } = useAuth();
  const [open, setOpen] = useState(false);
  // Enter-animation flag: the panel mounts off-canvas and slides up (mobile) /
  // settles (desktop) on the next frame. Gated on motion-safe.
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<Subject>('question');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    // Fresh form on every open; logged-in users get name/email pre-filled.
    setName(activeProfile?.displayName ?? user?.displayName ?? '');
    setEmail(user?.email ?? '');
    setSubject('question');
    setMessage('');
    setError(null);
    setSubmitting(false);
    setOpen(true);
  }, [user, activeProfile]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setMounted(false);
    // Return focus to the trigger so keyboard users aren't dropped at the top
    // of the page (the AccountButton popover convention).
    triggerRef.current?.focus();
  }, []);

  // Enter animation + initial focus + scroll lock while the modal is open.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    nameInputRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape closes; Tab/Shift+Tab cycle inside the dialog (focus trap).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeModal]);

  // Success toast auto-dismisses.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (res.ok) {
        closeModal();
        setToast('Message sent — we’ll be in touch soon.');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      const body = (data ?? {}) as { error?: string; issues?: string[] };
      if (res.status === 400 && Array.isArray(body.issues) && body.issues.length > 0) {
        setError(body.issues.map(friendlyIssue));
      } else {
        // 429's "Too many messages — try again later" and any other server
        // error surface as-is; the copy is already user-facing.
        setError([body.error ?? 'Something went wrong — please try again.']);
      }
    } catch {
      setError(['No connection — your message wasn’t sent. Try again when you’re back online.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        aria-label="Get help"
        aria-expanded={open}
        aria-controls="contact-dialog"
        className="group fixed bottom-20 left-4 md:bottom-4 z-40 flex h-11 items-center gap-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm pl-[11px] pr-[11px] text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <CircleHelp className="w-6 h-6 shrink-0" aria-hidden="true" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 motion-safe:transition-all group-hover:max-w-16 group-hover:opacity-100">
          Help
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Backdrop — click closes, same outcome as Escape. */}
          <div
            className={`absolute inset-0 bg-gray-950/40 motion-safe:transition-opacity ${mounted ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeModal}
          />
          <div
            ref={panelRef}
            role="dialog"
            id="contact-dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            className={`relative w-full md:max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-2xl md:rounded-2xl shadow-lg p-6 motion-safe:transition-transform ${mounted ? 'translate-y-0' : 'translate-y-full md:translate-y-4'}`}
          >
            <h2 id="contact-title" className="text-xl font-bold text-gray-900 dark:text-gray-50">
              Contact us
            </h2>
            <p className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-400">
              Spotted a bug or have a question? Send us a message — we read every one.
            </p>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close contact form"
              className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Name
                </label>
                <input
                  ref={nameInputRef}
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Subject
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as Subject)}
                  className={inputClass}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MESSAGE_MAX}
                  rows={4}
                  aria-describedby="contact-message-count"
                  className={`${inputClass} resize-y`}
                />
                <p id="contact-message-count" className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                  {message.length} / {MESSAGE_MAX.toLocaleString()}
                </p>
              </div>

              {error && (
                <div role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error.length === 1 ? (
                    <p>{error[0]}</p>
                  ) : (
                    <ul className="list-disc pl-5 space-y-0.5">
                      {error.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success toast — informational only (no actions), so fully
          pointer-events-none: it must never intercept a click beneath it. */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-16 md:bottom-0 z-50 flex justify-center px-4 pb-3"
        >
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm text-gray-50 shadow-lg dark:bg-gray-100 dark:text-gray-900">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
