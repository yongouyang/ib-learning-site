import {
  handleProgressGet,
  handleProgressHealth,
  handleProgressSync,
} from '../../src/lib/progress/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production progress Lambda (docs/architecture-evolution-plan.md §3): thin
// adapter between the Lambda Function URL event shape (HTTP API v2) and the
// shared handler in src/lib/progress/http-handler.ts — the same contract as
// the Next routes, which remain the dev/e2e path. CloudFront routes
// /api/progress/* to this function. Dependencies (DynamoDB) are wired via
// env vars in terraform/modules/progress_api; session validation reuses the
// shared resolveSession (src/lib/auth/session.ts) over the same tables the
// auth Lambda uses.
//
// Event/request plumbing is shared with the auth adapter
// (lambda/shared/lambda-adapter.ts): method body-gating and the
// cookies-array Set-Cookie conversion. No per-IP rate limiting here — the
// durable DynamoDB budgets in the auth domain cover abuse of the session
// itself, and progress writes are bounded by the per-request event budgets.

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/progress': { GET: handleProgressGet },
  '/api/progress/sync': { POST: handleProgressSync },
  '/api/progress/_health': { GET: handleProgressHealth },
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
        console.error('[progress] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
