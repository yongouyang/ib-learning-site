import { z } from 'zod';
import type { SessionRecord, UserRecord } from '../auth/types';

// Feature 3 — Contact Us (docs/supportability-features-plan.md §"Feature 3").
// Data model: single items on octav-contact (PK messageId, TTL expiresAt =
// createdAt + 365 days) + a per-IP fixed-window rate budget on
// octav-rate-limits (bucket contact:<ip>:<epoch> — the auth/analytics limiter
// pattern, window epoch IN the key so the counter resets atomically on
// rollover). The endpoint is PUBLIC (logged-out users can ask for help); a
// resolved session only attributes the message (userId).

// --- Budgets / constants --------------------------------------------------------

export const CONTACT_NAME_MAX = 100;
export const CONTACT_MESSAGE_MAX = 2000;
/** Body budget: name+email+subject+message plus JSON envelope overhead. */
export const CONTACT_MAX_BODY_BYTES = 8192;
export const CONTACT_MESSAGES_PER_WINDOW = 3;
export const CONTACT_WINDOW_SECONDS = 3600; // 1 hour
export const CONTACT_TTL_DAYS = 365;

export const CONTACT_SUBJECTS = ['bug_report', 'feature_request', 'question', 'other'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_STATUSES = ['new', 'read', 'replied', 'spam'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

// --- Wire schema (POST /api/contact) --------------------------------------------

export const contactRequestSchema = z.object({
  // trim() makes whitespace-only values fail min(1).
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX),
  // Same email rule as the auth schema (zod v4 format check; stored lowercased).
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;

// --- Storage item ----------------------------------------------------------------

/** The octav-contact item (one row per message, PK messageId). */
export interface ContactMessage {
  /** UUID v4 — the partition key. */
  messageId: string;
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  /** Null for anonymous submitters; the session user's id when logged in. */
  userId: string | null;
  /** ISO-8601 — from the SERVER clock (client dates are never trusted). */
  createdAt: string;
  /** "new" on ingest; read/replied/spam are set by the admin later. */
  status: ContactStatus;
  /** Epoch seconds — DynamoDB TTL (createdAt + 365 days). */
  expiresAt: number;
}

// --- Storage interface -----------------------------------------------------------

// Session-validation subset (one source of truth: src/lib/auth/session.ts)
// plus the contact ops. The dummy implements everything in one in-memory
// universe; the DynamoDB adapter delegates the session subset to
// DynamoSessionStorage.
export interface ContactStorage {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  /** Append a message (one PutCommand; messageId is a server-generated UUID). */
  saveContactMessage(message: ContactMessage): Promise<void>;
  /**
   * Fixed-window per-IP budget (octav-rate-limits): true = within budget,
   * false = limit reached for the current window.
   */
  incrementContactCount(ip: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** CI smoke probe: unauthenticated GetItem on a fixed probe key. The dummy resolves immediately. */
  probeContactTable(): Promise<void>;
}

// --- Pure helpers (shared by BOTH storage implementations — the parity lesson) ---

/** The window epoch for an epoch-ms instant. */
export function contactWindowEpoch(nowMs: number, windowSeconds: number = CONTACT_WINDOW_SECONDS): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

/** Bucket key `contact:<ip>:<epoch>` (octav-rate-limits PK). */
export function contactRateLimitBucket(ip: string, nowMs: number, windowSeconds: number = CONTACT_WINDOW_SECONDS): string {
  return `contact:${ip}:${contactWindowEpoch(nowMs, windowSeconds)}`;
}

/** TTL for a message row (epoch seconds): now + 365 days. */
export function contactMessageTtl(nowMs: number): number {
  return Math.floor(nowMs / 1000) + CONTACT_TTL_DAYS * 86_400;
}
