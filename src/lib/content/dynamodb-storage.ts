import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '../auth/types';
import type { ContentStorage } from './types';
import { contentRateLimitBucket, contentWindowEpoch } from './types';

// Production content adapter (Phase 1b): the ContentStorage contract on
// octav-rate-limits only. There is NO content table — the topic and paper content is bundled into
// the Lambda at build time, so this class owns no data of its own and the IAM grant is the smallest
// in the repo (users GetItem, sessions Get/Update/Delete, rate-limits UpdateItem).
//
// The session-validation subset is delegated to the SAME DynamoSessionStorage the auth/progress/
// analytics/contact Lambdas use (one source of truth — src/lib/auth/session.ts). The public route's
// budget mirrors the analytics/contact fixed-window limiter exactly (window epoch in the bucket key,
// ONE conditional UpdateCommand).

interface TableNames {
  users: string;
  sessions: string;
  rateLimits: string;
}

/** Session subset delegate (same implementation the auth handler uses). */
interface SessionSubset {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoContentStorage implements ContentStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: SessionSubset,
    private readonly clock: () => number = Date.now
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

  // --- Rate budget (octav-rate-limits) -------------------------------------------

  async incrementContentRequestCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the bucket key (the auth/analytics/contact
    // pattern): each window is a fresh item, so the counter resets ATOMICALLY in a single
    // UpdateCommand when the window rolls — no dependence on TTL deletion (best-effort, up to ~48h).
    const nowMs = this.clock();
    const bucket = contentRateLimitBucket(ip, nowMs, windowSeconds);
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: requests 1..limit succeed and limit+1 fails —
          // but only within THIS window's bucket.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (contentWindowEpoch(nowMs, windowSeconds) + 1) * windowSeconds,
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }
}
