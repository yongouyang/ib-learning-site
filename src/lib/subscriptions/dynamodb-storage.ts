import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, SubscriptionFields, UserRecord } from '../auth/types';
import type { Tier } from '../entitlements/features';
import { subscriptionRateLimitBucket, type SubscriptionsStorage } from './types';

// Production subscriptions adapter (E4.2): the SubscriptionsStorage contract on
// the SAME tables every other Lambda uses. Session validation and the user-row
// write are DELEGATED to the existing DynamoSessionStorage / DynamoAuthStorage
// implementations (one source of truth for the session TTL slide, the
// per-field user merge and the tier default) — this class only adds the two
// things that are genuinely new to billing:
//
//   1. the webhook idempotency ledger (plan §6.4 rule 2), and
//   2. the per-user fixed-window session budget (plan §6.5).
//
// Both live in octav-rate-limits, which is why the module needs PutItem there
// in addition to the UpdateItem the other limiters use.

interface TableNames {
  users: string;
  sessions: string;
  rateLimits: string;
}

/** Session subset delegate (the same implementation the auth handler uses). */
interface SessionSubset {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

/** User-row writer delegate (DynamoAuthStorage.updateUser — merges only the
 *  fields present, so a billing write can never blank displayName/profiles). */
interface UserWriter {
  updateUser(
    userId: string,
    updates: { childProfiles?: unknown; displayName?: string } & SubscriptionFields & { tier?: Tier }
  ): Promise<UserRecord | null>;
}

/**
 * Webhook-ledger key prefix in octav-rate-limits. Stripe retries a delivery
 * for up to ~3 days; the TTL is 30 days so a very late replay is still a
 * no-op. TTL deletion is best-effort (hours of lag) — correctness comes from
 * the conditional write, not from the TTL.
 */
const LEDGER_PREFIX = 'stripe-event:';
export const EVENT_LEDGER_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Fixed key that never exists — the CI smoke probe (contact precedent). */
const PROBE_USER_ID = '__health_probe_nonexistent__';

/** DynamoDB's conditional-check failure: expected control flow, not an error. */
function isConditionalFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'ConditionalCheckFailedException'
  );
}

export class DynamoSubscriptionsStorage implements SubscriptionsStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: SessionSubset,
    private readonly userWriter: UserWriter,
    private readonly clock: () => number = Date.now
  ) {}

  // --- Session subset + user row (delegated) -----------------------------------

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

  updateUser(
    userId: string,
    updates: SubscriptionFields & { tier?: Tier }
  ): Promise<UserRecord | null> {
    return this.userWriter.updateUser(userId, updates);
  }

  // --- Webhook idempotency ledger -----------------------------------------------

  async markEventProcessed(eventId: string): Promise<boolean> {
    // ONE conditional PutItem: the first delivery creates the ledger row, every
    // replay fails the condition and is treated as a duplicate. Written BEFORE
    // the effect is applied (the handler's ordering), so a crash mid-apply can
    // only ever produce a missed write — which the next event's re-read from
    // Stripe self-corrects — never a double-apply.
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tables.rateLimits,
          Item: {
            bucket: `${LEDGER_PREFIX}${eventId}`,
            expiresAt: Math.floor(this.clock() / 1000) + EVENT_LEDGER_TTL_SECONDS,
          },
          ConditionExpression: 'attribute_not_exists(bucket)',
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- Checkout/Portal session budget (octav-rate-limits) ------------------------

  async incrementSessionBudget(userId: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the key — the auth/
    // analytics/contact limiter pattern: the window rolls atomically in one
    // UpdateCommand, with no dependence on TTL deletion.
    const nowMs = this.clock();
    const bucket = subscriptionRateLimitBucket(userId, nowMs, windowSeconds);
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (Math.floor(nowMs / (windowSeconds * 1000)) + 1) * windowSeconds,
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async probeTable(): Promise<void> {
    // CI smoke: GetItem on a key that never exists — proves the table AND the
    // IAM grant without reading real data. _health additionally asserts
    // STRIPE_ENV is usable, so a wiped secret goes red at deploy time.
    await this.client.send(
      new GetCommand({ TableName: this.tables.users, Key: { userId: PROBE_USER_ID } })
    );
  }
}
