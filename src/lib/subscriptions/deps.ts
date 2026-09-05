import { getSharedDummyUniverse } from '../progress/deps';
import { DummyStripeClient } from './dummy';
import type { PlanPriceIds, StripeClient, SubscriptionsStorage } from './types';

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

export interface SubscriptionsDeps {
  storage: SubscriptionsStorage;
  stripe: StripeClient;
  /** Price ids per plan — env-supplied, because test and live ids DIFFER. */
  priceIds: PlanPriceIds;
  /** Trial length in days (plan §2.2: 14). */
  trialDays: number;
  /** Origin used to build success/cancel/portal return URLs. */
  origin: string;
  clock: () => number;
  testMode: boolean;
  /** True only with the in-memory dummy storage. */
  dummyMode: boolean;
}

export function getSubscriptionsDeps(
  env: Record<string, string | undefined> = process.env
): SubscriptionsDeps {
  const kind = env.SUBSCRIPTIONS_STORAGE ?? 'dummy';
  const stripeMode = env.STRIPE_MODE ?? 'dummy';

  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy' || stripeMode === 'dummy') {
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

  const trialDays = Number(env.STRIPE_TRIAL_DAYS ?? 14);
  const origin = env.SITE_ORIGIN ?? 'http://localhost:3000';

  if (kind === 'dummy') {
    const universe = getSharedDummyUniverse();
    return {
      storage: universe,
      stripe: new DummyStripeClient({ webhookSecret: env.STRIPE_WEBHOOK_SECRET }),
      priceIds: {
        monthly: env.STRIPE_PRICE_MONTHLY ?? 'price_dummy_monthly',
        annual: env.STRIPE_PRICE_ANNUAL ?? 'price_dummy_annual',
      },
      trialDays,
      origin,
      clock: Date.now,
      testMode: env.SUBSCRIPTIONS_TEST_MODE === '1',
      dummyMode: true,
    };
  }

  if (kind === 'dynamodb') {
    // The DynamoDB subscriptions storage adapter and the live Stripe client
    // land with the Stripe account (E4.0/E4.2 follow-up): they need the real
    // table names + STRIPE_ENV wiring. The seam and the faithful dummy are in
    // place so the handler, routes and tests are buildable and testable now.
    throw new Error(
      '[subscriptions] dynamodb storage is not wired yet (E4.2 follow-up: subscriptions dynamodb-storage adapter + live Stripe client)'
    );
  }

  throw new Error(`[subscriptions] SUBSCRIPTIONS_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
}
