import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { DynamoAuthStorage } from './dynamodb-storage';
import { SesEmailSender } from './ses-sender';
import { DummyEmailSender, InMemoryAuthStorage } from './dummy';
import type { AuthDeps } from './types';

// Dependency wiring for the auth handler (the feedback handler's getFeedbackProvider
// equivalent). Selection is env-driven:
//   AUTH_STORAGE = "dummy" (default) | "dynamodb"
//   AUTH_EMAIL   = "dummy" (default) | "ses"
//   AUTH_TEST_MODE = "1" enables deterministic codes + _testCode injection
//                    (only honored when BOTH deps are the dummies).
// Defaults are the dummies: local dev and e2e work with zero AWS resources and
// zero emails (controllable-dummy directive, AGENTS.md). The terraform
// auth_api module always sets the real wiring for the prod Lambda.

// One shared in-memory dummy per process so dev-server state survives between
// requests (resets on restart). Unit tests never call getAuthDeps — they pass
// fresh dummies straight into the handlers.
let sharedDummyStorage: InMemoryAuthStorage | null = null;
function getSharedDummyStorage(): InMemoryAuthStorage {
  if (!sharedDummyStorage) sharedDummyStorage = new InMemoryAuthStorage();
  return sharedDummyStorage;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[auth] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

export function getAuthDeps(env: Record<string, string | undefined> = process.env): AuthDeps {
  const storageKind = env.AUTH_STORAGE ?? 'dummy';
  const emailKind = env.AUTH_EMAIL ?? 'dummy';
  const testMode = env.AUTH_TEST_MODE === '1';
  const dummyMode = storageKind === 'dummy' && emailKind === 'dummy';

  let storage: AuthDeps['storage'];
  if (storageKind === 'dummy') {
    storage = getSharedDummyStorage();
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
    });
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
  } else {
    throw new Error(`[auth] AUTH_EMAIL must be "dummy" or "ses" (got "${emailKind}")`);
  }

  return { storage, emailSender, testMode, dummyMode };
}
