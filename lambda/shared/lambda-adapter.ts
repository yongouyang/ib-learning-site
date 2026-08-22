// Shared Lambda Function URL adapter plumbing (Phase B/C): event → Request
// conversion, method body-gating, and the Response → HTTP API v2 result
// conversion (Set-Cookie via the dedicated `cookies` array). Used by BOTH
// lambda/auth and lambda/progress — one source of truth.

export const METHODS_WITH_BODY: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface LambdaHttpResult {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[]; // Set-Cookie values (HTTP API v2 `cookies` field)
  body: string;
  isBase64Encoded: boolean;
}

export interface FunctionUrlEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string; sourceIp?: string } };
}

/** Headers from the event, with the sourceIp injected as XFF when absent. */
export function eventHeaders(event: FunctionUrlEvent): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(key, value);
  }
  const sourceIp = event.requestContext?.http?.sourceIp;
  if (sourceIp && !headers.has('x-forwarded-for')) {
    headers.set('x-forwarded-for', sourceIp);
  }
  return headers;
}

/** Request URL + method + headers + (method-gated) body from the event. */
export function toWebRequest(event: FunctionUrlEvent): { url: string; method: string; headers: Headers; body: string | undefined } {
  const method = event.requestContext?.http?.method ?? 'GET';
  const host = event.headers?.host ?? 'localhost';
  const path = event.rawPath ?? '/';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${host}${path}${query}`;
  const headers = eventHeaders(event);
  // Only forward a body for methods that permit one — `new Request` with a
  // body on GET/HEAD throws (review M4).
  const body =
    METHODS_WITH_BODY.has(method) && event.body !== undefined
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body
      : undefined;
  return { url, method, headers, body };
}

/**
 * Convert a Response to the Lambda Function URL (HTTP API v2) result shape.
 * Set-Cookie values go in the dedicated `cookies` array — folding them into
 * the headers map with ", " joins is not reliably client-parseable (round 2).
 */
export async function toLambdaResult(response: Response): Promise<LambdaHttpResult> {
  const headers = Object.fromEntries(response.headers.entries());
  delete headers['set-cookie']; // any entry-side copy must not double up with `cookies`

  const cookies = response.headers.getSetCookie();

  return {
    statusCode: response.status,
    headers,
    cookies: cookies.length > 0 ? cookies : undefined,
    body: await response.text(),
    isBase64Encoded: false,
  };
}
