import { describe, it, expect } from 'vitest';
import { DynamoAuthStorage } from '@/lib/auth/dynamodb-storage';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { OtpRecord, SessionRecord, UserRecord } from '@/lib/auth/types';

// Adapter tests with a mock DocumentClient: assert the commands the adapter
// sends (table names, keys, expressions) — no AWS involved. The real client
// wiring lives in deps.ts and is exercised by the Lambda in production.

interface CommandLike {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function mockClient(handler?: (cmd: CommandLike) => unknown): DynamoDBDocumentClient {
  return {
    send: async (cmd: unknown) => {
      const result = handler?.(cmd as CommandLike);
      return result === undefined ? {} : result;
    },
  } as unknown as DynamoDBDocumentClient;
}

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({}), clock?: () => number) {
  return new DynamoAuthStorage(
    mockClient(handler),
    {
      users: 'octav-users',
      sessions: 'octav-sessions',
      otp: 'octav-otp-codes',
      progress: 'octav-progress',
      rateLimits: 'octav-rate-limits',
    },
    clock
  );
}

function lastCommand(calls: CommandLike[]): CommandLike {
  return calls[calls.length - 1];
}

describe('DynamoAuthStorage', () => {
  it('getUserByEmail queries the users GSI1', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') return { Items: [{ userId: 'u1', email: 'a@example.com' }] };
      return {};
    });
    const user = await s.getUserByEmail('a@example.com');
    expect(user?.userId).toBe('u1');
    const cmd = lastCommand(calls);
    expect(cmd.input).toMatchObject({
      TableName: 'octav-users',
      IndexName: 'GSI1',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': 'a@example.com' },
      Limit: 1,
    });
  });

  it('getUserByEmail returns null on an empty result', async () => {
    const s = makeStorage(() => ({ Items: [] }));
    expect(await s.getUserByEmail('a@example.com')).toBeNull();
  });

  it('getUserById and getSession use GetCommand on their tables', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'GetCommand') {
        const key = cmd.input.Key as Record<string, string>;
        return { Item: key.userId ? { userId: 'u1' } : { sessionId: 's1' } };
      }
      return {};
    });
    expect((await s.getUserById('u1'))?.userId).toBe('u1');
    expect(calls[0].input).toEqual({ TableName: 'octav-users', Key: { userId: 'u1' } });
    expect((await s.getSession('s1'))?.sessionId).toBe('s1');
    expect(calls[1].input).toEqual({ TableName: 'octav-sessions', Key: { sessionId: 's1' } });
  });

  it('createUser/createSession/createOtp Put their records', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    const user = { userId: 'u1', email: 'a@example.com' };
    await s.createUser(user as UserRecord);
    expect(calls[0].input).toEqual({ TableName: 'octav-users', Item: user });

    await s.createSession({ sessionId: 's1' } as SessionRecord);
    expect(calls[1].input).toEqual({ TableName: 'octav-sessions', Item: { sessionId: 's1' } });

    await s.createOtp({ email: 'a@example.com' } as OtpRecord);
    expect(calls[2].input).toEqual({ TableName: 'octav-otp-codes', Item: { email: 'a@example.com' } });
  });

  it('updateUser builds a SET expression for the requested fields only', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'UpdateCommand') {
        const values = cmd.input.ExpressionAttributeValues as Record<string, unknown> | undefined;
        return values?.[':dn'] ? { Attributes: { userId: 'u1', displayName: 'New' } } : {};
      }
      return {};
    });
    const updated = await s.updateUser('u1', { displayName: 'New' });
    expect(updated?.displayName).toBe('New');
    const cmd = lastCommand(calls);
    expect(cmd.input).toMatchObject({
      TableName: 'octav-users',
      Key: { userId: 'u1' },
      UpdateExpression: 'SET #dn = :dn',
      ConditionExpression: 'attribute_exists(userId)',
      ExpressionAttributeNames: { '#dn': 'displayName' },
      ExpressionAttributeValues: { ':dn': 'New' },
      ReturnValues: 'ALL_NEW',
    });

    // Regression (2026-08-22): every :placeholder in ExpressionAttributeValues
    // must be referenced by UpdateExpression/ConditionExpression — DynamoDB
    // rejects unused values ("Value provided in ExpressionAttributeValues
    // unused in expressions"), which 500'd the child-profile save.
    const values = (cmd.input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
    const used = new Set<string>();
    for (const m of `${cmd.input.UpdateExpression} ${cmd.input.ConditionExpression}`.matchAll(/:([A-Za-z0-9_]+)/g)) {
      used.add(m[1]);
    }
    for (const key of Object.keys(values)) {
      expect(used.has(key.slice(1)), `unused ExpressionAttributeValues key ${key}`).toBe(true);
    }

    calls.length = 0;
    const withProfiles = await s.updateUser('u1', {
      childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }],
      lastLoginAt: '2026-08-15T00:00:00.000Z',
    });
    expect(withProfiles).toBeNull(); // mock returns {} — no Attributes
    expect(calls[0].input.UpdateExpression).toBe('SET #cp = :cp, #lla = :lla');
  });

  it('updateUser with no fields re-reads the user instead of updating', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'GetCommand') return { Item: { userId: 'u1' } };
      return {};
    });
    const user = await s.updateUser('u1', {});
    expect(user?.userId).toBe('u1');
    expect(calls.every((c) => c.constructor.name === 'GetCommand')).toBe(true);
  });

  it('updateSession sends a targeted update', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.updateSession('s1', { lastAccessedAt: 'now', expiresAt: 123 });
    expect(calls[0].input).toMatchObject({
      TableName: 'octav-sessions',
      Key: { sessionId: 's1' },
      UpdateExpression: 'SET lastAccessedAt = :laa, expiresAt = :exp',
    });
  });

  it('incrementOtpAttempts sends an atomic conditional increment (H2)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'UpdateCommand') return { Attributes: { attempts: 4 } };
      return {};
    });
    expect(await s.incrementOtpAttempts('a@example.com', 5)).toBe(4);
    const cmd = calls[0].input;
    expect(cmd).toMatchObject({
      TableName: 'octav-otp-codes',
      Key: { email: 'a@example.com' },
      UpdateExpression: 'SET attempts = attempts + :inc',
      ConditionExpression: 'attribute_exists(email) AND attempts < :max',
      ExpressionAttributeValues: { ':inc': 1, ':max': 5 },
      ReturnValues: 'ALL_NEW',
    });
  });

  it('incrementOtpAttempts returns null on a conditional failure (lockout)', async () => {
    const s = makeStorage(() => {
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    });
    expect(await s.incrementOtpAttempts('a@example.com', 5)).toBeNull();
  });

  it('incrementOtpAttempts rethrows non-conditional failures', async () => {
    const s = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(s.incrementOtpAttempts('a@example.com', 5)).rejects.toThrow('AccessDeniedException');
  });

  it('incrementOtpRequestCount writes an epoch-scoped bucket with a fixed-window TTL (H3 round 2)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    }, () => 300_000); // 600s windows → epoch 0, expires at 600
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(true);
    const cmd = calls[0].input;
    expect(cmd).toMatchObject({
      TableName: 'octav-rate-limits',
      Key: { bucket: 'otp-request:a@example.com:0' },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
      ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
      ExpressionAttributeNames: { '#c': 'count' },
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':limit': 3, ':exp': 600 },
    });
  });

  it('incrementOtpRequestCount rolls to a NEW bucket when the window elapses (atomic reset)', async () => {
    const calls: CommandLike[] = [];
    let now = 300_000; // epoch 0
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    }, () => now);

    await s.incrementOtpRequestCount('a@example.com', 3, 600);
    await s.incrementOtpRequestCount('a@example.com', 3, 600);
    expect((calls[0].input.Key as { bucket: string }).bucket).toBe('otp-request:a@example.com:0');
    expect((calls[1].input.Key as { bucket: string }).bucket).toBe('otp-request:a@example.com:0');

    now = 900_000; // window epoch 1 — brand-new item, attribute_not_exists passes
    await s.incrementOtpRequestCount('a@example.com', 3, 600);
    const rolled = calls[2].input;
    expect((rolled.Key as { bucket: string }).bucket).toBe('otp-request:a@example.com:1');
    expect(rolled.ExpressionAttributeValues).toMatchObject({ ':exp': 1200 });
  });

  it('incrementOtpRequestCount returns false when the budget is spent', async () => {
    const s = makeStorage(() => {
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    });
    expect(await s.incrementOtpRequestCount('a@example.com', 3, 600)).toBe(false);
  });

  it('getOtp returns null for creation-claim markers (round 2: no 500 on the marker)', async () => {
    const s = makeStorage(() => ({
      Item: { email: 'a@example.com', marker: 'user-creation-claim', createdAt: 'now' },
    }));
    expect(await s.getOtp('a@example.com')).toBeNull();
  });

  it('getOtp returns null for items missing salt even with a codeHash', async () => {
    const s = makeStorage(() => ({ Item: { email: 'a@example.com', codeHash: 'h' } }));
    expect(await s.getOtp('a@example.com')).toBeNull();
  });

  it('claimEmailForUserCreation puts a conditional uniqueness marker (M3)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    expect(await s.claimEmailForUserCreation('a@example.com')).toBe(true);
    const cmd = calls[0].input;
    expect(cmd.TableName).toBe('octav-otp-codes');
    expect(cmd.ConditionExpression).toBe('attribute_not_exists(email)');
    expect(cmd.Item).toMatchObject({ email: 'a@example.com', marker: 'user-creation-claim' });
  });

  it('claimEmailForUserCreation returns false when another login won the claim', async () => {
    const s = makeStorage(() => {
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    });
    expect(await s.claimEmailForUserCreation('a@example.com')).toBe(false);
  });

  it('deleteUser/deleteSession/deleteOtp send DeleteCommands on the right tables', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.deleteUser('u1');
    await s.deleteSession('s1');
    await s.deleteOtp('a@example.com');
    expect(calls.map((c) => c.input)).toEqual([
      { TableName: 'octav-users', Key: { userId: 'u1' } },
      { TableName: 'octav-sessions', Key: { sessionId: 's1' } },
      { TableName: 'octav-otp-codes', Key: { email: 'a@example.com' } },
    ]);
  });

  it('listSessionsByUser queries the sessions GSI1', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return { Items: [{ sessionId: 's1', userId: 'u1' }] };
    });
    const sessions = await s.listSessionsByUser('u1');
    expect(sessions).toHaveLength(1);
    const cmd = lastCommand(calls);
    expect(cmd.input).toMatchObject({ TableName: 'octav-sessions', IndexName: 'GSI1' });
    expect(cmd.input.KeyConditionExpression).toBe('userId = :userId');
  });

  it('listProgressByUser queries the progress table by userId', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return { Items: [{ userId: 'u1', dataType: 'quiz', score: 5 }] };
    });
    expect(await s.listProgressByUser('u1')).toHaveLength(1);
    const cmd = lastCommand(calls);
    expect(cmd.input).toMatchObject({ TableName: 'octav-progress', KeyConditionExpression: 'userId = :userId' });
  });

  it('listProgressByUser loops LastEvaluatedKey pages (round 3: export/delete completeness)', async () => {
    const queries: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      if (cmd.constructor.name === 'QueryCommand') {
        queries.push(cmd);
        if (queries.length === 1) {
          return {
            Items: [
              { userId: 'u1', dataType: 'a' },
              { userId: 'u1', dataType: 'b' },
            ],
            LastEvaluatedKey: { userId: 'u1', dataType: 'b' },
          };
        }
        return { Items: [{ userId: 'u1', dataType: 'c' }] };
      }
      return {};
    });

    const items = await s.listProgressByUser('u1');
    expect(items.map((i) => (i as { dataType: string }).dataType)).toEqual(['a', 'b', 'c']);
    expect(queries).toHaveLength(2);
    expect(queries[0].input.ExclusiveStartKey).toBeUndefined();
    expect(queries[1].input.ExclusiveStartKey).toEqual({ userId: 'u1', dataType: 'b' });
  });

  it('deleteProgressByUser deletes each progress item', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        return {
          Items: [
            { userId: 'u1', dataType: 'quiz' },
            { userId: 'u1', dataType: 'exam' },
          ],
        };
      }
      return {};
    });
    await s.deleteProgressByUser('u1');
    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes).toHaveLength(2);
    expect(deletes[0].input).toEqual({ TableName: 'octav-progress', Key: { userId: 'u1', dataType: 'quiz' } });
    expect(deletes[1].input).toEqual({ TableName: 'octav-progress', Key: { userId: 'u1', dataType: 'exam' } });
  });

  it('deleteProgressByUser deletes items from EVERY page (round 3: no truncation)', async () => {
    const calls: CommandLike[] = [];
    let queryCount = 0;
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        queryCount += 1;
        if (queryCount === 1) {
          return {
            Items: [
              { userId: 'u1', dataType: 'quiz' },
              { userId: 'u1', dataType: 'exam' },
            ],
            LastEvaluatedKey: { userId: 'u1', dataType: 'exam' },
          };
        }
        return { Items: [{ userId: 'u1', dataType: 'ladder' }] };
      }
      return {};
    });
    await s.deleteProgressByUser('u1');
    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes.map((d) => (d.input.Key as { dataType: string }).dataType)).toEqual(['quiz', 'exam', 'ladder']);
  });
});

describe('dummy ↔ DynamoDB parity (round 2)', () => {
  // Simulated DocumentClient implementing the exact UpdateCommand semantics of
  // the real DynamoDB counter: attribute_not_exists OR count < limit passes,
  // otherwise ConditionalCheckFailedException. Item state per bucket.
  function simulatedDdb() {
    const items = new Map<string, { count: number; expiresAt: number }>();
    const send = async (cmd: unknown) => {
      const { input } = cmd as {
        input: {
          Key: { bucket: string };
          ExpressionAttributeValues: Record<string, number>;
        };
      };
      const bucket = input.Key.bucket;
      const limit = input.ExpressionAttributeValues[':limit'];
      const exp = input.ExpressionAttributeValues[':exp'];
      const item = items.get(bucket);
      if (!item || item.count < limit) {
        items.set(bucket, { count: (item?.count ?? 0) + 1, expiresAt: exp });
        return {};
      }
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    };
    return { send } as unknown as DynamoDBDocumentClient;
  }

  it('produces identical allow/deny sequences across a window roll', async () => {
    const { InMemoryAuthStorage } = await import('@/lib/auth/dummy');
    let now = 300_000; // epoch 0
    const clock = () => now;
    const dummy = new InMemoryAuthStorage(clock);
    const ddb = new DynamoAuthStorage(
      simulatedDdb(),
      {
        users: 'u', sessions: 's', otp: 'o', progress: 'p', rateLimits: 'r',
      },
      clock
    );

    const sequence = [true, true, true, false]; // within window: 3 allowed, 4th denied
    const afterRoll = [true, true, true, false, false, false]; // fresh 3-budget, then denied

    const dummyResults: boolean[] = [];
    const ddbResults: boolean[] = [];
    for (const _expected of sequence) {
      dummyResults.push(await dummy.incrementOtpRequestCount('a@example.com', 3, 600));
      ddbResults.push(await ddb.incrementOtpRequestCount('a@example.com', 3, 600));
    }
    expect(dummyResults).toEqual(sequence);
    expect(ddbResults).toEqual(sequence);

    // Window rolls: both reset atomically and allow another full budget.
    now = 900_000; // epoch 1
    const dummyRoll: boolean[] = [];
    const ddbRoll: boolean[] = [];
    for (const _expected of afterRoll) {
      dummyRoll.push(await dummy.incrementOtpRequestCount('a@example.com', 3, 600));
      ddbRoll.push(await ddb.incrementOtpRequestCount('a@example.com', 3, 600));
    }
    expect(dummyRoll).toEqual(afterRoll);
    expect(ddbRoll).toEqual(afterRoll);
  });
});
