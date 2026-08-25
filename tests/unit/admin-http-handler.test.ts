import { describe, it, expect } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import { InMemoryAdminStorage } from '@/lib/admin/dummy';
import { handleAdminAccess, handleAdminDynamo, handleAdminHealth, isAdminEmail } from '@/lib/admin/http-handler';
import type { AuthDeps } from '@/lib/auth/types';
import type { AdminDeps } from '@/lib/admin/deps';

// Handler-level admin CRUD tests: one fresh in-memory CRUD store + one fresh
// auth universe per test; the admin-gate tests seed a real session through the
// auth handlers (the same dummy-OTP login flow as analytics-http-handler.test.ts).

const DUMMY_CODE = '123456';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `admin-${counter}@example.com`;
}

interface TestDeps {
  authDeps: AuthDeps;
  adminDeps: AdminDeps;
  adminStorage: InMemoryAdminStorage;
}

function makeDeps(adminEmails = ''): TestDeps {
  const authStorage = new InMemoryAnalyticsStorage();
  const sender = new DummyEmailSender();
  const adminStorage = new InMemoryAdminStorage();
  return {
    authDeps: { storage: authStorage, emailSender: sender, testMode: true, dummyMode: true },
    adminDeps: { storage: adminStorage, sessionStorage: authStorage, adminEmails },
    adminStorage,
  };
}

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No Set-Cookie header');
  return setCookie.split(';')[0].split('=')[1] ?? '';
}

async function login(t: TestDeps, email = uniqueEmail()) {
  await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.authDeps);
  const res = await handleVerifyOtp(
    jsonRequest('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
    t.authDeps
  );
  expect(res.status).toBe(200);
  return { cookie: `octav_session=${cookieFrom(res)}`, user: (await res.json()).user };
}

function post(t: TestDeps, body: unknown, cookie = '') {
  return handleAdminDynamo(
    new Request('https://octavlearning.com/api/admin/dynamodb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
    t.adminDeps
  );
}

describe('POST /api/admin/dynamodb — auth gate', () => {
  it('401s without a session', async () => {
    const t = makeDeps('boss@example.com');
    const res = await post(t, { operation: 'listTables' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('403s a signed-in non-admin and 200s an admin (case-insensitive allowlist)', async () => {
    const t = makeDeps(' Boss@Example.com ');
    const other = await login(t, uniqueEmail());
    expect(other.user.email).not.toBe('boss@example.com');
    expect((await post(t, { operation: 'listTables' }, other.cookie)).status).toBe(403);

    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'listTables' }, admin.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age='); // sliding refresh
    const body = (await res.json()) as { result: string[] };
    expect(body.result.every((t) => t.startsWith('octav-'))).toBe(true);
  });
});

describe('POST /api/admin/dynamodb — operations', () => {
  it('listTables returns only octav-* tables, sorted', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    // Seed a non-octav table that must NOT leak.
    t.adminStorage.reset({ 'octav-users': [{ id: 'u1' }], 'internal-metrics': [{ id: 'x' }] });
    const res = await post(t, { operation: 'listTables' }, admin.cookie);
    expect((await res.json()).result).toEqual(['octav-users']);
  });

  it('describeTable returns the table key schema (query-default prefill)', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'describeTable', table: 'octav-analytics-events' }, admin.cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).result).toEqual({
      table: 'octav-analytics-events',
      keySchema: [
        { attributeName: 'k', keyType: 'HASH' },
        { attributeName: 's', keyType: 'RANGE' },
      ],
    });
  });

  it('describeTable 400s without a table', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'describeTable' }, admin.cookie);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('table is required');
  });

  it('scan returns seeded items and respects the limit', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'scan', table: 'octav-users', limit: 2 }, admin.cookie);
    const body = (await res.json()) as { result: { items: unknown[]; count: number; lastEvaluatedKey?: unknown } };
    expect(body.result.count).toBe(2);
    expect(body.result.items).toHaveLength(2);
    expect(body.result.lastEvaluatedKey).toBeDefined();
  });

  it('scan paginates with exclusiveStartKey', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const first = (await (await post(t, { operation: 'scan', table: 'octav-users', limit: 1 }, admin.cookie)).json())
      .result as { items: Array<Record<string, unknown>>; lastEvaluatedKey?: Record<string, unknown> };
    expect(first.items).toHaveLength(1);
    expect(first.lastEvaluatedKey).toBeDefined();
    const second = (await (
      await post(t, { operation: 'scan', table: 'octav-users', limit: 1, exclusiveStartKey: first.lastEvaluatedKey }, admin.cookie)
    ).json()).result as { items: Array<Record<string, unknown>> };
    expect(second.items[0].id).not.toBe(first.items[0].id);
  });

  it('get returns the item for a key', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'get', table: 'octav-users', key: { id: 'user-1' } }, admin.cookie);
    const body = (await res.json()) as { result: { item: { email: string } } };
    expect(body.result.item.email).toBe('student1@example.com');
  });

  it('get returns null item for a missing key', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const body = (await (await post(t, { operation: 'get', table: 'octav-users', key: { id: 'nope' } }, admin.cookie)).json()) as { result: { item: null } };
    expect(body.result.item).toBeNull();
  });

  it('put inserts a new item (upsert semantics)', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const put = await post(t, { operation: 'put', table: 'octav-users', item: { id: 'user-9', email: 'new@example.com', tier: 'free' } }, admin.cookie);
    expect(put.status).toBe(200);
    expect((await put.json()).result).toEqual({ success: true });

    const got = await post(t, { operation: 'get', table: 'octav-users', key: { id: 'user-9' } }, admin.cookie);
    expect(((await got.json()) as { result: { item: { email: string } } }).result.item.email).toBe('new@example.com');
  });

  it('update applies a SET expression', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const up = await post(
      t,
      { operation: 'update', table: 'octav-users', key: { id: 'user-1' }, expression: 'SET tier = :t', expressionValues: { ':t': 'premium' } },
      admin.cookie
    );
    expect(up.status).toBe(200);
    const got = await post(t, { operation: 'get', table: 'octav-users', key: { id: 'user-1' } }, admin.cookie);
    expect(((await got.json()) as { result: { item: { tier: string } } }).result.item.tier).toBe('premium');
  });

  it('update returns 400 when the key does not exist (ConditionalCheckFailed)', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(
      t,
      { operation: 'update', table: 'octav-users', key: { id: 'ghost' }, expression: 'SET tier = :t', expressionValues: { ':t': 'premium' } },
      admin.cookie
    );
    expect(res.status).toBe(400);
  });

  it('delete removes the item', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const del = await post(t, { operation: 'delete', table: 'octav-users', key: { id: 'user-2' } }, admin.cookie);
    expect(del.status).toBe(200);
    const got = await post(t, { operation: 'get', table: 'octav-users', key: { id: 'user-2' } }, admin.cookie);
    expect(((await got.json()) as { result: { item: null } }).result.item).toBeNull();
  });

  it('query matches equality clauses', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(
      t,
      { operation: 'query', table: 'octav-users', expression: 'id = :id', expressionValues: { ':id': 'user-1' } },
      admin.cookie
    );
    const body = (await res.json()) as { result: { items: Array<Record<string, unknown>>; count: number } };
    expect(body.result.count).toBe(1);
    expect(body.result.items[0].id).toBe('user-1');
  });
});

describe('POST /api/admin/dynamodb — validation & hardening', () => {
  it('400s unknown operations and non-octav tables', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    expect((await post(t, { operation: 'drop' }, admin.cookie)).status).toBe(400);
    expect((await post(t, { operation: 'scan', table: 'other-users' }, admin.cookie)).status).toBe(400);
    expect((await post(t, { operation: 'scan' }, admin.cookie)).status).toBe(400);
    expect((await post(t, { operation: 'get', table: 'octav-users' }, admin.cookie)).status).toBe(400);
    expect((await post(t, { operation: 'put', table: 'octav-users' }, admin.cookie)).status).toBe(400);
    expect((await post(t, { operation: 'update', table: 'octav-users', key: { id: 'u1' } }, admin.cookie)).status).toBe(400);
    expect(
      (await post(t, { operation: 'update', table: 'octav-users', key: { id: 'u1' }, expression: 'SET tier = :t' }, admin.cookie)).status
    ).toBe(400);
    expect((await post(t, { operation: 'query', table: 'octav-users', expression: 'id = :id' }, admin.cookie)).status).toBe(400);
  });

  it('400s a limit over the cap', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    expect((await post(t, { operation: 'scan', table: 'octav-users', limit: 999 }, admin.cookie)).status).toBe(400);
  });

  it('400s malformed JSON and oversized bodies with a generic message', async () => {
    const t = makeDeps('boss@example.com');
    const bad = await handleAdminDynamo(
      new Request('https://octavlearning.com/api/admin/dynamodb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      t.adminDeps
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Invalid request' });

    const oversized = await handleAdminDynamo(
      new Request('https://octavlearning.com/api/admin/dynamodb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'put', table: 'octav-users', item: { blob: 'x'.repeat(70_000) } }),
      }),
      t.adminDeps
    );
    expect(oversized.status).toBe(400);
  });

  it('400s (not 500) for a non-existent table', async () => {
    const t = makeDeps('boss@example.com');
    const admin = await login(t, 'boss@example.com');
    const res = await post(t, { operation: 'scan', table: 'octav-does-not-exist' }, admin.cookie);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/_health', () => {
  it('returns 200 when the probe works', async () => {
    const t = makeDeps();
    const res = await handleAdminHealth(new Request('https://x.test/api/admin/_health'), t.adminDeps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 when the probe fails (missing ListTables grant class)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.adminDeps.storage, {
      get(target, prop) {
        if (prop === 'probe') {
          return async () => {
            const err = new Error('AccessDeniedException');
            err.name = 'AccessDeniedException';
            throw err;
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const res = await handleAdminHealth(new Request('https://x.test/api/admin/_health'), {
      ...t.adminDeps,
      storage: failing,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe('GET /api/admin/access', () => {
  const get = (t: TestDeps, cookie = '') =>
    handleAdminAccess(new Request('https://x.test/api/admin/access', { headers: cookie ? { cookie } : {} }), t.adminDeps);

  it('401s without a session', async () => {
    const t = makeDeps();
    const res = await get(t);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('returns 200 {admin:true} for an admin and {admin:false} for a signed-in non-admin', async () => {
    const t = makeDeps(' Boss@Example.com ');
    const admin = await login(t, 'boss@example.com');
    const adminRes = await get(t, admin.cookie);
    expect(adminRes.status).toBe(200);
    expect(await adminRes.json()).toEqual({ admin: true });

    const other = await login(t, uniqueEmail());
    const otherRes = await get(t, other.cookie);
    expect(otherRes.status).toBe(200);
    expect(await otherRes.json()).toEqual({ admin: false });
  });
});

describe('isAdminEmail', () => {
  it('is case-insensitive and trims the list', () => {
    expect(isAdminEmail('boss@example.com', ' Boss@Example.com ,other@example.com')).toBe(true);
    expect(isAdminEmail('other@example.com', 'Boss@Example.com,other@example.com')).toBe(true);
    expect(isAdminEmail('someone@example.com', 'boss@example.com')).toBe(false);
    expect(isAdminEmail('boss@example.com', '')).toBe(false);
  });
});
