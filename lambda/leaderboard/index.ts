import {
  handleLeaderboardBoard,
  handleLeaderboardHealth,
  handleLeaderboardTeaser,
} from '../../src/lib/leaderboard/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production leaderboard Lambda (docs/leaderboard-plan.md §6 — the FIFTH
// Lambda): thin adapter between the Lambda Function URL event shape (HTTP API
// v2) and the shared handler in src/lib/leaderboard/http-handler.ts — the
// same contract as the Next routes, which remain the dev/e2e path. CloudFront
// routes /api/leaderboard/* to this function (D7 — terraform/modules/
// leaderboard_api wires the table names via env vars); session validation for
// the board endpoint reuses the shared resolveSession
// (src/lib/auth/session.ts) over the same users/sessions tables the auth
// Lambda uses.
//
// This Lambda is READ-ONLY by design (plan §6): XP accrues inside the
// progress sync handler (D4, single-writer invariant), so this function needs
// no write grants on octav-leaderboard. The teaser and _health routes are
// public; the board route is session-gated in the shared handler.
//
// Event/request plumbing is shared with the other adapters
// (lambda/shared/lambda-adapter.ts): method body-gating and the cookies-array
// Set-Cookie conversion.

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/leaderboard': { GET: handleLeaderboardBoard },
  '/api/leaderboard/teaser': { GET: handleLeaderboardTeaser },
  '/api/leaderboard/_health': { GET: handleLeaderboardHealth },
};

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const { url, method, headers, body } = toWebRequest(event);

  const route = ROUTES[event.rawPath ?? '/'];
  let response: Response;
  if (!route) {
    response = Response.json({ error: 'Not found' }, { status: 404 });
  } else {
    const handlerForMethod = route[method];
    if (!handlerForMethod) {
      response = Response.json({ error: 'Method not allowed' }, { status: 405 });
    } else {
      try {
        response = await handlerForMethod(new Request(url, { method, headers, body }));
      } catch (err) {
        console.error('[leaderboard] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
