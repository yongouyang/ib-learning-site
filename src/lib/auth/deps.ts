import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { DynamoAuthStorage, DynamoSessionStorage } from './dynamodb-storage';
import { SesEmailSender } from './ses-sender';
import { ResendEmailSender } from './resend-sender';
import { DummyEmailSender } from './dummy';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoLeaderboardStorage } from '../leaderboard/dynamodb-storage';
import type { AuthDeps } from './types';

// Dependency wiring for the auth handler (the feedback handler's getFeedbackProvider
// equivalent). Selection is env-driven:
//   AUTH_STORAGE = "dummy" (default) | "dynamodb"
//   AUTH_EMAIL   = "dummy" (default) | "ses"        (legacy selector)
//   EMAIL_PROVIDER = '{"NAME":"resend|ses|dummy","API_KEY":"..."}' — takes
//                    precedence over AUTH_EMAIL; the provider-swap seam
//                    (PROGRESS.md 2026-08-18 option b). Unset/"{}" = fall back
//                    to AUTH_EMAIL.
//   AUTH_TEST_MODE = "1" enables deterministic codes + _testCode injection
//                    (only honored when BOTH deps are the dummies).
// Defaults are the dummies: local dev and e2e work with zero AWS resources and
// zero emails (controllable-dummy directive, AGENTS.md). The terraform
// auth_api module always sets the real wiring for the prod Lambda.
//
// The dummy singleton is the SHARED in-memory universe owned by
// src/lib/progress/deps.ts: the progress handler (Phase C) must see the
// sessions the auth handler writes, exactly like both Lambdas share the same
// DynamoDB tables in production. Unit tests never call getAuthDeps — they
// pass fresh dummies straight into the handlers.

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[auth] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

// Parses the EMAIL_PROVIDER JSON ({"NAME","API_KEY"}) into { name, apiKey }.
// Missing/empty/"{}" yields nulls (fall through to AUTH_EMAIL). Malformed JSON
// or an unknown NAME fails closed — a bad value must never silently select the
// deterministic dummy in production.
function parseEmailProvider(env: Record<string, string | undefined>): {
  name: string | null;
  apiKey: string | null;
} {
  const raw = env.EMAIL_PROVIDER;
  if (!raw || raw === '{}' || raw === '') return { name: null, apiKey: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('[auth] EMAIL_PROVIDER must be a valid single-line JSON object');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const name = typeof obj.NAME === 'string' && obj.NAME ? obj.NAME.toLowerCase() : null;
  const apiKey = typeof obj.API_KEY === 'string' && obj.API_KEY ? obj.API_KEY : null;
  if (name && !['resend', 'ses', 'dummy'].includes(name)) {
    throw new Error(`[auth] EMAIL_PROVIDER.NAME must be "resend", "ses" or "dummy" (got "${name}")`);
  }
  return { name, apiKey };
}

export function getAuthDeps(env: Record<string, string | undefined> = process.env): AuthDeps {
  const storageKind = env.AUTH_STORAGE ?? 'dummy';
  const provider = parseEmailProvider(env);
  const emailKind = provider.name ?? env.AUTH_EMAIL ?? 'dummy';
  const testMode = env.AUTH_TEST_MODE === '1';
  const dummyMode = storageKind === 'dummy' && emailKind === 'dummy';

  // Fail closed (review M1 + round 4): inside a Lambda, dummy wiring AND a
  // leaked NODE_ENV=test are only ever intentional under an explicit opt-in —
  // one bad env value must not enable the deterministic 123456 code,
  // in-memory storage, or test-gated behavior in production.
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (storageKind === 'dummy' || emailKind === 'dummy') {
      throw new Error(
        '[auth] refusing dummy wiring inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[auth] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  let storage: AuthDeps['storage'];
  let leaderboardStorage: AuthDeps['leaderboardStorage'];
  if (storageKind === 'dummy') {
    // The shared universe IS an InMemoryLeaderboardStorage — opt-out erasure
    // (D5) deletes rows from the same universe the D4 award hook writes to.
    const universe = getSharedDummyUniverse();
    storage = universe;
    leaderboardStorage = universe;
  } else if (storageKind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    storage = new DynamoAuthStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
      otp: requiredEnv(env, 'AUTH_OTP_TABLE'),
      progress: requiredEnv(env, 'AUTH_PROGRESS_TABLE'),
      rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
    });
    // D5: LEADERBOARD_TABLE is OPTIONAL until the terraform wiring lands (D7)
    // — absent = opt-out erasure disabled, account updates unaffected.
    const leaderboardTable = env.LEADERBOARD_TABLE;
    if (leaderboardTable) {
      const tables = {
        users: requiredEnv(env, 'AUTH_USERS_TABLE'),
        sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
        leaderboard: leaderboardTable,
      };
      leaderboardStorage = new DynamoLeaderboardStorage(
        documentClient,
        tables,
        new DynamoSessionStorage(documentClient, { users: tables.users, sessions: tables.sessions })
      );
    }
  } else {
    throw new Error(`[auth] AUTH_STORAGE must be "dummy" or "dynamodb" (got "${storageKind}")`);
  }

  let emailSender: AuthDeps['emailSender'];
  if (emailKind === 'dummy') {
    emailSender = new DummyEmailSender();
  } else if (emailKind === 'ses') {
    // SES has no ap-east-1 endpoint — the client must target ap-southeast-1
    // (the identity's region; architecture-evolution-plan.md Constraint 2).
    emailSender = new SesEmailSender(
      new SESv2Client({ region: env.AUTH_SES_REGION ?? 'ap-southeast-1' }),
      requiredEnv(env, 'SES_FROM_ADDRESS')
    );
  } else if (emailKind === 'resend') {
    if (!provider.apiKey) {
      throw new Error('[auth] EMAIL_PROVIDER.API_KEY is required when NAME is "resend"');
    }
    emailSender = new ResendEmailSender(
      provider.apiKey,
      env.SES_FROM_ADDRESS ?? 'noreply@octavlearning.com'
    );
  } else {
    throw new Error(`[auth] AUTH_EMAIL must be "dummy" or "ses", or EMAIL_PROVIDER.NAME must be set (got "${emailKind}")`);
  }

  return { storage, emailSender, leaderboardStorage, testMode, dummyMode };
}
