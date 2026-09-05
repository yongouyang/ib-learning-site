import {
  handleCheckoutPost,
  handlePortalPost,
  handleStatusGet,
  handleSubscriptionsHealth,
  handleWebhookPost,
} from '../../src/lib/subscriptions/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production subscriptions Lambda (E4.2, docs/stripe-subscriptions-plan.md §6):
// thin adapter between the Lambda Function URL event shape (HTTP API v2) and
// the shared handler in src/lib/subscriptions/http-handler.ts — the same
// contract as the Next routes, which remain the dev/e2e path.
//
// CloudFront routes the EXACT path /api/subscriptions (the Stripe webhook) and
// /api/subscriptions/* to this function, both listed BEFORE /api/* — a "/*"
// pattern alone requires a trailing segment, so the bare path needs its own
// behaviour (the /api/progress and /api/leaderboard precedent).
//
// TWO things this adapter must not break:
//   * the webhook body reaches the handler as the EXACT bytes Stripe signed
//     (toWebRequest forwards event.body verbatim, base64-decoded only when
//     Lambda encoded it) — any re-serialisation here would invalidate every
//     signature;
//   * the Stripe-Signature header survives. CloudFront's managed
//     AllViewerExceptHostHeader origin request policy forwards every viewer
//     header except Host, so the signature arrives intact; X-Octav-Env comes
//     from the api_env_header viewer Function and selects test vs live keys
//     (plan §6.1) — one Lambda serves both distributions.

type RouteHandler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/subscriptions': { POST: handleWebhookPost },
  '/api/subscriptions/checkout': { POST: handleCheckoutPost },
  '/api/subscriptions/portal': { POST: handlePortalPost },
  '/api/subscriptions/status': { GET: handleStatusGet },
  '/api/subscriptions/_health': { GET: handleSubscriptionsHealth },
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
        console.error('[subscriptions] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};
