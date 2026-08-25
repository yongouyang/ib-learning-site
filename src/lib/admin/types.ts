// Admin CRUD dashboard — types (Feature 2, docs/supportability-features-plan.md
// §"Feature 2"). Framework-agnostic contract for the /api/admin/dynamodb
// endpoint: the Next route (dev/e2e) and the production Lambda (octav-admin,
// behind the CloudFront /api/admin/* behavior) both delegate to the shared
// handler in ./http-handler.ts. This is a thin, generic DynamoDB browser —
// every octav-* table is reachable for scan/query/get/put/update/delete,
// bounded only by the handler's table-name allowlist and the Lambda's IAM.

/** The single POST /api/admin/dynamodb operation set. */
export type AdminOperation =
  | 'listTables'
  | 'describeTable'
  | 'scan'
  | 'query'
  | 'get'
  | 'put'
  | 'update'
  | 'delete';

/** Client → handler request body (fields are operation-dependent). */
export interface AdminRequest {
  operation: AdminOperation;
  /** Target table — required for every operation except listTables. */
  table?: string;
  /** Primary key (JS object) for get/update/delete. */
  key?: Record<string, unknown>;
  /** KeyConditionExpression (query) or UpdateExpression (update). */
  expression?: string;
  /** ExpressionAttributeValues for query/update. */
  expressionValues?: Record<string, unknown>;
  /** Full item (JS object) for put. */
  item?: Record<string, unknown>;
  /** Result cap (default 50, max 100). */
  limit?: number;
  /** Pagination cursor from a previous scan/query (LastEvaluatedKey). */
  exclusiveStartKey?: Record<string, unknown>;
}

/** scan/query result page. */
export interface AdminScanResult {
  items: Array<Record<string, unknown>>;
  count: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

/** One element of a table's primary-key schema (DescribeTable KeySchema). */
export interface AdminKeySchemaElement {
  attributeName: string;
  keyType: 'HASH' | 'RANGE';
}

/** Table metadata the dashboard uses to prefill query defaults. */
export interface AdminTableDescription {
  table: string;
  keySchema: AdminKeySchemaElement[];
}

/** Storage seam — the DynamoDB adapter in prod, the seeded dummy in dev/e2e. */
export interface AdminStorage {
  listTables(): Promise<string[]>;
  describeTable(table: string): Promise<AdminTableDescription>;
  scan(
    table: string,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult>;
  query(
    table: string,
    keyConditionExpression: string,
    expressionValues: Record<string, unknown>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult>;
  get(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  put(table: string, item: Record<string, unknown>): Promise<void>;
  update(
    table: string,
    key: Record<string, unknown>,
    updateExpression: string,
    expressionValues: Record<string, unknown>
  ): Promise<void>;
  delete(table: string, key: Record<string, unknown>): Promise<void>;
  /** _health probe — exercises a real failure class (IAM/region) in prod. */
  probe(): Promise<void>;
}

// --- Bounds ------------------------------------------------------------------

/** Max accepted request body (put items can be large — more than 4KB). */
export const ADMIN_BODY_BYTES_MAX = 64 * 1024;
/** Default and hard cap on scan/query result pages. */
export const ADMIN_SCAN_LIMIT_DEFAULT = 50;
export const ADMIN_SCAN_LIMIT_MAX = 100;

/**
 * Table-name allowlist. The dashboard is an admin DynamoDB browser for our own
 * tables only — reject anything not under the octav- prefix server-side as
 * defense-in-depth on top of the Lambda's IAM (which is scoped the same way).
 */
export const ADMIN_TABLE_PATTERN = /^octav-[A-Za-z0-9_-]+$/;
