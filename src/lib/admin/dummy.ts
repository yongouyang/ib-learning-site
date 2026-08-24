import type { AdminScanResult, AdminStorage } from './types';
import { ADMIN_SCAN_LIMIT_DEFAULT } from './types';

// In-memory admin CRUD dummy — the controllable-dummy directive (AGENTS.md):
// dev and e2e run against this with zero AWS resources. It is a GENERIC table
// store (a DynamoDB stand-in), deliberately INDEPENDENT of the shared
// auth/progress universe (which is structured per-entity, not per-table).
// Seeded with the real octav-* table names + a few fixture rows so the
// dashboard and e2e have something to browse; tests construct fresh instances
// (or seed/clear directly) for deterministic cases. Every write mirrors the
// DynamoDB adapter's observable semantics for the supported subset (see the
// parity test).

const SEED: Record<string, Array<Record<string, unknown>>> = {
  'octav-users': [
    { id: 'user-admin', email: 'admin@example.com', tier: 'premium', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'user-1', email: 'student1@example.com', tier: 'free', createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'user-2', email: 'student2@example.com', tier: 'free', createdAt: '2026-08-03T00:00:00.000Z' },
  ],
  'octav-sessions': [{ sessionId: 'sess-1', userId: 'user-1', expiresAt: 2000000000 }],
  'octav-progress': [{ pk: 'PROFILE#p1', sk: 'TOPIC#p1#math:t1#a1', stars: 3 }],
  'octav-rate-limits': [{ key: 'aimark:user-1:2026-08', count: 5 }],
  'octav-analytics-events': [{ k: 'agg', s: 'ev|2026-08-15|page_view', count: 42 }],
  'octav-leaderboard': [{ week: '2026-W33', userId: 'user-1', xp: 120 }],
};

/**
 * A write that mutates an item in place. Throws a DynamoDB-shaped error for
 * the "no item with this key" case so the handler reports it like prod would.
 */
export class InMemoryAdminStorage implements AdminStorage {
  private readonly tables = new Map<string, Array<Record<string, unknown>>>();

  constructor(seed: Record<string, Array<Record<string, unknown>>> = SEED) {
    for (const [name, items] of Object.entries(seed)) {
      this.tables.set(name, items.map((item) => ({ ...item })));
    }
  }

  /** Replace the whole store (test helper). */
  reset(seed: Record<string, Array<Record<string, unknown>>> = SEED): void {
    this.tables.clear();
    for (const [name, items] of Object.entries(seed)) {
      this.tables.set(name, items.map((item) => ({ ...item })));
    }
  }

  async listTables(): Promise<string[]> {
    return [...this.tables.keys()];
  }

  async scan(
    table: string,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult> {
    return this.paginate(this.requireTable(table), limit, exclusiveStartKey);
  }

  async query(
    table: string,
    keyConditionExpression: string,
    expressionValues: Record<string, unknown>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult> {
    const matches = this.requireTable(table).filter((item) =>
      keyConditionExpression
        .split(/\s+AND\s+/i)
        .every((clause) => this.matchClause(item, clause, expressionValues))
    );
    return this.paginate(matches, limit, exclusiveStartKey);
  }

  async get(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const item = this.requireTable(table).find((existing) => this.matchesKey(existing, key));
    return item ? { ...item } : null;
  }

  async put(table: string, item: Record<string, unknown>): Promise<void> {
    const items = this.requireTable(table);
    // DynamoDB PutItem replaces by PRIMARY KEY. Our generic store treats the
    // item's first attribute as the PK (same convention as pseudoKey below),
    // so an upsert matches on that attribute alone — not all-attributes-equal
    // (which would never match an update to a different field).
    const first = Object.entries(item)[0];
    const idx = first ? items.findIndex((existing) => existing[first[0]] === first[1]) : -1;
    if (idx >= 0) items[idx] = { ...item };
    else items.push({ ...item });
  }

  async update(
    table: string,
    key: Record<string, unknown>,
    updateExpression: string,
    expressionValues: Record<string, unknown>
  ): Promise<void> {
    const target = this.requireTable(table).find((item) => this.matchesKey(item, key));
    if (!target) {
      throw Object.assign(new Error('The conditional request failed'), {
        name: 'ConditionalCheckFailedException',
        code: 'ConditionalCheckFailedException',
      });
    }
    applyUpdateExpression(target, updateExpression, expressionValues);
  }

  async delete(table: string, key: Record<string, unknown>): Promise<void> {
    const items = this.requireTable(table);
    const idx = items.findIndex((item) => this.matchesKey(item, key));
    if (idx >= 0) items.splice(idx, 1);
  }

  async probe(): Promise<void> {
    // No IAM/table to fail in-memory — a no-op (its DynamoDB counterpart
    // exercises the ListTables grant).
  }

  // --- Internals ---------------------------------------------------------------

  private requireTable(table: string): Array<Record<string, unknown>> {
    const items = this.tables.get(table);
    if (!items) {
      throw Object.assign(new Error(`Cannot do operations on a non-existent table`), {
        name: 'ResourceNotFoundException',
        code: 'ResourceNotFoundException',
      });
    }
    return items;
  }

  private matchesKey(item: Record<string, unknown>, key: Record<string, unknown>): boolean {
    return Object.entries(key).every(([k, v]) => item[k] === v);
  }

  /** Equality-clause evaluator for query (only `attr = :val` clauses). */
  private matchClause(
    item: Record<string, unknown>,
    clause: string,
    values: Record<string, unknown>
  ): boolean {
    const m = clause.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(:[A-Za-z0-9_]+)$/);
    if (!m) return false; // unsupported clause shape → never matches
    return item[m[1]] === values[m[2]];
  }

  private paginate(
    items: Array<Record<string, unknown>>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): AdminScanResult {
    let pageable = items;
    if (exclusiveStartKey) {
      const start = pageable.findIndex((item) => this.matchesKey(item, exclusiveStartKey));
      if (start >= 0) pageable = pageable.slice(start + 1);
    }
    const cap = limit ?? ADMIN_SCAN_LIMIT_DEFAULT;
    const page = pageable.slice(0, cap);
    return {
      items: page.map((item) => ({ ...item })),
      count: page.length,
      lastEvaluatedKey:
        pageable.length > cap && page.length > 0 ? this.pseudoKey(page[page.length - 1]) : undefined,
    };
  }

  /** Deterministic cursor = the item's first attribute (unique in fixture data). */
  private pseudoKey(item: Record<string, unknown>): Record<string, unknown> {
    const entry = Object.entries(item)[0];
    return entry ? { [entry[0]]: entry[1] } : {};
  }
}

/**
 * Minimal UpdateExpression evaluator for the dummy — the subset the dashboard
 * and e2e use: `SET a = :va, b = :vb` and `REMOVE c, d` on top-level
 * attributes. Anything else throws (the DynamoDB adapter would execute it; the
 * dummy covers the supported subset for dev/e2e).
 */
function applyUpdateExpression(
  target: Record<string, unknown>,
  updateExpression: string,
  values: Record<string, unknown>
): void {
  let applied = false;

  const setMatch = updateExpression.match(/^SET\s+(.+?)(?:\s+REMOVE\s+.+)?$/i);
  if (setMatch) {
    for (const assignment of setMatch[1].split(',')) {
      const m = assignment.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(:[A-Za-z0-9_]+)$/);
      if (!m) throw new Error('Unsupported SET assignment in update expression');
      target[m[1]] = values[m[2]];
      applied = true;
    }
  }

  const removeMatch = updateExpression.match(/REMOVE\s+([A-Za-z0-9_,\s]+)$/i);
  if (removeMatch) {
    for (const attr of removeMatch[1].split(',')) {
      const name = attr.trim();
      if (name) {
        delete target[name];
        applied = true;
      }
    }
  }

  if (!applied) {
    throw new Error('Unsupported update expression');
  }
}

// Singleton for the shared dev/e2e process (mirrors getSharedDummyUniverse).
let sharedAdminDummy: InMemoryAdminStorage | null = null;
export function getAdminDummy(): InMemoryAdminStorage {
  if (!sharedAdminDummy) sharedAdminDummy = new InMemoryAdminStorage();
  return sharedAdminDummy;
}
