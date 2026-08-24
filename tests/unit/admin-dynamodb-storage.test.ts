import { describe, it, expect, vi } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoAdminStorage } from '@/lib/admin/dynamodb-storage';

// Adapter-level tests for the DynamoDB-backed admin storage: mock the
// DocumentClient.send and assert the exact SDK command shapes the adapter
// issues (passthrough correctness), plus that result fields are surfaced.

function makeClient(): { client: DynamoDBDocumentClient; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  const client = { send } as unknown as DynamoDBDocumentClient;
  return { client, send };
}

type CommandInput = { TableName?: string; Key?: unknown; Item?: unknown; Limit?: number; ExclusiveStartKey?: unknown };

function inputOf(call: [command: { input: CommandInput }]): CommandInput {
  return call[0].input;
}

describe('DynamoAdminStorage', () => {
  it('listTables surfaces TableNames', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ TableNames: ['octav-users', 'octav-progress'] });
    const s = new DynamoAdminStorage(client);
    expect(await s.listTables()).toEqual(['octav-users', 'octav-progress']);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('scan sends ScanCommand with table, limit and optional ExclusiveStartKey', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ Items: [{ id: 'u1' }], Count: 1, LastEvaluatedKey: { id: 'u1' } });
    const s = new DynamoAdminStorage(client);
    const res = await s.scan('octav-users', 25, { id: 'u1' });
    expect(res).toEqual({ items: [{ id: 'u1' }], count: 1, lastEvaluatedKey: { id: 'u1' } });
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({
      TableName: 'octav-users',
      Limit: 25,
      ExclusiveStartKey: { id: 'u1' },
    });
  });

  it('scan defaults the limit and omits ExclusiveStartKey when absent', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ Items: [], Count: 0 });
    const s = new DynamoAdminStorage(client);
    await s.scan('octav-users');
    const input = inputOf(send.mock.calls[0] as never);
    expect(input.Limit).toBe(50);
    expect(input.ExclusiveStartKey).toBeUndefined();
  });

  it('query sends QueryCommand with the key condition + values', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ Items: [{ id: 'u1' }], Count: 1 });
    const s = new DynamoAdminStorage(client);
    const res = await s.query('octav-users', 'id = :id', { ':id': 'u1' }, 10);
    expect(res.items).toEqual([{ id: 'u1' }]);
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({
      TableName: 'octav-users',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': 'u1' },
      Limit: 10,
    });
  });

  it('get sends GetItemCommand and returns the item or null', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ Item: { id: 'u1', email: 'a@example.com' } });
    const s = new DynamoAdminStorage(client);
    expect(await s.get('octav-users', { id: 'u1' })).toEqual({ id: 'u1', email: 'a@example.com' });
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({ TableName: 'octav-users', Key: { id: 'u1' } });

    send.mockResolvedValueOnce({});
    expect(await s.get('octav-users', { id: 'ghost' })).toBeNull();
  });

  it('put sends PutItemCommand', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({});
    const s = new DynamoAdminStorage(client);
    await s.put('octav-users', { id: 'u1' });
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({ TableName: 'octav-users', Item: { id: 'u1' } });
  });

  it('update sends UpdateItemCommand with expression + values', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({});
    const s = new DynamoAdminStorage(client);
    await s.update('octav-users', { id: 'u1' }, 'SET tier = :t', { ':t': 'premium' });
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({
      TableName: 'octav-users',
      Key: { id: 'u1' },
      UpdateExpression: 'SET tier = :t',
      ExpressionAttributeValues: { ':t': 'premium' },
      ReturnValues: 'NONE',
    });
  });

  it('delete sends DeleteItemCommand', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({});
    const s = new DynamoAdminStorage(client);
    await s.delete('octav-users', { id: 'u1' });
    expect(inputOf(send.mock.calls[0] as never)).toMatchObject({ TableName: 'octav-users', Key: { id: 'u1' } });
  });

  it('probe issues a ListTablesCommand and propagates failures', async () => {
    const { client, send } = makeClient();
    send.mockResolvedValueOnce({ TableNames: [] });
    const s = new DynamoAdminStorage(client);
    await expect(s.probe()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRejectedValueOnce(Object.assign(new Error('AccessDeniedException'), { name: 'AccessDeniedException' }));
    await expect(s.probe()).rejects.toMatchObject({ name: 'AccessDeniedException' });
  });
});
