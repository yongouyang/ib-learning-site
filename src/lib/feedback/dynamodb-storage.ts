import {
  GetCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import type { SessionRecord, UserRecord } from '../auth/types';
import {
  AI_MARK_BUCKET_TTL_SECONDS,
  aiMarkBucket,
  type FeedbackStorage,
} from './types';

// Production feedback adapter (Phase E2): the FeedbackStorage contract on the
// Phase 0 tables. The session-validation subset is delegated to the SAME
// DynamoSessionStorage the auth/progress/analytics Lambdas use (one source of
// truth), and the monthly AI-mark quota is a fixed-window bucket in
// octav-rate-limits — one conditional UpdateCommand, atomic and idempotent,
// exactly the incrementOtpRequestCount / incrementProgressSyncCount pattern.
// The calendar month is IN the bucket key, so the quota resets atomically when
// the month rolls — no dependence on TTL deletion (best-effort, ~48h lag);
// the TTL is cleanup only.

interface TableNames {
  users: string;
  sessions: string;
  rateLimits: string;
}

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoFeedbackStorage implements FeedbackStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: DynamoSessionStorage,
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

  // --- Monthly AI-mark quota (octav-rate-limits) -------------------------------

  async incrementAiMarkCount(userId: string, limit: number, monthKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket: aiMarkBucket(userId, monthKey) },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: marks 1..limit succeed
          // and limit+1 fails — but only within THIS month's bucket.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': Math.floor(this.clock() / 1000) + AI_MARK_BUCKET_TTL_SECONDS,
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async getAiMarkCount(userId: string, monthKey: string): Promise<number> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tables.rateLimits,
        Key: { bucket: aiMarkBucket(userId, monthKey) },
      })
    );
    const count = (res.Item as { count?: number } | undefined)?.count;
    return typeof count === 'number' ? count : 0;
  }
}
