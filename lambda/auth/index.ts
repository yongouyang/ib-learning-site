import {
  handleAccountPost,
  handleDeleteAccount,
  handleExportGet,
  handleLogout,
  handleMe,
  handleRequestOtp,
  handleRevokeSession,
  handleSessionsGet,
  handleVerifyOtp,
} from '../../src/lib/auth/http-handler';

// Production auth Lambda (docs/architecture-evolution-plan.md §6): thin adapter
// between the Lambda Function URL event shape (HTTP API v2) and the shared
// handler in src/lib/auth/http-handler.ts — the same contract as the Next
// routes, which remain the dev/e2e path. CloudFront routes /api/auth/* to this
// function; direct Function URL hits work too (the source IP is injected for
// the rate limiter). Dependencies (DynamoDB + SES) are wired via env vars in
// terraform/modules/auth_api.

interface FunctionUrlEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string; sourceIp?: string } };
}

interface LambdaHttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

type RouteHandler = (req: Request) => Promise<Response>;

// path → { method → handler } — every mutation is POST (§2.5), reads are GET.
const ROUTES: Record<string, Partial<Record<string, RouteHandler>>> = {
  '/api/auth/request-otp': { POST: handleRequestOtp },
  '/api/auth/verify-otp': { POST: handleVerifyOtp },
  '/api/auth/logout': { POST: handleLogout },
  '/api/auth/me': { GET: handleMe },
  '/api/auth/account': { POST: handleAccountPost },
  '/api/auth/sessions': { GET: handleSessionsGet },
  '/api/auth/sessions/revoke': { POST: handleRevokeSession },
  '/api/auth/export': { GET: handleExportGet },
  '/api/auth/delete': { POST: handleDeleteAccount },
};

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const method = event.requestContext?.http?.method ?? 'GET';
  const host = event.headers?.host ?? 'localhost';
  const path = event.rawPath ?? '/';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${host}${path}${query}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(key, value);
  }
  // CloudFront already sets X-Forwarded-For; direct Function URL calls get the
  // source IP injected so the rate limiter has something to key on.
  if (!headers.has('x-forwarded-for') && event.requestContext?.http?.sourceIp) {
    headers.set('x-forwarded-for', event.requestContext.http.sourceIp);
  }

  const route = ROUTES[path];
  let response: Response;
  if (!route) {
    response = Response.json({ error: 'Not found' }, { status: 404 });
  } else {
    const handlerForMethod = route[method];
    if (!handlerForMethod) {
      response = Response.json({ error: 'Method not allowed' }, { status: 405 });
    } else {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
        : event.body;
      response = await handlerForMethod(new Request(url, { method, headers, body }));
    }
  }

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
    isBase64Encoded: false,
  };
};
