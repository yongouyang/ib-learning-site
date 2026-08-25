'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Feature 2 (docs/supportability-features-plan.md §"Feature 2") — DynamoDB CRUD
// dashboard. Direct URL only (not in Nav): /admin/dynamodb. Client page, no
// table lib — every visual is a Tailwind div, consistent with /admin/analytics.
// Fetches the session-gated, admin-allowlisted POST /api/admin/dynamodb endpoint
// (401 = not signed in, 403 = not an admin).

type Operation = 'scan' | 'query' | 'get' | 'put' | 'update' | 'delete';
type Status = 'loading' | 'idle' | 'ok' | 'forbidden' | 'unauthenticated' | 'error';

/** Table key schema returned by the describeTable operation (server type mirror). */
interface KeySchemaElement {
  attributeName: string;
  keyType: 'HASH' | 'RANGE';
}
interface TableDescription {
  table: string;
  keySchema: KeySchemaElement[];
}

const OPERATIONS: Operation[] = ['scan', 'query', 'get', 'put', 'update', 'delete'];

const OPERATION_HELP: Record<Operation, string> = {
  scan: 'Return up to 50 items from the table (optionally continue with the Next button).',
  query: 'Items by key condition — the hash-key equality is prefilled from the table schema; edit the value and optionally add more clauses (e.g. AND sk BETWEEN :a AND :b).',
  get: 'One item by primary key (JSON).',
  put: 'Upsert a full item (JSON) — replaces an existing item with the same key.',
  update: 'Patch an item — UpdateExpression (e.g. SET tier = :t) + key JSON + ExpressionAttributeValues JSON.',
  delete: 'Delete the item with this primary key (JSON).',
};

const inputCls =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const inputErrorCls =
  'w-full rounded-xl border border-red-400 dark:border-red-500 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1';
const fieldErrorCls = 'mt-1 text-xs text-red-600 dark:text-red-400';

/** A parse/validation failure tied to ONE form field (the "highlighted fields").
 * The field key is the state name ('keyJson' | 'expr' | 'exprValuesJson' | 'itemJson'). */
class FieldError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'FieldError';
  }
}

export default function AdminDynamoPage() {
  const { user, loaded } = useAuth();

  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState('');
  const [operation, setOperation] = useState<Operation>('scan');
  const [limit, setLimit] = useState('');
  const [keyJson, setKeyJson] = useState('');
  const [expr, setExpr] = useState('');
  const [exprValuesJson, setExprValuesJson] = useState('');
  const [itemJson, setItemJson] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<Record<string, unknown> | undefined>();
  const [schemas, setSchemas] = useState<Record<string, TableDescription>>({});
  const [busy, setBusy] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dynamodb', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'listTables' }),
      });
      if (res.status === 401) return setStatus('unauthenticated');
      if (res.status === 403) return setStatus('forbidden');
      if (!res.ok) return setStatus('error');
      const body = (await res.json()) as { result: string[] };
      const next = body.result ?? [];
      setTables(next);
      setTable((prev) => next.includes(prev) ? prev : (next[0] ?? ''));
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (loaded && user) void loadTables();
  }, [loaded, user, loadTables]);

  /** Fetch + cache the selected table's key schema (for query defaults). */
  const loadSchema = useCallback(
    async (tbl: string) => {
      if (!tbl || schemas[tbl]) return;
      try {
        const res = await fetch('/api/admin/dynamodb', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'describeTable', table: tbl }),
        });
        if (!res.ok) return; // non-fatal: the query form just lacks a prefill
        const body = (await res.json()) as { result?: TableDescription };
        if (body.result) setSchemas((prev) => ({ ...prev, [tbl]: body.result as TableDescription }));
      } catch {
        // non-fatal
      }
    },
    [schemas]
  );

  useEffect(() => {
    if (table) void loadSchema(table);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  /**
   * Prefill the query form from the table's real key schema (hash-key equality
   * with a placeholder value) so a fresh query RUNS instead of erroring with
   * empty required fields. Only fills fields the user hasn't touched, and only
   * for the query operation.
   */
  useEffect(() => {
    if (operation !== 'query') return;
    const hash = schemas[table]?.keySchema.find((k) => k.keyType === 'HASH');
    if (!hash) return;
    setExpr((prev) => (prev ? prev : `${hash.attributeName} = :pk`));
    setExprValuesJson((prev) => (prev ? prev : '{\n  ":pk": ""\n}'));
  }, [operation, table, schemas]);

  /** Parse a JSON textarea; throws a FieldError naming the failing field. */
  const parseJson = (raw: string, field: string, what: string): Record<string, unknown> => {
    if (!raw.trim()) throw new FieldError(field, `${what} is required`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new FieldError(field, `${what} is not valid JSON`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new FieldError(field, `${what} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  };

  const buildRequest = (exclusiveStartKey?: Record<string, unknown>): Record<string, unknown> => {
    const base = { table, limit: limit ? Number(limit) : undefined };
    switch (operation) {
      case 'scan':
        return { operation, ...base, exclusiveStartKey };
      case 'query':
        return { operation, ...base, expression: expr, expressionValues: parseJson(exprValuesJson, 'exprValuesJson', 'ExpressionAttributeValues'), exclusiveStartKey };
      case 'get':
        return { operation, ...base, key: parseJson(keyJson, 'keyJson', 'Key') };
      case 'put':
        return { operation, ...base, item: parseJson(itemJson, 'itemJson', 'Item') };
      case 'update':
        return { operation, ...base, key: parseJson(keyJson, 'keyJson', 'Key'), expression: expr, expressionValues: parseJson(exprValuesJson, 'exprValuesJson', 'ExpressionAttributeValues') };
      case 'delete':
        return { operation, ...base, key: parseJson(keyJson, 'keyJson', 'Key') };
    }
  };

  const run = useCallback(
    async (exclusiveStartKey?: Record<string, unknown>) => {
      if (!table) return;
      setBusy(true);
      setErrorMsg('');
      setFieldErrors({});
      try {
        const res = await fetch('/api/admin/dynamodb', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildRequest(exclusiveStartKey)),
        });
        if (res.status === 401) return setStatus('unauthenticated');
        if (res.status === 403) return setStatus('forbidden');
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setErrorMsg(body.error ?? 'Request failed');
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { result: { lastEvaluatedKey?: Record<string, unknown> } };
        setResult(body.result);
        setLastEvaluatedKey(body.result?.lastEvaluatedKey);
        setStatus('ok');
      } catch (err) {
        if (err instanceof FieldError) {
          setFieldErrors({ [err.field]: err.message });
          setErrorMsg('Fix the highlighted field(s) below.');
        } else {
          setFieldErrors({});
          setErrorMsg('Unexpected error');
        }
        setStatus('error');
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, operation, limit, keyJson, expr, exprValuesJson, itemJson]
  );

  // Keep the last evaluator from the previous run out of the "idle" display.
  const resultText = useMemo(
    () => (result === null ? null : JSON.stringify(result, null, 2)),
    [result]
  );

  if (!loaded) return null; // no flash while the session round-trips

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'DynamoDB' }]} currentAsHeading />
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Sign in to use the admin console.</p>
          <Link
            href="/login?next=%2Fadmin%2Fdynamodb"
            className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'DynamoDB' }]} currentAsHeading />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Admin DynamoDB browser — full CRUD on the octav-* tables. No nav link: reachable only by this URL.
      </p>

      {status === 'forbidden' && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">You don&rsquo;t have access to this console.</p>
        </div>
      )}
      {status === 'unauthenticated' && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your session has expired — sign in again.
          </p>
          <Link
            href="/login?next=%2Fadmin%2Fdynamodb"
            className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      )}

      {status !== 'forbidden' && status !== 'unauthenticated' && (
        <>
          <div className="card p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="admin-table" className={labelCls}>Table</label>
                <div className="flex gap-2">
                  <select
                    id="admin-table"
                    className={inputCls}
                    value={table}
                    onChange={(e) => {
                      setTable(e.target.value);
                      // Expressions bind to a table's schema — drop the
                      // previous table's draft (the query prefill re-runs).
                      setExpr('');
                      setExprValuesJson('');
                      setFieldErrors({});
                    }}
                  >
                    {tables.length === 0 && <option value="">(no octav-* tables)</option>}
                    {tables.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadTables()}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="admin-op" className={labelCls}>Operation</label>
                <select
                  id="admin-op"
                  className={inputCls}
                  value={operation}
                  onChange={(e) => setOperation(e.target.value as Operation)}
                >
                  {OPERATIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">{OPERATION_HELP[operation]}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {(operation === 'scan' || operation === 'query') && (
                <div>
                  <label htmlFor="admin-limit" className={labelCls}>Limit (optional, default 50)</label>
                  <input
                    id="admin-limit"
                    type="number"
                    min={1}
                    max={100}
                    className={inputCls}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="50"
                  />
                </div>
              )}
              {(operation === 'get' || operation === 'update' || operation === 'delete') && (
                <div className={operation === 'get' || operation === 'delete' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="admin-key" className={labelCls}>Key (JSON)</label>
                  <textarea
                    id="admin-key"
                    rows={2}
                    className={(fieldErrors.keyJson ? inputErrorCls : inputCls) + ' font-mono'}
                    value={keyJson}
                    onChange={(e) => setKeyJson(e.target.value)}
                    placeholder='{"id": "user-1"}'
                    aria-invalid={Boolean(fieldErrors.keyJson)}
                    aria-describedby={fieldErrors.keyJson ? 'admin-key-error' : undefined}
                  />
                  {fieldErrors.keyJson && (
                    <p id="admin-key-error" className={fieldErrorCls}>{fieldErrors.keyJson}</p>
                  )}
                </div>
              )}
              {(operation === 'query' || operation === 'update') && (
                <div>
                  <label htmlFor="admin-expr" className={labelCls}>
                    {operation === 'query' ? 'KeyConditionExpression' : 'UpdateExpression'}
                  </label>
                  <textarea
                    id="admin-expr"
                    rows={2}
                    className={(fieldErrors.expr ? inputErrorCls : inputCls) + ' font-mono'}
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    placeholder={operation === 'query' ? 'id = :id' : 'SET tier = :t'}
                    aria-invalid={Boolean(fieldErrors.expr)}
                    aria-describedby={fieldErrors.expr ? 'admin-expr-error' : undefined}
                  />
                  {fieldErrors.expr && (
                    <p id="admin-expr-error" className={fieldErrorCls}>{fieldErrors.expr}</p>
                  )}
                </div>
              )}
              {(operation === 'query' || operation === 'update') && (
                <div>
                  <label htmlFor="admin-expr-values" className={labelCls}>ExpressionAttributeValues (JSON)</label>
                  <textarea
                    id="admin-expr-values"
                    rows={2}
                    className={(fieldErrors.exprValuesJson ? inputErrorCls : inputCls) + ' font-mono'}
                    value={exprValuesJson}
                    onChange={(e) => setExprValuesJson(e.target.value)}
                    placeholder='{":pk": "user-1"}'
                    aria-invalid={Boolean(fieldErrors.exprValuesJson)}
                    aria-describedby={fieldErrors.exprValuesJson ? 'admin-expr-values-error' : undefined}
                  />
                  {fieldErrors.exprValuesJson && (
                    <p id="admin-expr-values-error" className={fieldErrorCls}>{fieldErrors.exprValuesJson}</p>
                  )}
                </div>
              )}
              {operation === 'put' && (
                <div className="sm:col-span-2">
                  <label htmlFor="admin-item" className={labelCls}>Item (JSON)</label>
                  <textarea
                    id="admin-item"
                    rows={4}
                    className={(fieldErrors.itemJson ? inputErrorCls : inputCls) + ' font-mono'}
                    value={itemJson}
                    onChange={(e) => setItemJson(e.target.value)}
                    placeholder='{"id": "user-9", "email": "new@example.com", "tier": "free"}'
                    aria-invalid={Boolean(fieldErrors.itemJson)}
                    aria-describedby={fieldErrors.itemJson ? 'admin-item-error' : undefined}
                  />
                  {fieldErrors.itemJson && (
                    <p id="admin-item-error" className={fieldErrorCls}>{fieldErrors.itemJson}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || !table}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Running…' : `Run ${operation}`}
              </button>
              {(operation === 'scan' || operation === 'query') && lastEvaluatedKey && (
                <button
                  type="button"
                  onClick={() => void run(lastEvaluatedKey)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Next page
                </button>
              )}
              {errorMsg && <span className="text-sm text-red-600 dark:text-red-400">{errorMsg}</span>}
            </div>
          </div>

          {status === 'error' && !errorMsg && (
            <div className="card p-6 text-center mt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&rsquo;t reach the admin API.</p>
            </div>
          )}

          {result !== null && status === 'ok' && (
            <div className="card p-4 mt-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">Result</h2>
              {typeof result === 'object' && result !== null && 'items' in (result as object) ? (
                <ResultTable data={result as { items: Array<Record<string, unknown>>; count: number; lastEvaluatedKey?: Record<string, unknown> }} />
              ) : (
                <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap break-words">
                  {resultText}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Render a scan/query result as a dynamic-column table. */
function ResultTable({ data }: { data: { items: Array<Record<string, unknown>>; count: number } }) {
  const items = useMemo(() => data.items ?? [], [data.items]);
  const columns = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) for (const key of Object.keys(item)) seen.add(key);
    return [...seen];
  }, [items]);

  if (items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No items in this page.</p>;
  }

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {data.count} item{data.count === 1 ? '' : 's'} in this page
      </p>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="text-left bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              {columns.map((c) => (
                <th key={c} className="py-1.5 pr-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-gray-900 align-top">
                {columns.map((c) => (
                  <td key={c} className="py-1.5 pr-3 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {formatCell(item[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}
