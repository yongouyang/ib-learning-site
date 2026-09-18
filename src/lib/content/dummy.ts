import { InMemorySubscriptionsStorage } from '../subscriptions/dummy';
import type { ContentBudgetResult, ContentStorage } from './types';
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

  async incrementContentRequestCount(
    scope: string,
    limit: number,
    windowSeconds: number,
  ): Promise<ContentBudgetResult> {
    const key = contentRateLimitBucket(scope, this.contentClock(), windowSeconds);
    const count = this.contentCounters.get(key) ?? 0;
    // Refused requests do NOT advance the counter, and report the cap — the DynamoDB adapter's
    // conditional update does not write either, so both sides agree exactly (parity pinned in
    // tests/unit/content-handler.test.ts).
    if (count >= limit) return { allowed: false, count: limit };
    this.contentCounters.set(key, count + 1);
    return { allowed: true, count: count + 1 };
  }
}
