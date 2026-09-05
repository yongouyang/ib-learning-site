import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { InMemorySubscriptionsStorage } from '../subscriptions/dummy';
import { DynamoLeaderboardStorage } from '../leaderboard/dynamodb-storage';
import type { LeaderboardStorage } from '../leaderboard/types';
import { DynamoProgressStorage } from './dynamodb-storage';
import type { ProgressStorage } from './types';

// Dependency wiring for the progress handler (mirrors src/lib/auth/deps.ts):
//   PROGRESS_STORAGE = "dummy" (default) | "dynamodb"
// Defaults to the dummy: local dev and e2e run with zero AWS resources. The
// terraform progress_api module always sets the real wiring. The same
// fail-closed guards as the auth deps apply: dummy wiring and NODE_ENV=test
// are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1 (one opt-in covers
// both lambdas).

export interface ProgressDeps {
  storage: ProgressStorage;
  /**
   * Phase D4 (docs/leaderboard-plan.md §6): XP accrual target inside the sync
   * handler. Undefined = awarding DISABLED (DynamoDB wiring without a
   * LEADERBOARD_TABLE env — the terraform env lands in D7). Opted-out
   * profiles skip all bucket/leaderboard writes regardless.
   */
  leaderboardStorage?: LeaderboardStorage;
  /**
   * Clock (epoch ms) for the D4 week/day attribution — XP always credits the
   * CURRENT week on the SERVER clock at sync time (plan §4.1), never the
   * client event date. Defaults to Date.now; unit tests inject a frozen clock.
   */
  clock?: () => number;
}

// ONE in-memory universe shared with the AUTH deps (auth routes write
// sessions into it; progress routes read them back) — the dev/e2e stand-in
// for the shared DynamoDB tables. It is constructed as the SUBSCRIPTIONS dummy
// (which extends contact → leaderboard → feedback → analytics → progress →
// auth) so the Phase A analytics handler, the Phase E2 feedback handler, the
// Phase D leaderboard handler, the Feature 3 contact handler AND the E4
// subscriptions handler share the SAME universe too: a dummy-OTP login
// resolves for /api/analytics/summary, /api/feedback, /api/leaderboard,
// /api/contact AND /api/subscriptions in dev/e2e.
// Unit tests never call getProgressDeps; they construct fresh dummies
// directly.
let sharedUniverse: InMemorySubscriptionsStorage | null = null;

export function getSharedDummyUniverse(): InMemorySubscriptionsStorage {
  if (!sharedUniverse) sharedUniverse = new InMemorySubscriptionsStorage();
  return sharedUniverse;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[progress] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getProgressDeps(env: Record<string, string | undefined> = process.env): ProgressDeps {
  const kind = env.PROGRESS_STORAGE ?? 'dummy';

  // Fail closed (same guard as the auth deps — rule 9).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[progress] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[progress] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  if (kind === 'dummy') {
    // The shared universe IS an InMemoryContactStorage (which extends the
    // leaderboard dummy) — the D4 award hook writes leaderboard rows into the
    // same universe the sync writes progress.
    const universe = getSharedDummyUniverse();
    return { storage: universe, leaderboardStorage: universe };
  }
  if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation uses the SAME session-store implementation the auth
    // Lambda uses (one source of truth) — only the tables it touches, so the
    // progress Lambda needs no OTP table name. The durable sync budget DOES
    // touch octav-rate-limits (the fixed-window bucket), so its name is wired
    // here too.
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    const tables = {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
      progress: requiredEnv(env, 'AUTH_PROGRESS_TABLE'),
      rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
    };
    // D4: LEADERBOARD_TABLE is OPTIONAL until the terraform wiring lands (D7)
    // — absent = XP awarding disabled, sync unaffected.
    const leaderboardTable = env.LEADERBOARD_TABLE;
    return {
      storage: new DynamoProgressStorage(documentClient, tables, sessionStore),
      leaderboardStorage: leaderboardTable
        ? new DynamoLeaderboardStorage(
            documentClient,
            { users: tables.users, sessions: tables.sessions, leaderboard: leaderboardTable },
            sessionStore
          )
        : undefined,
    };
  }
  throw new Error(`[progress] PROGRESS_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
