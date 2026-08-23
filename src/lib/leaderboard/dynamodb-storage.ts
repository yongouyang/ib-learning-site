import {
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '../auth/types';
import {
  LEADERBOARD_USER_INDEX,
  OPEN_COHORT,
  scopeWeekPartitionKey,
  weekTtlEpochSeconds,
  type LeaderboardEntryItem,
  type LeaderboardScope,
  type LeaderboardStorage,
} from './types';

// Production leaderboard adapter (Phase D2): the LeaderboardStorage contract
// on the octav-leaderboard table (plan §5 — PK scopeWeek, SK entry, GSI
// user-index on userId). The session-validation subset is delegated to the
// SAME DynamoSessionStorage the auth/progress/analytics/feedback Lambdas use
// (one source of truth). Writes are ONE atomic UpdateCommand per earning
// event — `ADD xp :delta` plus set-if-absent identity/TTL attributes — so
// concurrent awards to the same (profile, scope, week) row never lose XP, and
// no conditional is needed (idempotency comes from the sync layer awarding
// only on accepted writes, plan §5). Unlike the other adapters this one needs
// no clock: expiresAt derives from the weekKey (weekTtlEpochSeconds) and
// lastEarnedAt arrives as an argument.

interface TableNames {
  users: string;
  sessions: string;
  leaderboard: string;
}

/** Session subset delegate (same implementation the auth handler uses). */
interface SessionSubset {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export class DynamoLeaderboardStorage implements LeaderboardStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: SessionSubset
  ) {}

  // --- Session subset (delegated — src/lib/auth/session.ts) --------------------

  getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessionStorage.getSession(sessionId);
  }

  getUserById(userId: string): Promise<UserRecord | null> {
    return this.sessionStorage.getUserById(userId);
  }

  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void> {
    return this.sessionStorage.updateSession(sessionId, updates);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.sessionStorage.deleteSession(sessionId);
  }

  // --- Board writes --------------------------------------------------------------

  async addXp(args: {
    userId: string;
    profileId: string;
    handle: string;
    scope: LeaderboardScope;
    weekKey: string;
    xp: number;
    earnedAt: string;
  }): Promise<void> {
    // Callers never pass xp ≤ 0 (the D4 hook skips zero awards); a
    // non-positive delta must not create a row.
    if (args.xp <= 0) return;
    await this.client.send(
      new UpdateCommand({
        TableName: this.tables.leaderboard,
        Key: { scopeWeek: scopeWeekPartitionKey(args.scope, args.weekKey), entry: args.profileId },
        // One atomic write: ADD accumulates xp; the identity/TTL attributes
        // are set-if-absent (first write wins — a profile's handle is stable
        // within the week); lastEarnedAt always moves to the latest award.
        UpdateExpression:
          'ADD xp :delta SET #h = if_not_exists(#h, :h), #u = if_not_exists(#u, :u), #c = if_not_exists(#c, :c), #e = if_not_exists(#e, :e), lastEarnedAt = :now',
        ExpressionAttributeNames: { '#h': 'handle', '#u': 'userId', '#c': 'cohortId', '#e': 'expiresAt' },
        ExpressionAttributeValues: {
          ':delta': args.xp,
          ':h': args.handle,
          ':u': args.userId,
          ':c': OPEN_COHORT,
          ':e': weekTtlEpochSeconds(args.weekKey),
          ':now': args.earnedAt,
        },
      })
    );
  }

  // --- Board reads ---------------------------------------------------------------

  async listBoard(scope: LeaderboardScope, weekKey: string): Promise<LeaderboardEntryItem[]> {
    // Paginated (the listProgressByUser lesson): a single Query page caps at
    // 1MB. Boards are tens-to-hundreds of items today (plan §5), but the loop
    // guarantees a large board is never silently truncated.
    const items: LeaderboardEntryItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tables.leaderboard,
          KeyConditionExpression: 'scopeWeek = :sw',
          ExpressionAttributeValues: { ':sw': scopeWeekPartitionKey(scope, weekKey) },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      items.push(...((res.Items ?? []) as LeaderboardEntryItem[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  // --- Erasure (plan §7/§8) --------------------------------------------------------

  async deleteEntriesByUser(userId: string, profileId?: string): Promise<void> {
    // Query the user-index GSI (paginated — never truncated), then DeleteItem
    // each matching row. The profileId narrowing (opt-out deletes one child's
    // rows; account deletion passes no profileId) is applied in code — a
    // user's rows are few, so a FilterExpression would buy nothing.
    const matches: LeaderboardEntryItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tables.leaderboard,
          IndexName: LEADERBOARD_USER_INDEX,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      for (const item of (res.Items ?? []) as LeaderboardEntryItem[]) {
        if (profileId !== undefined && item.entry !== profileId) continue;
        matches.push(item);
      }
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    await Promise.all(
      matches.map((item) =>
        this.client.send(
          new DeleteCommand({
            TableName: this.tables.leaderboard,
            Key: { scopeWeek: item.scopeWeek, entry: item.entry },
          })
        )
      )
    );
  }

  // --- CI smoke probe ----------------------------------------------------------------

  async probeLeaderboardTable(): Promise<void> {
    // The progress/analytics _health pattern: Limit-1 Query on a key that
    // never exists. 200/void = the table AND the Query grant work;
    // AccessDenied/ResourceNotFound throws (the handler converts that into a
    // 500 for the smoke check).
    await this.client.send(
      new QueryCommand({
        TableName: this.tables.leaderboard,
        KeyConditionExpression: 'scopeWeek = :probe',
        ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
        Limit: 1,
      })
    );
  }
}
