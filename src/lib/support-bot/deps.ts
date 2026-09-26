import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { parseRecipients } from '../analytics-report/deps';
import { ANALYTICS_REPORT_DEFAULT_HOST } from '../analytics-report/types';
import { DummyAlertDelivery } from './delivery/dummy-sender';
import { ResendAlertDelivery } from './delivery/resend-sender';
import { DynamoSupportBotStorage } from './dynamodb-storage';
import { InMemorySupportBotStorage } from './dummy';
import { RuleBasedTriageProvider } from './triage/rule-based';
import type { AlertDelivery, SupportBotStorage, TriageProvider } from './types';

// Dependency wiring for the support bot (docs/support-bot-plan.md §7) —
// mirrors the other feature deps seams. Selection is env-driven:
//   SUPPORT_BOT_STORAGE         = "dummy" (default) | "dynamodb"
//   SUPPORT_ALERTS_TABLE        = octav-support-alerts (dynamodb mode)
//   CONTACT_TABLE               = octav-contact (dynamodb mode; read-only)
//   ANALYTICS_TABLE             = octav-analytics-events (dynamodb mode; read-only)
//   SUPPORT_BOT_PROD_HOST       = the prod hostname the traffic_drop /
//                                 zero_events signals watch (default
//                                 octavlearning.com — the analytics-report
//                                 default).
//   SUPPORT_BOT_TRIAGE_PROVIDER = "rule-based" (default) — "deepseek" is v1.1
//                                 (plan §5.2) and REFUSED in v1, so a
//                                 premature env flip fails closed at startup
//                                 instead of silently running the wrong triage.
//   EMAIL_PROVIDER              = '{"NAME":"resend|dummy","API_KEY":"..."}' —
//                                 the SAME repo secret the auth/contact/
//                                 analytics-report Lambdas use. NAME "ses" is
//                                 refused (the contact precedent: alert email
//                                 needs a transactional send API).
//   ANALYTICS_ADMIN_EMAILS      = comma-separated alert recipients (the same
//                                 admin allowlist the analytics dashboard +
//                                 report use — no new secret/variable needed).
//   SES_FROM_ADDRESS            = from-address (default noreply@octavlearning.com
//                                 — the verified Resend domain).
//   AUTH_DYNAMODB_REGION / AWS_REGION = DynamoDB region (shared convention).
//
// The plan §7's env table also lists AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE
// "for session validation (contact attribution)" — deliberately NOT consumed:
// the bot never resolves a session (contact attribution happens at ingest;
// the message row already carries userId).
//
// Defaults are the dummies: local dev and tests run with zero AWS resources
// and zero emails (DummyAlertDelivery records instead). The same fail-closed
// guards as every other deps seam apply: dummy wiring and NODE_ENV=test are
// refused inside AWS Lambda unless AUTH_ALLOW_DUMMY=1. Production safety (the
// contact deps guard, same class): dynamodb mode MUST deliver via Resend — a
// dummy delivery there would silently drop every alert.
//
// Recipients fail closed in the HANDLER, not here: an empty
// ANALYTICS_ADMIN_EMAILS returns { ok:false } from pollAndAlert without
// throwing (§11 — a throw would cause an EventBridge retry storm for a
// problem a retry cannot fix; the analytics-report pattern).
//
// Unit tests never call getSupportBotDeps — they pass fresh dummies straight
// into pollAndAlert.

export interface SupportBotDeps {
  storage: SupportBotStorage;
  /** v1 is always the rule-based provider (§9 Q4). */
  triage: TriageProvider;
  /** S3: Resend in dynamodb mode, the recording dummy otherwise. */
  delivery: AlertDelivery;
  /** Deduped, trimmed alert recipients (from ANALYTICS_ADMIN_EMAILS). */
  recipients: string[];
  /** Prod hostname for the traffic_drop / zero_events signals. */
  prodHost: string;
  /** Clock for createdAt/expiresAt; unit tests inject a frozen clock. */
  clock: () => number;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[support-bot] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

// EMAIL_PROVIDER JSON ({"NAME","API_KEY"}) — same format + fail-closed rules
// as the contact deps. Missing/empty/"{}" = no provider configured (dummy
// mode tolerates it; dynamodb mode refuses the non-Resend sender below).
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
    throw new Error('[support-bot] EMAIL_PROVIDER must be a valid single-line JSON object');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const name = typeof obj.NAME === 'string' && obj.NAME ? obj.NAME.toLowerCase() : null;
  const apiKey = typeof obj.API_KEY === 'string' && obj.API_KEY ? obj.API_KEY : null;
  if (name && !['resend', 'dummy'].includes(name)) {
    throw new Error(`[support-bot] EMAIL_PROVIDER.NAME must be "resend" or "dummy" (got "${name}")`);
  }
  return { name, apiKey };
}

// The bot's dummy universe is a module-level singleton (the other seams'
// getSharedDummyUniverse pattern) — a branch off the shared chain at the
// contact level (see the dummy.ts topology note).
let sharedBotUniverse: InMemorySupportBotStorage | null = null;

export function getSharedSupportBotUniverse(): InMemorySupportBotStorage {
  if (!sharedBotUniverse) sharedBotUniverse = new InMemorySupportBotStorage();
  return sharedBotUniverse;
}

export function getSupportBotDeps(env: Record<string, string | undefined> = process.env): SupportBotDeps {
  const kind = env.SUPPORT_BOT_STORAGE ?? 'dummy';

  // Fail closed (the AUTH_ALLOW_DUMMY guard — one opt-in covers every Lambda).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[support-bot] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[support-bot] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  let storage: SupportBotStorage;
  if (kind === 'dummy') {
    storage = getSharedSupportBotUniverse();
  } else if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    storage = new DynamoSupportBotStorage(documentClient, {
      alerts: requiredEnv(env, 'SUPPORT_ALERTS_TABLE'),
      contact: requiredEnv(env, 'CONTACT_TABLE'),
      analytics: requiredEnv(env, 'ANALYTICS_TABLE'),
    });
  } else {
    throw new Error(`[support-bot] SUPPORT_BOT_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
  }

  const triageKind = env.SUPPORT_BOT_TRIAGE_PROVIDER ?? 'rule-based';
  let triage: TriageProvider;
  if (triageKind === 'rule-based') {
    triage = new RuleBasedTriageProvider();
  } else if (triageKind === 'deepseek') {
    throw new Error('[support-bot] SUPPORT_BOT_TRIAGE_PROVIDER=deepseek is a v1.1 feature (plan §5.2) — not available in v1');
  } else {
    throw new Error(`[support-bot] SUPPORT_BOT_TRIAGE_PROVIDER must be "rule-based" (got "${triageKind}")`);
  }

  const recipients = parseRecipients(env.ANALYTICS_ADMIN_EMAILS);
  const provider = parseEmailProvider(env);
  let delivery: AlertDelivery;
  if (provider.name === null || provider.name === 'dummy') {
    delivery = new DummyAlertDelivery();
  } else {
    if (!provider.apiKey) {
      throw new Error('[support-bot] EMAIL_PROVIDER.API_KEY is required when NAME is "resend"');
    }
    delivery = new ResendAlertDelivery(
      recipients,
      provider.apiKey,
      env.SES_FROM_ADDRESS ?? 'noreply@octavlearning.com'
    );
  }

  // Production safety: the real AWS wiring MUST deliver via Resend — a dummy
  // delivery in dynamodb mode would silently drop every alert (the contact
  // deps' EMAIL_PROVIDER guard, same class).
  if (kind === 'dynamodb' && !(delivery instanceof ResendAlertDelivery)) {
    throw new Error('[support-bot] EMAIL_PROVIDER.NAME must be "resend" when using the real AWS wiring');
  }

  return {
    storage,
    triage,
    delivery,
    recipients,
    prodHost: env.SUPPORT_BOT_PROD_HOST ?? ANALYTICS_REPORT_DEFAULT_HOST,
    clock: Date.now,
  };
}
