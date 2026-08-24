import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoFeedbackStorage } from './dynamodb-storage';
import type { FeedbackStorage } from './types';

// Dependency wiring for the feedback handler (Phase E2 — mirrors
// src/lib/progress/deps.ts). Selection is env-driven:
//   FEEDBACK_STORAGE = "dummy" (default) | "dynamodb"
// Defaults to the dummy: local dev and e2e run with zero AWS resources, and
// the dummy JOINS the shared in-memory auth→progress→analytics universe
// (a dummy-OTP session resolves end-to-end). The terraform feedback_api
// module always sets the real wiring for the prod Lambda. The same
// fail-closed guards as the auth/progress deps apply: dummy wiring and
// NODE_ENV=test are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1
// (one opt-in covers all lambdas).
//
// The dummy singleton is the SHARED universe owned by
// src/lib/progress/deps.ts (constructed as InMemoryFeedbackStorage so the
// quota counter lives in the same instance as the sessions). Unit tests
// never call getFeedbackDeps — they pass fresh dummies straight into the
// handlers.

export interface FeedbackDeps {
  storage: FeedbackStorage;
  /** Clock for the quota window (month key + resetAt); unit tests inject. */
  clock: () => number;
  /** FEEDBACK_TEST_MODE=1 — enables _testResponse/_testAiMarkUsed/_testTier injection. */
  testMode: boolean;
  /** True only with the in-memory dummy storage — the ONLY wiring under which
   *  the quota/tier injections may be honored (never real DynamoDB). */
  dummyMode: boolean;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[feedback] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getFeedbackDeps(env: Record<string, string | undefined> = process.env): FeedbackDeps {
  const kind = env.FEEDBACK_STORAGE ?? 'dummy';

  // Fail closed (same guard as the auth/progress deps): inside a Lambda,
  // dummy wiring AND a leaked NODE_ENV=test are only ever intentional under
  // an explicit opt-in.
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[feedback] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[feedback] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  if (kind === 'dummy') {
    return { storage: getSharedDummyUniverse(), clock: Date.now, testMode: env.FEEDBACK_TEST_MODE === '1', dummyMode: true };
  }
  if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    const tables = {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
      rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
    };
    // Session validation uses the SAME session-store implementation the auth
    // Lambda uses (one source of truth) — only the tables it touches; the
    // feedback path never sends email and never reads OTPs.
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: tables.users,
      sessions: tables.sessions,
    });
    return {
      storage: new DynamoFeedbackStorage(documentClient, tables, sessionStore),
      clock: Date.now,
      testMode: env.FEEDBACK_TEST_MODE === '1',
      dummyMode: false,
    };
  }
  throw new Error(`[feedback] FEEDBACK_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
