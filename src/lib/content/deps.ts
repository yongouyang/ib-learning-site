import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoContentStorage } from './dynamodb-storage';
import type { ContentStorage } from './types';

// Dependency wiring for the content handler (Phase 1b,
// docs/premium-content-protection-plan.md §4). Selection is env-driven:
//   CONTENT_STORAGE            = "dummy" (default) | "dynamodb"
//   AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE
//                              = session validation for the premium route + the
//                                per-IP budget for the public route (dynamodb mode)
//
// There is no CONTENT_TABLE: the topic and paper content is BUNDLED into the Lambda at build time
// (esbuild), so this API owns no data of its own — the smallest IAM grant set in the repo.
//
// Defaults are the dummies: local dev and e2e run with zero AWS resources, and the dummy storage IS
// the shared in-memory auth→progress→analytics→feedback→leaderboard→contact→subscriptions universe
// extended with the content budget. The same fail-closed guards as every other deps seam apply:
// dummy wiring and NODE_ENV=test are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1.
//
// Unit tests never call getContentDeps — they pass fresh dummies straight into the handlers.

export interface ContentDeps {
  storage: ContentStorage;
  /** Clock for the fixed-window budget; unit tests inject. */
  clock: () => number;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[content] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getContentDeps(env: Record<string, string | undefined> = process.env): ContentDeps {
  const kind = env.CONTENT_STORAGE ?? 'dummy';

  // Fail closed (the AUTH_ALLOW_DUMMY guard — one opt-in covers every Lambda).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[content] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[content] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  let storage: ContentStorage;
  if (kind === 'dummy') {
    // The SHARED in-memory universe (progress/deps) is an InMemoryContentStorage — one instance serves
    // sessions, progress items, analytics events, the AI-mark quota, leaderboard rows, contact
    // messages, billing state AND the content budget, so a dummy-OTP login resolves for
    // /api/content/premium/* in dev/e2e.
    storage = getSharedDummyUniverse();
  } else if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation uses the SAME session-store implementation the auth Lambda uses (one source
    // of truth) — only the tables it touches.
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    storage = new DynamoContentStorage(
      documentClient,
      {
        users: requiredEnv(env, 'AUTH_USERS_TABLE'),
        sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
        rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
      },
      sessionStore
    );
  } else {
    throw new Error(`[content] CONTENT_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
  }

  return { storage, clock: Date.now };
}
