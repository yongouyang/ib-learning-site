import { getSharedDummyUniverse } from '../progress/deps';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage, DynamoUserWriter } from '../auth/dynamodb-storage';
import { isProdRequest } from '../auth/dev-gate';
import { DummyStripeClient } from './dummy';
import { DynamoSubscriptionsStorage } from './dynamodb-storage';
import { StripeRestClient } from './stripe-rest';
import {
  parseStripeEnv,
  resolveStripeMode,
  type ResolvedStripeMode,
  type StripeClient,
  type StripeConfig,
  type SubscriptionsStorage,
} from './types';

// Dependency wiring for the subscriptions handler (E4 —
// docs/stripe-subscriptions-plan.md §6). Two independent selections, matching
// the auth/progress/feedback precedent:
//   SUBSCRIPTIONS_STORAGE = "dummy" (default) | "dynamodb"
//   STRIPE_MODE           = "dummy" (default) | "test" | "live"
//
// Defaulting BOTH to the dummy means local dev and e2e run with zero AWS
// resources and zero Stripe calls — and it is what lets the whole subscription
// flow be built and tested before a Stripe account exists (E4.0 is user-owned
// and can lag). Same fail-closed guard as every other Lambda: dummy wiring is
// refused inside AWS unless AUTH_ALLOW_DUMMY=1.
//
// `STRIPE_MODE` is a CAPABILITY, not the answer for a given request: one Lambda
// serves both distributions, so which key set applies is decided per request
// from the CloudFront-overwritten X-Octav-Env marker (plan §6.1). See
// resolveStripeMode — live requires an explicit `prod`.

export interface SubscriptionsDeps {
  storage: SubscriptionsStorage;
  /**
   * The Stripe client for THIS request, or null when billing is not configured
   * (unconfigured STRIPE_ENV, or a mode whose client is not wired yet). Null
   * rather than a throw so handlers can answer 503 `billing_unavailable`
   * instead of surfacing a 500.
   */
  stripeFor(req: Request): StripeClient | null;
  stripeModeFor(req: Request): ResolvedStripeMode;
  /** Parsed STRIPE_ENV — `_health` asserts it is usable (Q2). */
  stripeConfig: StripeConfig;
  /** The configured capability, before per-request selection. */
  configuredStripeMode: ResolvedStripeMode;
  /** Trial length in days (plan §2.2: 14). */
  trialDays: number;
  clock: () => number;
  /** Enables per-test response injection (the feedback `_testResponse` precedent). */
  testMode: boolean;
  /** True only with the in-memory dummy storage. */
  dummyMode: boolean;
}

const STRIPE_MODES: readonly ResolvedStripeMode[] = ['dummy', 'test', 'live'];

export function getSubscriptionsDeps(
  env: Record<string, string | undefined> = process.env
): SubscriptionsDeps {
  const kind = env.SUBSCRIPTIONS_STORAGE ?? 'dummy';
  const configuredStripeMode = (env.STRIPE_MODE ?? 'dummy') as ResolvedStripeMode;

  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy' || configuredStripeMode === 'dummy') {
      throw new Error(
        '[subscriptions] refusing dummy storage/stripe inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[subscriptions] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production'
      );
    }
  }
  if (!STRIPE_MODES.includes(configuredStripeMode)) {
    throw new Error(`[subscriptions] STRIPE_MODE must be one of ${STRIPE_MODES.join(', ')} (got "${configuredStripeMode}")`);
  }

  const stripeConfig = parseStripeEnv(env.STRIPE_ENV);
  if (!stripeConfig.ok) {
    // Loud at construction: a malformed secret must fail the deploy smoke, not
    // silently degrade every checkout (the FEEDBACK_ENV incident class).
    throw new Error(`[subscriptions] ${stripeConfig.error}`);
  }

  // ONE dummy client per deps instance so its in-memory subscriptions survive
  // across requests within a process — the same reasoning as the shared
  // in-memory universe.
  const dummy = new DummyStripeClient({ webhookSecret: env.STRIPE_WEBHOOK_SECRET });

  // Real clients are built lazily and cached for the process: one per key set
  // (two at most), so a warm Lambda does not rebuild an HTTPS client per request.
  const rest = new Map<'test' | 'live', StripeRestClient>();
  const restFor = (mode: 'test' | 'live'): StripeRestClient => {
    const cached = rest.get(mode);
    if (cached) return cached;
    const keys = mode === 'live' ? stripeConfig.live : stripeConfig.test;
    if (!keys) throw new Error(`[subscriptions] no ${mode} key set — resolveStripeMode should not have selected it`);
    const client = new StripeRestClient({
      secretKey: keys.secretKey,
      webhookSecret: keys.webhookSecret,
      priceIds: keys.priceIds,
    });
    rest.set(mode, client);
    return client;
  };

  const stripeModeFor = (req: Request): ResolvedStripeMode =>
    resolveStripeMode(req, configuredStripeMode, stripeConfig);

  const stripeFor = (req: Request): StripeClient | null => {
    const mode = stripeModeFor(req);
    // FAIL CLOSED — two ways a resolved mode can be wrong once a real mode is
    // configured (i.e. inside the deployed Lambda):
    //
    //  1. mode === 'dummy' means STRIPE_ENV is missing/incomplete for the
    //     configured mode. Serving the in-memory dummy would hand out FAKE
    //     checkout URLs that 404 in Stripe, so answer 503 instead.
    //  2. a PROD request resolving to 'test' means the live key set is absent
    //     while the test set exists. resolveStripeMode is deliberately allowed
    //     to fall back to test (it cannot know which distribution the Lambda
    //     is behind beyond the marker), but falling back on PROD would open
    //     test-mode Checkout sessions for real customers — no charge, no
    //     revenue, no error. 503 is the honest answer.
    //
    // Local dev/e2e (configuredStripeMode 'dummy') are untouched: they keep the
    // controllable dummy, which is the whole point of the seam.
    if (configuredStripeMode !== 'dummy' && mode === 'dummy') {
      console.error('[subscriptions] no usable key set for the configured Stripe mode — billing unavailable');
      return null;
    }
    if (configuredStripeMode !== 'dummy' && isProdRequest(req) && mode !== 'live') {
      console.error('[subscriptions] PROD request resolved to test keys (no live key set in STRIPE_ENV) — refusing');
      return null;
    }
    if (mode === 'dummy') return dummy;
    try {
      return restFor(mode);
    } catch (err) {
      // Only reachable if the config and the mode disagree — report unavailable
      // rather than 500 every billing request.
      console.error('[subscriptions]', err instanceof Error ? err.message : err);
      return null;
    }
  };

  const trialDays = Number(env.STRIPE_TRIAL_DAYS ?? 14);

  if (kind === 'dummy') {
    return {
      storage: getSharedDummyUniverse(),
      stripeFor,
      stripeModeFor,
      stripeConfig,
      configuredStripeMode,
      trialDays,
      clock: Date.now,
      testMode: env.SUBSCRIPTIONS_TEST_MODE === '1',
      dummyMode: true,
    };
  }

  if (kind === 'dynamodb') {
    // Real wiring: session validation and the user-row write are delegated to
    // the SAME DynamoSessionStorage/DynamoAuthStorage the other Lambdas use, so
    // there is one implementation of the session TTL slide and the per-field
    // user merge. Only the webhook ledger and the session budget are new.
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
    const users = requiredEnv(env, 'AUTH_USERS_TABLE');
    const sessions = requiredEnv(env, 'AUTH_SESSIONS_TABLE');
    const sessionStore = new DynamoSessionStorage(client, { users, sessions });
    const userWriter = new DynamoUserWriter(client, users);
    const storage = new DynamoSubscriptionsStorage(
      client,
      { users, sessions, rateLimits: requiredEnv(env, 'AUTH_RATE_LIMITS_TABLE') },
      sessionStore,
      userWriter
    );
    return {
      storage,
      stripeFor,
      stripeModeFor,
      stripeConfig,
      configuredStripeMode,
      trialDays,
      clock: Date.now,
      testMode: env.SUBSCRIPTIONS_TEST_MODE === '1',
      dummyMode: false,
    };
  }

  throw new Error(`[subscriptions] SUBSCRIPTIONS_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}

/** Fail LOUD at construction: a missing table name must break the deploy smoke,
 *  not silently degrade billing (the FEEDBACK_ENV incident class). */
function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`[subscriptions] ${name} is required when using the real AWS wiring`);
  return value;
}
