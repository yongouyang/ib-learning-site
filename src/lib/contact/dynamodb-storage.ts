import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '../auth/types';
import type { ContactMessage, ContactStorage } from './types';
import { contactRateLimitBucket, contactWindowEpoch } from './types';

// Production contact adapter (Feature 3, docs/supportability-features-plan.md):
// the ContactStorage contract on octav-contact (PK messageId, TTL expiresAt) +
// octav-rate-limits (PK bucket). The session-validation subset is delegated to
// the SAME DynamoSessionStorage the auth/progress/analytics Lambdas use (one
// source of truth — src/lib/auth/session.ts). The ingest budget mirrors the
// analytics fixed-window limiter exactly (window epoch in the bucket key, ONE
// conditional UpdateCommand).

interface TableNames {
  users: string;
  sessions: string;
  contact: string;
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

export class DynamoContactStorage implements ContactStorage {
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

  // --- Messages -----------------------------------------------------------------

  async saveContactMessage(message: ContactMessage): Promise<void> {
    // Append-only: the handler builds the full item (messageId is a
    // server-generated UUID v4, so no condition is needed).
    await this.client.send(
      new PutCommand({
        TableName: this.tables.contact,
        Item: { ...message },
      })
    );
  }

  // --- Rate budget (octav-rate-limits) -------------------------------------------

  async incrementContactCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the bucket key (the auth/
    // analytics limiter pattern): each window is a fresh item, so the counter
    // resets ATOMICALLY in a single UpdateCommand when the window rolls — no
    // dependence on TTL deletion (best-effort, up to ~48h lag).
    const nowMs = this.clock();
    const bucket = contactRateLimitBucket(ip, nowMs, windowSeconds);
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: messages 1..limit succeed
          // and limit+1 fails — but only within THIS window's bucket.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (contactWindowEpoch(nowMs, windowSeconds) + 1) * windowSeconds, // TTL: end of this epoch window
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async probeContactTable(): Promise<void> {
    // CI smoke: GetItem on a key that never exists. Void = the table AND the
    // IAM grant work; AccessDenied/ResourceNotFound throws (the handler
    // converts that into a 500 for the smoke check).
    await this.client.send(
      new GetCommand({
        TableName: this.tables.contact,
        Key: { messageId: '__health_probe_nonexistent__' },
      })
    );
  }
}
