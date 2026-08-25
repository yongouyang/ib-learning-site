import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { parseRecipients } from '../analytics-report/deps';
import { DummyReportSender } from '../analytics-report/dummy-sender';
import { ResendReportSender } from '../analytics-report/resend-sender';
import type { ReportEmailSender } from '../analytics-report/types';
import { DynamoSessionStorage } from '../auth/dynamodb-storage';
import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoContactStorage } from './dynamodb-storage';
import type { ContactStorage } from './types';

// Dependency wiring for the contact handler (Feature 3,
// docs/supportability-features-plan.md §C1 — mirrors the other feature deps
// seams). Selection is env-driven:
//   CONTACT_STORAGE         = "dummy" (default) | "dynamodb"
//   CONTACT_TABLE           = octav-contact (dynamodb mode)
//   AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE
//                           = session validation + the rate-limit budget
//                             (dynamodb mode; the shared auth table names)
//   EMAIL_PROVIDER          = '{"NAME":"resend|dummy","API_KEY":"..."}' — the
//                             SAME repo secret the auth + analytics-report
//                             Lambdas use. NAME "ses" is refused (the
//                             notification needs a transactional send API; SES
//                             stays auth-only).
//   ANALYTICS_ADMIN_EMAILS  = comma-separated notification recipients (the
//                             same admin allowlist the analytics dashboard +
//                             report use — no new secret/variable needed).
//   SES_FROM_ADDRESS        = from-address (default noreply@octavlearning.com
//                             — the verified Resend domain).
// Defaults are the dummies: local dev and e2e run with zero AWS resources and
// zero emails, and the dummy storage IS the shared in-memory
// auth→progress→analytics→feedback→leaderboard→contact universe (a dummy-OTP
// session resolves end-to-end — the message gets its userId). The same
// fail-closed guards as every other deps seam apply: dummy wiring and
// NODE_ENV=test are refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1.
//
// Unit tests never call getContactDeps — they pass fresh dummies straight into
// the handlers.

export interface ContactDeps {
  storage: ContactStorage;
  /** Notification delivery — the shared ResendReportSender seam. */
  sender: ReportEmailSender;
  /** Deduped, trimmed notification recipients (from ANALYTICS_ADMIN_EMAILS). */
  recipients: string[];
  /** Clock for createdAt/expiresAt + the rate-limit window; unit tests inject. */
  clock: () => number;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[contact] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

// EMAIL_PROVIDER JSON ({"NAME","API_KEY"}) — same format + fail-closed rules
// as the analytics-report deps. Missing/empty/"{}" = no provider configured
// (dummy mode tolerates it; dynamodb mode refuses the no-op sender below).
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
    throw new Error('[contact] EMAIL_PROVIDER must be a valid single-line JSON object');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const name = typeof obj.NAME === 'string' && obj.NAME ? obj.NAME.toLowerCase() : null;
  const apiKey = typeof obj.API_KEY === 'string' && obj.API_KEY ? obj.API_KEY : null;
  if (name && !['resend', 'dummy'].includes(name)) {
    throw new Error(`[contact] EMAIL_PROVIDER.NAME must be "resend" or "dummy" (got "${name}")`);
  }
  return { name, apiKey };
}

export function getContactDeps(env: Record<string, string | undefined> = process.env): ContactDeps {
  const kind = env.CONTACT_STORAGE ?? 'dummy';

  // Fail closed (the AUTH_ALLOW_DUMMY guard — one opt-in covers every Lambda).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[contact] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[contact] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  let storage: ContactStorage;
  if (kind === 'dummy') {
    // The SHARED in-memory universe (progress/deps) is an
    // InMemoryContactStorage — one instance serves auth sessions, progress
    // items, analytics events, the AI-mark quota, leaderboard rows AND contact
    // messages, so a dummy-OTP login resolves for /api/contact in dev/e2e.
    storage = getSharedDummyUniverse();
  } else if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    // Session validation uses the SAME session-store implementation the auth
    // Lambda uses (one source of truth) — only the tables it touches.
    const sessionStore = new DynamoSessionStorage(documentClient, {
      users: requiredEnv(env, 'AUTH_USERS_TABLE'),
      sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
    });
    storage = new DynamoContactStorage(
      documentClient,
      {
        users: requiredEnv(env, 'AUTH_USERS_TABLE'),
        sessions: requiredEnv(env, 'AUTH_SESSIONS_TABLE'),
        contact: requiredEnv(env, 'CONTACT_TABLE'),
        rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE'),
      },
      sessionStore
    );
  } else {
    throw new Error(`[contact] CONTACT_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
  }

  const provider = parseEmailProvider(env);
  let sender: ReportEmailSender;
  if (provider.name === null || provider.name === 'dummy') {
    sender = new DummyReportSender();
  } else {
    if (!provider.apiKey) {
      throw new Error('[contact] EMAIL_PROVIDER.API_KEY is required when NAME is "resend"');
    }
    sender = new ResendReportSender(provider.apiKey, env.SES_FROM_ADDRESS ?? 'noreply@octavlearning.com');
  }

  // Production safety: the real AWS wiring MUST deliver via Resend — a no-op
  // sender in dynamodb mode would silently drop every notification (the
  // analytics-report deps guard, same class).
  if (kind === 'dynamodb' && !(sender instanceof ResendReportSender)) {
    throw new Error('[contact] EMAIL_PROVIDER.NAME must be "resend" when using the real AWS wiring');
  }

  return { storage, sender, recipients: parseRecipients(env.ANALYTICS_ADMIN_EMAILS), clock: Date.now };
}
