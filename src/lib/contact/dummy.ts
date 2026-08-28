import { InMemoryLeaderboardStorage } from '../leaderboard/dummy';
import type { ContactMessage, ContactStorage } from './types';
import { contactRateLimitBucket } from './types';

// In-memory contact dummy (Feature 3) — the controllable-dummy directive
// (AGENTS.md): dev and e2e run against this with zero AWS resources. It
// EXTENDS the leaderboard dummy (which extends feedback → analytics → progress
// → auth), so the ONE shared in-memory universe serves auth sessions, progress
// items, analytics events, the AI-mark quota, leaderboard rows AND contact
// messages — the dev/e2e stand-in for the shared DynamoDB tables: a dummy-OTP
// login resolves end-to-end for /api/contact (the message's userId). Every op
// mirrors the DynamoDB adapter's semantics EXACTLY (same fixed-window budget
// allow/deny via the shared pure helpers) — the parity test drives both
// against a simulated DynamoDB implementation.

export class InMemoryContactStorage extends InMemoryLeaderboardStorage implements ContactStorage {
  private readonly messages = new Map<string, ContactMessage>(); // messageId → row
  private readonly contactCounters = new Map<string, number>(); // bucket key → count
  // The base class's clock is private (and named clockFn there — a subclass
  // may not redeclare a base private name) — keep our own copy (seeded with
  // the SAME clock so the inherited fixed-window limiters and this one stay
  // aligned; the analytics dummy sets the precedent).
  private readonly contactClock: () => number;

  constructor(clock: () => number = Date.now) {
    super(clock);
    this.contactClock = clock;
  }

  async saveContactMessage(message: ContactMessage): Promise<void> {
    this.messages.set(message.messageId, { ...message });
  }

  async incrementContactCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window budget with the window epoch IN the key — mirrors the
    // DynamoDB bucket design: the counter resets atomically when the window
    // rolls (the previous bucket is simply never read again).
    const key = contactRateLimitBucket(ip, this.contactClock(), windowSeconds);
    const count = this.contactCounters.get(key) ?? 0;
    if (count >= limit) return false;
    this.contactCounters.set(key, count + 1);
    return true;
  }

  async probeContactTable(): Promise<void> {
    // The in-memory dummy has no IAM/table to fail — the probe is a no-op
    // (its DynamoDB counterpart performs the GetItem).
  }
}
