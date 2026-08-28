import { handleContactHealth, handleContactPost } from '../../src/lib/contact/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production contact Lambda (Feature 3, docs/supportability-features-plan.md):
// thin adapter between the Lambda Function URL event shape (HTTP API v2) and
// the shared handler in src/lib/contact/http-handler.ts — the same contract as
// the Next routes, which remain the dev/e2e path. CloudFront routes
// /api/contact/* to this function (C5 — terraform/modules/contact_api wires
// CONTACT_STORAGE + CONTACT_TABLE + AUTH_USERS_TABLE + AUTH_SESSIONS_TABLE +
// AUTH_RATE_LIMITS_TABLE + EMAIL_PROVIDER + ANALYTICS_ADMIN_EMAILS via env
// vars); session resolution (optional — the endpoint is public) reuses the
// shared resolveSession over the same users/sessions tables the auth Lambda
// uses.
//
// Event/request plumbing is shared with the other adapters
// (lambda/shared/lambda-adapter.ts). Ingest is public but bounded per IP by
// the durable fixed-window budget in the handler (octav-rate-limits).

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/contact': { POST: handleContactPost },
  '/api/contact/_health': { GET: handleContactHealth },
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
        console.error('[contact] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
