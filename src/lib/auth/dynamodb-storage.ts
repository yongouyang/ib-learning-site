import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type {
  AuthStorage,
  ChildProfile,
  OtpRecord,
  SessionRecord,
  UserRecord,
} from './types';

// Production storage adapter: the auth handler's AuthStorage contract on the
// Phase 0 DynamoDB tables (terraform/modules/dynamodb) —
//   octav-users       PK userId, GSI1 email→userId
//   octav-sessions    PK sessionId, GSI1 userId, TTL expiresAt
//   octav-otp-codes   PK email, TTL expiresAt
//   octav-progress    PK userId, SK dataType
//   octav-rate-limits PK bucket, TTL expiresAt  (durable per-email limiter, H3)
// The DocumentClient is injected so unit tests can pass a mock; the real
// client is built in deps.ts from AUTH_*_TABLE env vars (set by terraform).

interface TableNames {
  users: string;
  sessions: string;
  otp: string;
  progress: string;
  rateLimits: string;
}

const SESSIONS_GSI = 'GSI1';
const USERS_GSI = 'GSI1';

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoAuthStorage implements AuthStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly clock: () => number = Date.now
  ) {}

  // --- Users ------------------------------------------------------------------

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tables.users,
        IndexName: USERS_GSI,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      })
    );
    return (res.Items?.[0] as UserRecord | undefined) ?? null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const res = await this.client.send(
      new GetCommand({ TableName: this.tables.users, Key: { userId } })
    );
    return (res.Item as UserRecord | undefined) ?? null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tables.users, Item: user }));
  }

  async updateUser(
    userId: string,
    updates: { displayName?: string; childProfiles?: ChildProfile[]; lastLoginAt?: string }
  ): Promise<UserRecord | null> {
    const sets: string[] = [];
    const values: Record<string, unknown> = { ':userId': userId };
    const names: Record<string, string> = {};

    if (updates.displayName !== undefined) {
      sets.push('#dn = :dn');
      values[':dn'] = updates.displayName;
      names['#dn'] = 'displayName';
    }
    if (updates.childProfiles !== undefined) {
      sets.push('#cp = :cp');
      values[':cp'] = updates.childProfiles;
      names['#cp'] = 'childProfiles';
    }
    if (updates.lastLoginAt !== undefined) {
      sets.push('#lla = :lla');
      values[':lla'] = updates.lastLoginAt;
      names['#lla'] = 'lastLoginAt';
    }
    if (sets.length === 0) return this.getUserById(userId);

    const res = await this.client.send(
      new UpdateCommand({
        TableName: this.tables.users,
        Key: { userId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: names,
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      })
    );
    return (res.Attributes as UserRecord | undefined) ?? null;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tables.users, Key: { userId } }));
  }

  // --- Sessions ---------------------------------------------------------------

  async createSession(session: SessionRecord): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tables.sessions, Item: session }));
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const res = await this.client.send(
      new GetCommand({ TableName: this.tables.sessions, Key: { sessionId } })
    );
    return (res.Item as SessionRecord | undefined) ?? null;
  }

  async updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tables.sessions,
        Key: { sessionId },
        UpdateExpression: 'SET lastAccessedAt = :laa, expiresAt = :exp',
        ExpressionAttributeValues: { ':laa': updates.lastAccessedAt, ':exp': updates.expiresAt },
      })
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tables.sessions, Key: { sessionId } }));
  }

  async listSessionsByUser(userId: string): Promise<SessionRecord[]> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tables.sessions,
        IndexName: SESSIONS_GSI,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return (res.Items ?? []) as SessionRecord[];
  }

  // --- OTP codes --------------------------------------------------------------

  async createOtp(otp: OtpRecord): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tables.otp, Item: otp }));
  }

  async getOtp(email: string): Promise<OtpRecord | null> {
    const res = await this.client.send(new GetCommand({ TableName: this.tables.otp, Key: { email } }));
    const item = res.Item as Partial<OtpRecord> | undefined;
    // Items without codeHash are creation-claim markers, not codes (round 2:
    // a blind cast here made verify-otp 500 on the marker).
    if (!item || typeof item.codeHash !== 'string' || typeof item.salt !== 'string') return null;
    return item as OtpRecord;
  }

  async incrementOtpAttempts(email: string, max: number): Promise<number | null> {
    try {
      // Atomic increment + lockout condition (review H2): N concurrent wrong
      // guesses each increment the SAME counter and the condition fails once
      // attempts reaches max — no read-then-write race widening the window
      // from 5 guesses to ~5×N.
      const res = await this.client.send(
        new UpdateCommand({
          TableName: this.tables.otp,
          Key: { email },
          UpdateExpression: 'SET attempts = attempts + :inc',
          ConditionExpression: 'attribute_exists(email) AND attempts < :max',
          ExpressionAttributeValues: { ':inc': 1, ':max': max },
          ReturnValues: 'ALL_NEW',
        })
      );
      return (res.Attributes as { attempts?: number } | undefined)?.attempts ?? null;
    } catch (err) {
      if (isConditionalFailure(err)) return null;
      throw err;
    }
  }

  async deleteOtp(email: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tables.otp, Key: { email } }));
  }

  // --- Durable per-email request-otp limiter (review H3) -----------------------

  async incrementOtpRequestCount(email: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the key (review H3,
    // round 2): each window is a fresh item, so the counter resets ATOMICALLY
    // in a single UpdateCommand when the window rolls — no dependence on TTL
    // deletion (best-effort, up to ~48h lag) to un-block a spent budget.
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clock() / windowMs);
    const bucket = `otp-request:${email}:${epoch}`;
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: requests 1..limit
          // succeed and limit+1 fails — but only within THIS window item.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (epoch + 1) * windowSeconds, // TTL: end of this epoch window
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- First-creation uniqueness (review M3) -----------------------------------

  async claimEmailForUserCreation(email: string): Promise<boolean> {
    // The OTP record was just consumed (deleted), so the email key in
    // octav-otp-codes is free: an attribute_not_exists marker serializes two
    // concurrent first logins for the same email — exactly one wins; the
    // loser re-queries the users GSI for the winner's row. The marker is
    // overwritten by the next request-otp (unconditional put) and carries no
    // TTL — a dangling marker only exists when no user row does, and the
    // winning path always creates one.
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tables.otp,
          Item: { email, marker: 'user-creation-claim', createdAt: new Date().toISOString() },
          ConditionExpression: 'attribute_not_exists(email)',
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- Progress (Phase C is the real consumer; §9 Q8 plumbing) ----------------

  async listProgressByUser(userId: string): Promise<unknown[]> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tables.progress,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );
    return res.Items ?? [];
  }

  async deleteProgressByUser(userId: string): Promise<void> {
    const items = await this.listProgressByUser(userId);
    await Promise.all(
      items.map((item) => {
        const record = item as { userId: string; dataType: string };
        return this.client.send(
          new DeleteCommand({
            TableName: this.tables.progress,
            Key: { userId: record.userId, dataType: record.dataType },
          })
        );
      })
    );
  }
}
