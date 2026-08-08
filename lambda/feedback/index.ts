import { handleFeedbackGet, handleFeedbackPost } from '../../src/lib/feedback/http-handler';

// Production feedback Lambda (docs/aws-deployment-plan.md §5). Thin adapter between
// the Lambda Function URL event shape (HTTP API v2 format) and the shared
// handler in src/lib/feedback/http-handler.ts — same validation and contract
// as the Next route, which remains the dev/e2e path.

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

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const method = event.requestContext?.http?.method ?? 'GET';
  const host = event.headers?.host ?? 'localhost';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${host}${event.rawPath ?? '/'}${query}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(key, value);
  }
  // CloudFront already sets X-Forwarded-For; direct Function URL calls get the
  // source IP injected so the rate limiter has something to key on.
  if (!headers.has('x-forwarded-for') && event.requestContext?.http?.sourceIp) {
    headers.set('x-forwarded-for', event.requestContext.http.sourceIp);
  }

  let response: Response;
  if (method === 'GET') {
    response = handleFeedbackGet();
  } else if (method === 'POST') {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
      : event.body;
    response = await handleFeedbackPost(new Request(url, { method, headers, body }));
  } else {
    response = Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
    isBase64Encoded: false,
  };
};
