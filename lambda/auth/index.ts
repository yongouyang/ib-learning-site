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
import {
  METHODS_WITH_BODY,
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production auth Lambda (docs/architecture-evolution-plan.md §6): thin adapter
// between the Lambda Function URL event shape (HTTP API v2) and the shared
// handler in src/lib/auth/http-handler.ts — the same contract as the Next
// routes, which remain the dev/e2e path. CloudFront routes /api/auth/* to this
// function; direct Function URL hits work too. Dependencies (DynamoDB + SES)
// are wired via env vars in terraform/modules/auth_api.
//
// Hardening (review M4 + rounds 2/3): bodies are only forwarded for methods
// that allow one (GET/HEAD with a body would throw in Request), handler
// failures are caught and returned as controlled JSON 500s, Set-Cookie values
// go out via the HTTP API v2 `cookies` array (never a ", "-joined headers
// value), and the X-Forwarded-For handling discriminates between the two
// network topologies this function serves (see resolveForwardedFor below).

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

// --- X-Forwarded-For resolution (round 3) -------------------------------------
//
// The two topologies this function serves need OPPOSITE XFF handling, and the
// handler (clientIp) trusts the LAST XFF entry:
//
//   (a) browser → CloudFront → this Function URL (the ONLY prod path):
//       CloudFront's AllViewerExceptHostHeader origin-request policy forwards
//       viewer headers and APPENDS the real viewer IP to XFF, so the last
//       entry IS the viewer IP. But the Function URL's requestContext.sourceIp
//       is the TCP peer = a CLOUDFRONT EDGE egress IP. Appending it here (the
//       round-2 rule) made every viewer behind an edge share one limiter
//       bucket (false 429s), diluted the per-IP line by the edge count, and
//       polluted session.ip with edge IPs. → We must TRUST the last entry.
//
//   (b) direct Function URL hit: XFF is fully caller-controlled, so trusting
//       the last entry lets an attacker rotate the limiter key. → We must
//       APPEND sourceIp (the true peer).
//
// No header discriminates the two soundly: x-amz-cf-id, Via, etc. are all
// forgeable by a direct caller (a forged x-amz-cf-id must not re-open the
// spoofing hole, so this code NEVER consults it). The one unspoofable datum
// is sourceIp itself: when the peer is a CloudFront edge (sourceIp ∈ the
// published CloudFront ranges from ip-ranges.amazonaws.com) the chain was
// appended by CloudFront and the last entry is the viewer IP; otherwise the
// caller is the direct peer and sourceIp is appended. An attacker cannot make
// their sourceIp appear inside CloudFront's ranges without actually sourcing
// from CloudFront infrastructure.
//
// Ranges load asynchronously at cold start and never block a request; until
// they load the checker returns null and we TRUST the last entry (primary
// path stays correct — the direct-hit residual during the load window is
// documented in PROGRESS.md).

type CloudFrontIpCheck = (ip: string) => boolean | null;

let cloudFrontIpCheck: CloudFrontIpCheck = () => null;

/** Test hook (and the loader's install point): inject a fake checker. */
export function setCloudFrontIpChecker(checker: CloudFrontIpCheck | null): void {
  cloudFrontIpCheck = checker ?? (() => null);
}

const CLOUDFRONT_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
const CLOUDFRONT_SERVICES = new Set(['CLOUDFRONT', 'CLOUDFRONT_ORIGIN_FACING']);

function expandIpv6(ip: string): bigint | null {
  const parts = ip.split('::');
  if (parts.length > 2) return null; // multiple '::' (round 4: reject, don't silently truncate)
  const head = parts[0] ?? '';
  const tail = parts.length === 2 ? parts[1] : undefined;
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  if (tail === undefined && headParts.length !== 8) return null; // no '::' → must be fully expanded
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  const groups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  if (groups.length !== 8) return null;
  let value = BigInt(0);
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    value = (value << BigInt(16)) | BigInt(parseInt(group, 16));
  }
  return value;
}

function ipv4ToBigInt(ip: string): bigint | null {
  // Strict decimal parts only (round 4): rejects '', '0x1', '1e2', ' 1', '+1',
  // '1.5' — a lenient Number() conversion silently re-wrote junk into 0s.
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return BigInt(nums[0]) * BigInt(16777216) + BigInt(nums[1]) * BigInt(65536) + BigInt(nums[2]) * BigInt(256) + BigInt(nums[3]);
}

interface CidrRange {
  base: bigint;
  mask: bigint;
  totalBits: bigint;
  isV4: boolean;
}

function parseCidr(cidr: string): CidrRange | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null; // rejects trailing '/extra' (round 4)
  const [addr, bitsStr] = parts;
  const bits = Number(bitsStr);
  if (!addr || !/^\d+$/.test(bitsStr) || !Number.isInteger(bits)) return null;
  if (addr.includes('.')) {
    if (bits < 0 || bits > 32) return null;
    const base = ipv4ToBigInt(addr);
    if (base === null) return null;
    const totalBits = BigInt(32);
    const mask = bits === 32 ? (BigInt(1) << totalBits) - BigInt(1) : ((BigInt(1) << BigInt(bits)) - BigInt(1)) << (totalBits - BigInt(bits));
    return { base, mask, totalBits, isV4: true };
  }
  if (bits < 0 || bits > 128) return null;
  const base = expandIpv6(addr);
  if (base === null) return null;
  const totalBits = BigInt(128);
  const mask = bits === 128 ? (BigInt(1) << totalBits) - BigInt(1) : ((BigInt(1) << BigInt(bits)) - BigInt(1)) << (totalBits - BigInt(bits));
  return { base, mask, totalBits, isV4: false };
}

function inCidr(ip: string, range: CidrRange): boolean {
  const isV4 = ip.includes('.');
  if (isV4 !== range.isV4) return false;
  // v4-mapped-in-v6 forms ('::ffff:1.2.3.4') are rejected by expandIpv6 (the
  // final group fails the hex check) — ip-ranges.json and AWS sourceIps use
  // pure v4 or pure v6, so this is the desired strictness.
  const value = isV4 ? ipv4ToBigInt(ip) : expandIpv6(ip);
  if (value === null) return false;
  return (value & range.mask) === (range.base & range.mask);
}

// Exported for the adapter unit tests (pure helpers; the prod path only uses
// them via the ranges loader).
export { parseCidr, inCidr };

async function loadCloudFrontIpChecker(): Promise<void> {
  try {
    const res = await fetch(CLOUDFRONT_RANGES_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const data = (await res.json()) as {
      prefixes?: { ip_prefix: string; service: string }[];
      ipv6_prefixes?: { ipv6_prefix: string; service: string }[];
    };
    const cidrs = [
      ...(data.prefixes ?? []).filter((p) => CLOUDFRONT_SERVICES.has(p.service)).map((p) => p.ip_prefix),
      ...(data.ipv6_prefixes ?? []).filter((p) => CLOUDFRONT_SERVICES.has(p.service)).map((p) => p.ipv6_prefix),
    ];
    const ranges = cidrs.map(parseCidr).filter((r): r is CidrRange => r !== null);
    if (ranges.length === 0) return;
    cloudFrontIpCheck = (ip: string) => ranges.some((r) => inCidr(ip, r));
    checkerInstalled = true;
  } catch {
    // Load failed — the checker stays null and ensureCloudFrontIpCheckerLoaded
    // retries after RANGES_RETRY_INTERVAL_MS (round 4: a failed cold-start
    // load is NOT permanent).
  }
}

let rangesLoadStarted = false;
let lastLoadAttemptAt = 0;
let loadInFlight = false;
let checkerInstalled = false;
const RANGES_RETRY_INTERVAL_MS = 5 * 60_000;

/**
 * Kick the CloudFront-ranges load. Fire-and-forget: NEVER blocks a request,
 * and at most one fetch is in flight. While the checker is not installed the
 * loader retries every RANGES_RETRY_INTERVAL_MS, so a failed cold-start load
 * does not permanently leave direct-hit XFF spoofing open (round 4). Skipped
 * in the unit-test process only — and NOT when a Lambda runtime env var is
 * present, so a leaked NODE_ENV=test cannot silently disable loading in prod
 * (round 4). Exported with an injectable clock for tests.
 */
export function ensureCloudFrontIpCheckerLoaded(now: number = Date.now()): void {
  if (process.env.NODE_ENV === 'test' && !process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  if (checkerInstalled || loadInFlight) return;
  if (rangesLoadStarted && now - lastLoadAttemptAt < RANGES_RETRY_INTERVAL_MS) return;
  rangesLoadStarted = true;
  lastLoadAttemptAt = now;
  loadInFlight = true;
  loadCloudFrontIpChecker()
    .catch(() => {})
    .finally(() => {
      loadInFlight = false;
    });
}

/** Test hook: reset the loader state + checker between tests. */
export function __resetCloudFrontRangeLoader(): void {
  cloudFrontIpCheck = () => null;
  checkerInstalled = false;
  rangesLoadStarted = false;
  lastLoadAttemptAt = 0;
  loadInFlight = false;
}

/** Test hook: probe the currently installed checker. */
export function __getCloudFrontIpChecker(): CloudFrontIpCheck {
  return cloudFrontIpCheck;
}

/**
 * Apply the topology-aware XFF rule to the forwarded headers (round 3).
 * Exported for the adapter unit tests.
 */
export function resolveForwardedFor(headers: Headers, sourceIp: string | undefined): void {
  if (!sourceIp) return;
  const existing = headers.get('x-forwarded-for');
  if (!existing) {
    // No chain at all → nothing to trust; key on the direct peer.
    headers.set('x-forwarded-for', sourceIp);
    return;
  }
  const last = existing.split(',').map((s) => s.trim()).filter(Boolean).pop() ?? '';
  if (last === sourceIp) return; // chain already terminates at the peer

  const peerIsCloudFront = cloudFrontIpCheck(sourceIp);
  if (peerIsCloudFront === true) {
    // CloudFront appended the viewer IP as the last entry — trust it.
    return;
  }
  if (peerIsCloudFront === false) {
    // Direct caller: any existing chain is spoofable — terminate it at the
    // real peer so the handler's last-entry trust cannot be rotated.
    headers.set('x-forwarded-for', `${existing}, ${sourceIp}`);
    return;
  }
  // Unknown (checker not installed: initial load pending or retrying) —
  // trust the existing chain. The CloudFront path is CORRECT under this
  // branch (its last entry is the viewer IP); the residual is limited to
  // direct hits and is bounded by the 5-minute retry loop, not permanent
  // (round 4). An attacker cannot force this branch — only the ranges fetch
  // failing can.
}

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const { url, method, headers, body } = toWebRequest(event);

  ensureCloudFrontIpCheckerLoaded();
  resolveForwardedFor(headers, event.requestContext?.http?.sourceIp);

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
        console.error('[auth] handler error:', err instanceof Error ? err.message : err);
        response = Response.json({ error: 'Internal error' }, { status: 500 });
      }
    }
  }

  return toLambdaResult(response);
};

// Re-exported for the adapter unit tests (the shared implementation lives in
// lambda/shared/lambda-adapter.ts — one source of truth for both lambdas).
export { toLambdaResult, METHODS_WITH_BODY };
