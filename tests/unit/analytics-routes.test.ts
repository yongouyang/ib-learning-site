import { describe, it, expect } from 'vitest';
import {
  handleAnalyticsEvent,
  handleAnalyticsHealth,
  handleAnalyticsSummary,
} from '@/lib/analytics/http-handler';

// The routes delegate 1:1 to these handlers (tested in depth in
// analytics-http-handler.test.ts with injected deps). These smoke tests call
// the handlers with the DEFAULT deps (getAnalyticsDeps() → in-memory dummy
// wiring) — the same wiring the routes/dev server use. NOTE: importing the
// route modules themselves from unit tests breaks build:static — the script
// stashes src/app/api aside during the export build and the imports stop
// resolving (same convention as tests/unit/auth-routes.test.ts).

describe('analytics handlers with default dummy deps (the route wiring)', () => {
  it('event → 204 for a valid page_view envelope', async () => {
    const res = await handleAnalyticsEvent(
      new Request('http://localhost/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'page_view',
          props: {},
          url: 'http://localhost/',
          sessionId: 's1',
          clientTs: new Date().toISOString(),
        }),
      })
    );
    expect(res.status).toBe(204);
  });

  it('event → 400 for an invalid envelope', async () => {
    const res = await handleAnalyticsEvent(
      new Request('http://localhost/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'not_a_real_event' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('summary → 401 without a session', async () => {
    const res = await handleAnalyticsSummary(
      new Request('http://localhost/api/analytics/summary')
    );
    expect(res.status).toBe(401);
  });

  it('_health → 200 {ok:true} in dummy mode', async () => {
    const res = await handleAnalyticsHealth(
      new Request('http://localhost/api/analytics/_health')
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
