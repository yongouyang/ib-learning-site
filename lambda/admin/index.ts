import { handleAdminAccess, handleAdminDynamo, handleAdminHealth } from '../../src/lib/admin/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production admin CRUD Lambda (Feature 2, docs/supportability-features-plan.md):
// thin adapter between the Lambda Function URL event shape (HTTP API v2) and
// the shared handler in src/lib/admin/http-handler.ts — the same contract as
// the Next routes, which remain the dev/e2e path. CloudFront routes
// /api/admin/* to this function (D3 — terraform/modules/admin_api wires
// ADMIN_STORAGE + AUTH_USERS_TABLE + AUTH_SESSIONS_TABLE + ANALYTICS_ADMIN_EMAILS
// via env vars); session validation reuses the shared resolveSession over the
// same users/sessions tables the auth Lambda uses.
//
// This Lambda is a BROAD DynamoDB browser — its IAM grants full CRUD on every
// octav-* table + ListTables (scoped in the admin_api module). Access is
// gated in the handler: valid session AND admin allowlist match.

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/admin/dynamodb': { POST: handleAdminDynamo },
  '/api/admin/access': { GET: handleAdminAccess },
  '/api/admin/_health': { GET: handleAdminHealth },
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
        console.error('[admin] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
