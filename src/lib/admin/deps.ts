import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import type { SessionAuthStorage } from '../auth/session';
import { getSharedDummyUniverse } from '../progress/deps';
import { getAdminDummy } from './dummy';
import { DynamoAdminStorage } from './dynamodb-storage';
import type { AdminStorage } from './types';

// Dependency wiring for the admin CRUD handler (Feature 2,
// docs/supportability-features-plan.md). Selection is env-driven:
//   ADMIN_STORAGE = "dummy" (default) | "dynamodb"
// The admin email allowlist is REUSED from the analytics dashboard
// (ANALYTICS_ADMIN_EMAILS) — same admins, same comma-separated form.
//
// Defaults to the dummy: local dev and e2e run with zero AWS resources. The
// admin CRUD store and the session store are deliberately SEPARATE: the CRUD
// store is a generic per-table stand-in (InMemoryAdminStorage, seeded with the
// octav-* table names), while session validation uses the SHARED in-memory
// auth/progress universe so a dummy-OTP login resolves for /admin/dynamodb.
// Same fail-closed guards as the auth/progress deps: dummy wiring and
// NODE_ENV=test are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1.

export interface AdminDeps {
  /** The CRUD store — DynamoDB in prod, the seeded dummy in dev/e2e. */
  storage: AdminStorage;
  /** Session validation for the admin gate (resolveSession). */
  sessionStorage: SessionAuthStorage;
  /** Comma-separated, case-insensitive admin email allowlist. */
  adminEmails: string;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[admin] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getAdminDeps(env: Record<string, string | undefined> = process.env): AdminDeps {
  const kind = env.ADMIN_STORAGE ?? 'dummy';
  const adminEmails = env.ANALYTICS_ADMIN_EMAILS ?? '';

  // Fail closed (same guard as the auth/progress/analytics deps — rule 9).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[admin] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[admin] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  if (kind === 'dummy') {
    return {
      storage: getAdminDummy(),
      // The shared in-memory universe serves auth sessions (getSession /
      // getUserById / updateSession / deleteSession), so a dummy-OTP login
      // resolves for the admin gate in dev/e2e.
      sessionStorage: getSharedDummyUniverse(),
      adminEmails,
    };
  }
  if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation reuses the same session-store implementation the
    // auth Lambda uses — only the users/sessions tables, no OTP table name.
    const sessionStorage = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    return {
      storage: new DynamoAdminStorage(documentClient),
      sessionStorage,
      adminEmails,
    };
  }
  throw new Error(`[admin] ADMIN_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
