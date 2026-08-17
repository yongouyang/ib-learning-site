import {
  handleAnalyticsEvent,
  handleAnalyticsHealth,
  handleAnalyticsSummary,
} from '../../src/lib/analytics/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production analytics Lambda (docs/phase-a-analytics-plan.md): thin adapter
// between the Lambda Function URL event shape (HTTP API v2) and the shared
// handler in src/lib/analytics/http-handler.ts — the same contract as the
// Next routes, which remain the dev/e2e path. CloudFront routes
// /api/analytics/* to this function (A6 — terraform/modules/analytics_api
// wires the table names + ANALYTICS_ADMIN_EMAILS via env vars); session
// validation for /summary reuses the shared resolveSession
// (src/lib/auth/session.ts) over the same users/sessions tables the auth
// Lambda uses.
//
// Event/request plumbing is shared with the progress adapter
// (lambda/shared/lambda-adapter.ts): method body-gating and the
// cookies-array Set-Cookie conversion. Ingest is public but bounded per IP
// by the durable fixed-window budget in the handler (octav-rate-limits).

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/analytics/event': { POST: handleAnalyticsEvent },
  '/api/analytics/summary': { GET: handleAnalyticsSummary },
  '/api/analytics/_health': { GET: handleAnalyticsHealth },
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
        console.error('[analytics] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
