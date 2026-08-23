import { InMemoryFeedbackStorage } from '../feedback/dummy';
import {
  OPEN_COHORT,
  scopeWeekPartitionKey,
  weekTtlEpochSeconds,
  type LeaderboardEntryItem,
  type LeaderboardScope,
  type LeaderboardStorage,
} from './types';

// In-memory leaderboard dummy (Phase D2) — the controllable-dummy directive
// (AGENTS.md): dev and e2e run against this with zero AWS resources. It
// EXTENDS the feedback dummy (which extends analytics → progress → auth), so
// the ONE shared in-memory universe serves auth sessions, progress items,
// analytics events, the AI-mark quota AND leaderboard rows — the dev/e2e
// stand-in for the shared DynamoDB tables: a dummy-OTP login resolves
// end-to-end for the leaderboard routes (D3). Every op mirrors the DynamoDB
// adapter's semantics EXACTLY (ADD-if-absent attributes, lastEarnedAt always
// overwritten, xp accumulated) — the parity test drives both against a
// simulated DynamoDB implementation.

export class InMemoryLeaderboardStorage extends InMemoryFeedbackStorage implements LeaderboardStorage {
  // `${scopeWeek}${entry}` → row (the DDB PK/SK pair).
  private readonly entries = new Map<string, LeaderboardEntryItem>();

  async addXp(args: {
    userId: string;
    profileId: string;
    handle: string;
    scope: LeaderboardScope;
    weekKey: string;
    xp: number;
    earnedAt: string;
  }): Promise<void> {
    // Mirrors the adapter's early return: a non-positive delta must not create
    // a row (callers skip zero awards — D4).
    if (args.xp <= 0) return;
    const scopeWeek = scopeWeekPartitionKey(args.scope, args.weekKey);
    const key = `${scopeWeek} ${args.profileId}`;
    const existing = this.entries.get(key);
    // handle/userId/cohortId/expiresAt are set-if-absent (first write wins);
    // xp accumulates; lastEarnedAt is always overwritten.
    this.entries.set(key, {
      scopeWeek,
      entry: args.profileId,
      userId: existing?.userId ?? args.userId,
      handle: existing?.handle ?? args.handle,
      xp: (existing?.xp ?? 0) + args.xp,
      lastEarnedAt: args.earnedAt,
      cohortId: existing?.cohortId ?? OPEN_COHORT,
      expiresAt: existing?.expiresAt ?? weekTtlEpochSeconds(args.weekKey),
    });
  }

  async listBoard(scope: LeaderboardScope, weekKey: string): Promise<LeaderboardEntryItem[]> {
    const scopeWeek = scopeWeekPartitionKey(scope, weekKey);
    // Sorted by entry (the SK) to mirror the DDB Query's sort-key order;
    // copies, so callers can never mutate the stored rows.
    return [...this.entries.values()]
      .filter((i) => i.scopeWeek === scopeWeek)
      .sort((a, b) => a.entry.localeCompare(b.entry))
      .map((i) => ({ ...i }));
  }

  async deleteEntriesByUser(userId: string, profileId?: string): Promise<void> {
    // Mirrors the adapter: every row owned by userId (the user-index GSI
    // query), narrowed to one child profile when profileId is given.
    for (const [key, item] of [...this.entries]) {
      if (item.userId !== userId) continue;
      if (profileId !== undefined && item.entry !== profileId) continue;
      this.entries.delete(key);
    }
  }

  async probeLeaderboardTable(): Promise<void> {
    // The in-memory dummy has no IAM/table to fail — the probe is a no-op
    // (its DynamoDB counterpart performs the Limit-1 Query).
  }
}
