import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoLeaderboardStorage } from './dynamodb-storage';
import type { LeaderboardStorage } from './types';

// Dependency wiring for the leaderboard handler (Phase D3 — mirrors
// src/lib/analytics/deps.ts / src/lib/feedback/deps.ts). Selection is
// env-driven:
//   LEADERBOARD_STORAGE = "dummy" (default) | "dynamodb"
// Defaults to the dummy: local dev and e2e run with zero AWS resources, and
// the dummy IS the shared in-memory auth→progress→analytics→feedback→
// leaderboard universe (a dummy-OTP session resolves end-to-end). The
// terraform leaderboard_api module (D7) always sets the real wiring for the
// prod Lambda. The same fail-closed guards as the auth/progress/analytics/
// feedback deps apply: dummy wiring and NODE_ENV=test are refused inside AWS
// Lambda unless AUTH_ALLOW_DUMMY=1 (one opt-in covers all lambdas).
//
// Unit tests never call getLeaderboardDeps — they pass fresh dummies straight
// into the handlers.

export interface LeaderboardDeps {
  storage: LeaderboardStorage;
  /** Clock (epoch ms) for the week-key math — current/prev week resolution.
   *  Unit tests inject a frozen clock so week=prev tests stay deterministic. */
  clock: () => number;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[leaderboard] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getLeaderboardDeps(env: Record<string, string | undefined> = process.env): LeaderboardDeps {
  const kind = env.LEADERBOARD_STORAGE ?? 'dummy';

  // Fail closed (same guard as the auth/progress/analytics/feedback deps —
  // rule 9): inside a Lambda, dummy wiring AND a leaked NODE_ENV=test are only
  // ever intentional under an explicit opt-in.
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[leaderboard] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[leaderboard] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  if (kind === 'dummy') {
    // The SHARED in-memory universe (progress/deps) is an
    // InMemoryLeaderboardStorage — one instance serves auth sessions,
    // progress items, analytics events, the AI-mark quota AND leaderboard
    // rows, so a dummy-OTP login resolves for /api/leaderboard in dev/e2e.
    return { storage: getSharedDummyUniverse(), clock: Date.now };
  }
  if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation uses the SAME session-store implementation the auth
    // Lambda uses (one source of truth) — only the tables it touches, so the
    // leaderboard Lambda needs no OTP/rate-limit table names (read-only; the
    // D4 write path lives in the PROGRESS Lambda, plan §6).
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    return {
      storage: new DynamoLeaderboardStorage(
        documentClient,
        {
          users: requiredEnv(env, 'AUTH_USERS_TABLE'),
          sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
          leaderboard: requiredEnv(env, 'LEADERBOARD_TABLE'),
        },
        sessionStore
      ),
      clock: Date.now,
    };
  }
  throw new Error(`[leaderboard] LEADERBOARD_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
