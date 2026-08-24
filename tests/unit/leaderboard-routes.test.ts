import { describe, it, expect } from 'vitest';
import {
  handleLeaderboardBoard,
  handleLeaderboardHealth,
  handleLeaderboardTeaser,
} from '@/lib/leaderboard/http-handler';

// The routes delegate 1:1 to these handlers (tested in depth in
// leaderboard-http-handler.test.ts with injected deps). These smoke tests call
// the handlers with the DEFAULT deps (getLeaderboardDeps() → the shared
// in-memory dummy wiring) — the same wiring the routes/dev server use. NOTE:
// importing the route modules themselves from unit tests breaks build:static
// — the script stashes src/app/api aside during the export build and the
// imports stop resolving (same convention as tests/unit/analytics-routes.test.ts).

describe('leaderboard handlers with default dummy deps (the route wiring)', () => {
  it('board → 401 without a session', async () => {
    const res = await handleLeaderboardBoard(new Request('http://localhost/api/leaderboard'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
  });

  it('teaser → 200 without a session (public), default scope stage:ks3', async () => {
    const res = await handleLeaderboardTeaser(new Request('http://localhost/api/leaderboard/teaser'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('stage:ks3');
    expect(Array.isArray(body.top)).toBe(true);
  });

  it('teaser → 400 for an invalid scope', async () => {
    const res = await handleLeaderboardTeaser(new Request('http://localhost/api/leaderboard/teaser?scope=nope'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request' });
  });

  it('_health → 200 {ok:true} in dummy mode', async () => {
    const res = await handleLeaderboardHealth(new Request('http://localhost/api/leaderboard/_health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
