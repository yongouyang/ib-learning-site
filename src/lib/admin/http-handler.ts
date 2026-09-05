import { z } from 'zod';
import { resolveSession } from '../auth/session';
import { devGateDenied, DEV_GATE_ERROR } from '../auth/dev-gate';
import { getAdminDeps } from './deps';
import type { AdminDeps } from './deps';
import type { AdminRequest } from './types';
import {
  ADMIN_BODY_BYTES_MAX,
  ADMIN_SCAN_LIMIT_MAX,
  ADMIN_TABLE_PATTERN,
} from './types';

// Admin CRUD dashboard handler (Feature 2, docs/supportability-features-plan.md
// §"Feature 2"). Single source of truth for the POST /api/admin/dynamodb
// contract: the Next route (dev/e2e — D2) and the production Lambda (octav-admin
// behind the CloudFront /api/admin/* behavior) both delegate here, exactly like
// the analytics/progress handlers.
//
// Security model: this endpoint is a BROAD DynamoDB browser (every octav-*
// table, full CRUD), so the auth bar is high — a valid session AND an admin
// allowlist match (same ANALYTICS_ADMIN_EMAILS gate as the analytics dashboard).
// Defense in depth on top of the Lambda IAM: table names are restricted to the
// octav-* prefix server-side, and operations/fields are schema-validated.

/** Every response is built here so Cache-Control: no-store is uniform. */
function json(body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function withCookie(res: Response, cookie: string): Response {
  res.headers.append('Set-Cookie', cookie);
  return res;
}

/** Case-insensitive, comma-separated admin allowlist membership (same as analytics). */
export function isAdminEmail(email: string, adminEmails: string): boolean {
  const allow = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}

// --- Request schema -----------------------------------------------------------

const recordSchema = z.record(z.string(), z.unknown());

const adminRequestSchema = z.object({
  operation: z.enum(['listTables', 'describeTable', 'scan', 'query', 'get', 'put', 'update', 'delete']),
  table: z.string().optional(),
  key: recordSchema.optional(),
  expression: z.string().optional(),
  expressionValues: recordSchema.optional(),
  item: recordSchema.optional(),
  limit: z.number().int().positive().max(ADMIN_SCAN_LIMIT_MAX).optional(),
  exclusiveStartKey: recordSchema.optional(),
});

/** Per-operation required-field validation. Returns null when OK, else an error message. */
function validateOperation(op: AdminRequest): string | null {
  const table = typeof op.table === 'string' && op.table.trim() ? op.table : null;

  if (op.operation !== 'listTables' && !table) return 'table is required';
  if (op.operation !== 'listTables' && !ADMIN_TABLE_PATTERN.test(op.table as string)) {
    return 'table must be an octav-* table';
  }

  switch (op.operation) {
    case 'listTables':
    case 'describeTable':
    case 'scan':
      return null;
    case 'query':
      if (typeof op.expression !== 'string' || !op.expression.trim()) return 'expression is required';
      if (!op.expressionValues || typeof op.expressionValues !== 'object') {
        return 'expressionValues is required';
      }
      return null;
    case 'get':
    case 'delete':
      return op.key && typeof op.key === 'object' && Object.keys(op.key).length > 0
        ? null
        : 'key is required';
    case 'put':
      return op.item && typeof op.item === 'object' && Object.keys(op.item).length > 0
        ? null
        : 'item is required';
    case 'update':
      if (!op.key || typeof op.key !== 'object' || Object.keys(op.key).length === 0) {
        return 'key is required';
      }
      if (typeof op.expression !== 'string' || !op.expression.trim()) return 'expression is required';
      if (!op.expressionValues || typeof op.expressionValues !== 'object') {
        return 'expressionValues is required';
      }
      return null;
  }
}

async function dispatch(op: AdminRequest, storage: AdminDeps['storage']): Promise<unknown> {
  switch (op.operation) {
    case 'listTables':
      // Filter + sort server-side so non-octav table names never leak.
      return (await storage.listTables()).filter((t) => ADMIN_TABLE_PATTERN.test(t)).sort();
    case 'describeTable':
      return storage.describeTable(op.table as string);
    case 'scan':
      return storage.scan(op.table as string, op.limit, op.exclusiveStartKey);
    case 'query':
      return storage.query(
        op.table as string,
        op.expression as string,
        op.expressionValues as Record<string, unknown>,
        op.limit,
        op.exclusiveStartKey
      );
    case 'get':
      return { item: await storage.get(op.table as string, op.key as Record<string, unknown>) };
    case 'put':
      await storage.put(op.table as string, op.item as Record<string, unknown>);
      return { success: true };
    case 'update':
      await storage.update(
        op.table as string,
        op.key as Record<string, unknown>,
        op.expression as string,
        (op.expressionValues ?? {}) as Record<string, unknown>
      );
      return { success: true };
    case 'delete':
      await storage.delete(op.table as string, op.key as Record<string, unknown>);
      return { success: true };
  }
}

/** POST /api/admin/dynamodb — session-gated, admin allowlist, CRUD dispatch. */
export async function handleAdminDynamo(
  req: Request,
  deps: AdminDeps = getAdminDeps()
): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const text = await req.text();
  if (text.length > ADMIN_BODY_BYTES_MAX) return json({ error: 'Invalid request' }, 400);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const parsed = adminRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid request' }, 400);

  const op = parsed.data as AdminRequest;

  const auth = await resolveSession(req, deps.sessionStorage);
  if (!auth.ok) return json({ error: 'Not authenticated.' }, 401);
  if (devGateDenied(req, auth.user.email)) return json({ error: DEV_GATE_ERROR }, 403);
  if (!isAdminEmail(auth.user.email, deps.adminEmails)) {
    return json({ error: 'Not authorized.' }, 403);
  }

  const opError = validateOperation(op);
  if (opError) return withCookie(json({ error: opError }, 400), auth.refreshCookie);

  try {
    const result = await dispatch(op, deps.storage);
    return withCookie(json({ result }), auth.refreshCookie);
  } catch (err) {
    console.error('[admin] dynamodb operation failed:', err instanceof Error ? err.message : err);
    // 400 for client-shaped errors (bad key/expression/table/validation), 500
    // otherwise (missing IAM grant, network, etc.).
    const status =
      err instanceof Error &&
      ['ConditionalCheckFailedException', 'ResourceNotFoundException', 'ValidationException'].includes(err.name)
        ? 400
        : 500;
    return withCookie(json({ error: 'Operation failed' }, status), auth.refreshCookie);
  }
}

/** GET /api/admin/_health — unauthenticated IAM probe (CI smoke). */
export async function handleAdminHealth(
  _req: Request,
  deps: AdminDeps = getAdminDeps()
): Promise<Response> {
  // Exercises the ListTables IAM grant (the real failure class: missing
  // permission / wrong region → 500). 200 = the grant works.
  try {
    await deps.storage.probe();
    return json({ ok: true });
  } catch (err) {
    console.error('[admin] health probe failed:', err instanceof Error ? err.message : err);
    return json({ ok: false }, 500);
  }
}

/**
 * GET /api/admin/access — session-gated admin check that the client uses to
 * decide whether to show the in-app "Admin console" entry (the admin pages are
 * direct-URL only, which the installed PWA can't reach — the account page
 * links here instead). Returns 401 for no session, else 200 with a boolean, so
 * the client distinguishes "not signed in" from "signed in but not admin"
 * without treating a denial as an error.
 */
export async function handleAdminAccess(
  req: Request,
  deps: AdminDeps = getAdminDeps()
): Promise<Response> {
  const auth = await resolveSession(req, deps.sessionStorage);
  if (!auth.ok) return json({ error: 'Not authenticated.' }, 401);
  if (devGateDenied(req, auth.user.email)) return json({ error: DEV_GATE_ERROR }, 403);
  return withCookie(json({ admin: isAdminEmail(auth.user.email, deps.adminEmails) }), auth.refreshCookie);
}
