import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoAnalyticsStorage } from './dynamodb-storage';
import { DynamoLearningJourneyStorage } from './journey-dynamodb';
import type { LearningJourneyStorage } from './journey';
import { ANALYTICS_EVENTS_PER_WINDOW } from './types';
import type { AnalyticsStorage } from './types';

// Dependency wiring for the analytics handler (mirrors src/lib/progress/deps.ts):
//   ANALYTICS_STORAGE = "dummy" (default) | "dynamodb"
//   ANALYTICS_TEST_MODE=1 relaxes the per-IP budget ONLY with dummy storage.
// Defaults to the dummy: local dev and e2e run with zero AWS resources. The
// terraform analytics_api module (A6) always sets the real wiring. The same
// fail-closed guards as the auth/progress deps apply: dummy wiring and
// NODE_ENV=test are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1 (one
// opt-in covers all three lambdas).

export interface AnalyticsDeps {
  storage: AnalyticsStorage;
  journeyStorage: LearningJourneyStorage;
  eventRateLimit?: number;
  /** Comma-separated, case-insensitive admin email allowlist for /summary. */
  adminEmails: string;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[analytics] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getAnalyticsDeps(env: Record<string, string | undefined> = process.env): AnalyticsDeps {
  const kind = env.ANALYTICS_STORAGE ?? 'dummy';
  const adminEmails = env.ANALYTICS_ADMIN_EMAILS ?? '';
  const eventRateLimit = kind === 'dummy' && env.ANALYTICS_TEST_MODE === '1'
    ? 10_000
    : ANALYTICS_EVENTS_PER_WINDOW;

  // Fail closed (same guard as the auth/progress deps — rule 9).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[analytics] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[analytics] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  if (kind === 'dummy') {
    // The SHARED in-memory universe (progress/deps) is an
    // InMemoryAnalyticsStorage — one instance serves auth sessions, progress
    // items AND analytics events, so a dummy-OTP login resolves for /summary
    // in dev/e2e (the stand-in for the shared DynamoDB tables).
    const universe = getSharedDummyUniverse() as unknown as AnalyticsStorage & LearningJourneyStorage;
    return { storage: universe, journeyStorage: universe, eventRateLimit, adminEmails };
  }
  if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation uses the SAME session-store implementation the auth
    // Lambda uses (one source of truth) — only the tables it touches, so the
    // analytics Lambda needs no OTP table name.
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    return {
      storage: new DynamoAnalyticsStorage(
        documentClient,
        {
          users: requiredEnv(env, 'AUTH_USERS_TABLE'),
          sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
          events: requiredEnv(env, 'ANALYTICS_TABLE'),
          rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
        },
        sessionStore
      ),
      journeyStorage: new DynamoLearningJourneyStorage(
        documentClient,
        requiredEnv(env, 'LEARNING_JOURNEY_TABLE')
      ),
      eventRateLimit,
      adminEmails,
    };
  }
  throw new Error(`[analytics] ANALYTICS_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
