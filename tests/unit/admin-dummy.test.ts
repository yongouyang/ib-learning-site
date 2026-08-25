import { describe, it, expect } from 'vitest';
import { InMemoryAdminStorage } from '@/lib/admin/dummy';

// Direct storage-level tests for the seeded in-memory admin dummy. The
// handler contract on top of these is covered in admin-http-handler.test.ts.

const seed = {
  'octav-users': [
    { id: 'user-1', email: 'a@example.com' },
    { id: 'user-2', email: 'b@example.com' },
    { id: 'user-3', email: 'c@example.com' },
  ],
};

describe('InMemoryAdminStorage', () => {
  it('listTables returns the seeded table names', async () => {
    const s = new InMemoryAdminStorage(seed);
    expect(await s.listTables()).toEqual(['octav-users']);
  });

  it('describeTable returns the REAL schema map for a seeded table (query prefill parity)', async () => {
    const s = new InMemoryAdminStorage(seed);
    expect(await s.describeTable('octav-analytics-events')).toEqual({
      table: 'octav-analytics-events',
      keySchema: [
        { attributeName: 'k', keyType: 'HASH' },
        { attributeName: 's', keyType: 'RANGE' },
      ],
    });
  });

  it('describeTable throws ResourceNotFoundException for an unknown table', async () => {
    const s = new InMemoryAdminStorage(seed);
    await expect(s.describeTable('octav-nope')).rejects.toMatchObject({ name: 'ResourceNotFoundException' });
  });

  it('scan honors limit and reports lastEvaluatedKey when more remain', async () => {
    const s = new InMemoryAdminStorage(seed);
    const page = await s.scan('octav-users', 2);
    expect(page.items).toHaveLength(2);
    expect(page.count).toBe(2);
    expect(page.lastEvaluatedKey).toEqual({ id: 'user-2' });
  });

  it('scan paginates from an exclusiveStartKey', async () => {
    const s = new InMemoryAdminStorage(seed);
    const page = await s.scan('octav-users', 2, { id: 'user-1' });
    expect(page.items.map((i) => i.id)).toEqual(['user-2', 'user-3']);
  });

  it('get returns a deep copy and null for a missing key', async () => {
    const s = new InMemoryAdminStorage(seed);
    expect((await s.get('octav-users', { id: 'user-1' }))?.email).toBe('a@example.com');
    expect(await s.get('octav-users', { id: 'ghost' })).toBeNull();
  });

  it('put inserts a new item and replaces an existing one', async () => {
    const s = new InMemoryAdminStorage(seed);
    await s.put('octav-users', { id: 'user-9', email: 'z@example.com' });
    expect((await s.get('octav-users', { id: 'user-9' }))?.email).toBe('z@example.com');

    await s.put('octav-users', { id: 'user-1', email: 'updated@example.com' });
    expect((await s.get('octav-users', { id: 'user-1' }))?.email).toBe('updated@example.com');
  });

  it('update applies SET and REMOVE clauses', async () => {
    const s = new InMemoryAdminStorage(seed);
    await s.update('octav-users', { id: 'user-1' }, 'SET tier = :t REMOVE email', { ':t': 'premium' });
    const item = (await s.get('octav-users', { id: 'user-1' })) as Record<string, unknown>;
    expect(item.tier).toBe('premium');
    expect(item.email).toBeUndefined();
  });

  it('update throws a DynamoDB-shaped error when the key is absent', async () => {
    const s = new InMemoryAdminStorage(seed);
    await expect(s.update('octav-users', { id: 'ghost' }, 'SET tier = :t', { ':t': 'x' })).rejects.toMatchObject({
      name: 'ConditionalCheckFailedException',
    });
  });

  it('delete removes an item and is idempotent', async () => {
    const s = new InMemoryAdminStorage(seed);
    await s.delete('octav-users', { id: 'user-2' });
    expect(await s.get('octav-users', { id: 'user-2' })).toBeNull();
    await s.delete('octav-users', { id: 'user-2' }); // no throw
  });

  it('query matches equality clauses only', async () => {
    const s = new InMemoryAdminStorage(seed);
    const res = await s.query('octav-users', 'id = :id', { ':id': 'user-1' });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe('user-1');
    // AND support
    const res2 = await s.query('octav-users', 'id = :a AND email = :b', { ':a': 'user-1', ':b': 'a@example.com' });
    expect(res2.items).toHaveLength(1);
    // unsupported clause never matches
    const res3 = await s.query('octav-users', 'begins_with(id, :x)', { ':x': 'user' });
    expect(res3.items).toHaveLength(0);
  });

  it('scan throws ResourceNotFoundException for a missing table', async () => {
    const s = new InMemoryAdminStorage(seed);
    await expect(s.scan('octav-nope', 10)).rejects.toMatchObject({ name: 'ResourceNotFoundException' });
  });

  it('update rejects unsupported expressions', async () => {
    const s = new InMemoryAdminStorage(seed);
    await expect(s.update('octav-users', { id: 'user-1' }, 'ADD n :one', { ':one': 1 })).rejects.toThrow(/Unsupported/);
  });

  it('probe is a no-op', async () => {
    const s = new InMemoryAdminStorage(seed);
    await expect(s.probe()).resolves.toBeUndefined();
  });

  it('reset replaces the whole store', async () => {
    const s = new InMemoryAdminStorage(seed);
    s.reset({ 'octav-progress': [{ pk: 'P#1', sk: 'S#1' }] });
    expect(await s.listTables()).toEqual(['octav-progress']);
  });
});
