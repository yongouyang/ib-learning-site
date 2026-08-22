// Local stand-in for the S3 + CloudFront topology (docs/aws-deployment-plan.md §2),
// used by `npm run test:e2e:static` — NOT for production:
//   /*           → static export in out/ (like CloudFront's S3 origin:
//                 dir/index.html resolution, 404 → /404.html with 404 status)
//   /api/feedback → the real Next route handler (like the /api/* Lambda
//                 behavior; the Lambda ports this handler 1:1 in Session 3)
// Run with tsx so the handler's `@/` imports resolve via tsconfig paths.

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { bodyForMethod } from './request-body-gating';

const outDir = path.resolve(process.cwd(), 'out');
const portArg = process.argv.indexOf('--port');
const port = portArg !== -1 ? Number(process.argv[portArg + 1]) : 3000;

if (!existsSync(outDir)) {
  console.error('[serve-static] out/ not found — run `npm run build:static` first.');
  process.exit(1);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// Resolve a URL path to a file in out/, mirroring CloudFront+S3 with the
// extensionless-URL export: /foo → /foo.html (the Session-2 CloudFront
// Function does the same rewrite); /foo/ and / also resolve to index.html.
function resolveFile(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const resolved = path.resolve(outDir, '.' + decoded);
  if (!resolved.startsWith(outDir + path.sep) && resolved !== outDir) return null;

  const candidates = [resolved, path.join(resolved, 'index.html'), resolved + '.html'];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

type ApiRoute = {
  GET?: (req: Request) => Promise<Response>;
  POST?: (req: Request) => Promise<Response>;
};

// Delegate one /api path to the real Next route handler — computed specifier
// on purpose: `next build` type-checks this script while build-static.sh has
// src/app/api stashed aside, so a static import path would fail to resolve at
// build time.
async function handleApiRoute(
  modulePath: string,
  urlPath: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const route = (await import(modulePath)) as ApiRoute;

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  headers.set('x-forwarded-for', req.socket.remoteAddress ?? 'local');

  const webReq = new Request(`http://localhost:${port}${urlPath}`, {
    method: req.method,
    headers,
    // Only body-able methods may carry a body — `new Request` throws for
    // GET/HEAD with one (review M4, same gating as the Lambda adapter).
    body: bodyForMethod(req.method, body.length > 0 ? body : undefined),
  });
  const handler = req.method === 'POST' ? route.POST : route.GET;
  if (!handler) {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const webRes = await handler(webReq);

  const responseHeaders = Object.fromEntries(webRes.headers.entries());
  // getSetCookie() preserves every Set-Cookie header — entries() collapses
  // them (review M4; Node accepts an array value for set-cookie here).
  const setCookies = webRes.headers.getSetCookie();
  if (setCookies.length > 0) {
    (responseHeaders as Record<string, string | string[]>)['set-cookie'] = setCookies;
  }

  res.writeHead(webRes.status, responseHeaders);
  res.end(Buffer.from(await webRes.arrayBuffer()));
}

// /api/auth/* → the real Next route handlers, mirroring the CloudFront
// /api/auth/* behavior → auth Lambda (architecture-evolution-plan.md §6.3).
// One module per endpoint, same shapes as src/app/api/auth/*/route.ts.
const AUTH_ROUTES: Record<string, string> = {
  '/api/auth/request-otp': '../src/app/api/auth/request-otp/route',
  '/api/auth/verify-otp': '../src/app/api/auth/verify-otp/route',
  '/api/auth/logout': '../src/app/api/auth/logout/route',
  '/api/auth/me': '../src/app/api/auth/me/route',
  '/api/auth/account': '../src/app/api/auth/account/route',
  '/api/auth/sessions': '../src/app/api/auth/sessions/route',
  '/api/auth/sessions/revoke': '../src/app/api/auth/sessions/revoke/route',
  '/api/auth/export': '../src/app/api/auth/export/route',
  '/api/auth/delete': '../src/app/api/auth/delete/route',
};

// /api/progress/* → the real Next route handlers, mirroring the CloudFront
// /api/progress/* behavior → progress Lambda (architecture-evolution-plan.md §3).
const PROGRESS_ROUTES: Record<string, string> = {
  '/api/progress': '../src/app/api/progress/route',
  '/api/progress/sync': '../src/app/api/progress/sync/route',
  '/api/progress/_health': '../src/app/api/progress/_health/route',
};

// /api/analytics/* → the real Next route handlers, mirroring the CloudFront
// /api/analytics/* behavior → analytics Lambda (docs/phase-a-analytics-plan.md).
const ANALYTICS_ROUTES: Record<string, string> = {
  '/api/analytics/event': '../src/app/api/analytics/event/route',
  '/api/analytics/summary': '../src/app/api/analytics/summary/route',
  '/api/analytics/_health': '../src/app/api/analytics/_health/route',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  if (url.pathname === '/api/feedback') {
    handleApiRoute('../src/app/api/feedback/route', '/api/feedback', req, res).catch((err) => {
      console.error('[serve-static] /api/feedback error:', err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error' }));
    });
    return;
  }
  const authRoute = AUTH_ROUTES[url.pathname] ?? PROGRESS_ROUTES[url.pathname] ?? ANALYTICS_ROUTES[url.pathname];
  if (authRoute) {
    handleApiRoute(authRoute, url.pathname, req, res).catch((err) => {
      console.error(`[serve-static] ${url.pathname} error:`, err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error' }));
    });
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const file = resolveFile(url.pathname);
  if (file) {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
    return;
  }

  // CloudFront custom error response: 404 → app 404, status preserved (§8).
  const notFound = path.join(outDir, '404.html');
  res.writeHead(404, { 'content-type': MIME['.html'] });
  if (existsSync(notFound)) createReadStream(notFound).pipe(res);
  else res.end('Not found');
});

server.listen(port, () => {
  console.log(`[serve-static] Serving out/ + /api/feedback + /api/auth/* + /api/progress/* + /api/analytics/* on http://localhost:${port}`);
});
