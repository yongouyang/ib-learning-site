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

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  return new DynamoAuthStorage(mockClient(handler), {
    users: 'octav-users',
    sessions: 'octav-sessions',
    otp: 'octav-otp-codes',
    progress: 'octav-progress',
  });
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
      ExpressionAttributeValues: { ':userId': 'u1', ':dn': 'New' },
      ReturnValues: 'ALL_NEW',
    });

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

  it('updateSession and updateOtp send targeted updates', async () => {
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

    await s.updateOtp('a@example.com', { attempts: 2 });
    expect(calls[1].input).toMatchObject({
      TableName: 'octav-otp-codes',
      Key: { email: 'a@example.com' },
      UpdateExpression: 'SET attempts = :attempts',
      ExpressionAttributeValues: { ':attempts': 2 },
    });
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
});
