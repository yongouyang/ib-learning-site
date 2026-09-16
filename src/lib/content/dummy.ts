import { InMemorySubscriptionsStorage } from '../subscriptions/dummy';
import type { ContentStorage } from './types';
import { contentRateLimitBucket } from './types';

// In-memory content dummy (Phase 1b) — the controllable-dummy directive (AGENTS.md): dev and e2e run
// against this with zero AWS resources. It EXTENDS the subscriptions dummy (the deepest link in the
// chain contact → leaderboard → analytics → feedback → progress → auth), so the ONE shared in-memory
// universe serves auth sessions, progress, analytics, the AI-mark quota, leaderboard rows, contact
// messages, billing state AND the content API's request budget — a dummy-OTP login resolves
// end-to-end, which is what lets the premium endpoint be exercised in e2e.
//
// The budget mirrors the DynamoDB adapter's semantics EXACTLY (same fixed-window allow/deny via the
// shared pure helper).

export class InMemoryContentStorage extends InMemorySubscriptionsStorage implements ContentStorage {
  private readonly contentCounters = new Map<string, number>(); // bucket key → count
  // The base class's clock is private, so keep our own copy seeded with the same one (the contact
  // and subscriptions dummies set the precedent) — inherited limiters stay aligned under a frozen
  // test clock.
  private readonly contentClock: () => number;

  constructor(clock: () => number = Date.now) {
    super(clock);
    this.contentClock = clock;
  }

  async incrementContentRequestCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = contentRateLimitBucket(ip, this.contentClock(), windowSeconds);
    const count = this.contentCounters.get(key) ?? 0;
    if (count >= limit) return false;
    this.contentCounters.set(key, count + 1);
    return true;
  }
}
