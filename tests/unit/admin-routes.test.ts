import { describe, it, expect } from 'vitest';
import { handleAdminAccess, handleAdminDynamo, handleAdminHealth } from '@/lib/admin/http-handler';

// The routes delegate 1:1 to these handlers (tested in depth in
// admin-http-handler.test.ts with injected deps). These smoke tests call the
// handlers with the DEFAULT deps (getAdminDeps() → in-memory dummy wiring) —
// the same wiring the routes/dev server use. NOTE: importing the route modules
// themselves from unit tests breaks build:static — the script stashes
// src/app/api aside during the export build and the imports stop resolving
// (same convention as tests/unit/analytics-routes.test.ts).

describe('admin handlers with default dummy deps (the route wiring)', () => {
  it('dynamodb → 401 without a session', async () => {
    const res = await handleAdminDynamo(
      new Request('http://localhost/api/admin/dynamodb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'listTables' }),
      })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('access → 401 without a session', async () => {
    const res = await handleAdminAccess(new Request('http://localhost/api/admin/access'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('_health → 200 {ok:true} in dummy mode', async () => {
    const res = await handleAdminHealth(new Request('http://localhost/api/admin/_health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
