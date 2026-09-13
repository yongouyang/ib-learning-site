// Stripe sandbox (test mode) verification harness — E4.2.
// docs/stripe-subscriptions-plan.md §8.2.
//
// Two steps, run against the LOCAL dev server (`npm run dev`) with the dummy
// storage universe, so the ONLY thing under test is the real Stripe
// integration: real test-mode API calls, real Checkout Session, real webhook
// delivered by `stripe listen`, real HMAC signature verification.
//
//   node scripts/stripe-sandbox.mjs setup   # create test product + 2 prices, write .env.local
//   node scripts/stripe-sandbox.mjs check   # log in, create a real Checkout Session, wait for the tier flip
//
// Setup reads STRIPE_TEST_SECRET_KEY from .env.local (add it yourself — the
// script never prints key material). The webhook secret comes from
// `stripe listen --forward-to localhost:3000/api/subscriptions`, which prints
// `whsec_...`; paste that into .env.local as STRIPE_TEST_WEBHOOK_SECRET.
//
// Order for a full end-to-end run:
//   1. echo 'STRIPE_TEST_SECRET_KEY=sk_test_...' >> .env.local
//   2. node scripts/stripe-sandbox.mjs setup          # fills in the price ids
//   3. stripe listen --forward-to localhost:3000/api/subscriptions   # prints whsec_...
//   4. paste that whsec_ into .env.local
//   5. AUTH_TEST_MODE=1 AUTH_STORAGE=dummy npm run dev
//      (AUTH_TEST_MODE=1 is what makes the dummy OTP the deterministic 123456 —
//      playwright.config.ts sets it for e2e; a plain `npm run dev` withholds the code)
//   6. node scripts/stripe-sandbox.mjs check          # prints a Checkout URL
//   7. pay with 4242 4242 4242 4242 (any future expiry, any CVC, any postcode)
//      — the script polls and confirms the tier flip.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(root, '.env.local');
const ORIGIN = process.env.SANDBOX_ORIGIN ?? 'http://localhost:3000';
const API = 'https://api.stripe.com/v1';

// Plan §0.1 decisions 1 + 12: USD 20/month, USD 200/year.
const PRICES = [
  { plan: 'monthly', amount: 2000, interval: 'month', envKey: 'STRIPE_TEST_PRICE_MONTHLY' },
  { plan: 'annual', amount: 20000, interval: 'year', envKey: 'STRIPE_TEST_PRICE_ANNUAL' },
];

// Stripe's tax classification for the product. REQUIRED in practice: new Stripe
// accounts have Managed Payments enabled by default, which REFUSES a Checkout
// Session whose line item's product has no tax_code (found live 2026-09-13:
// "Invalid line_items[0]: the product tax code is missing").
//
// txcd_20060058 = "Training Services - Self-study Web-based": "Self Study web
// based training, not instructor led. This does not include downloads or
// streaming of video replays." — chosen by the user 2026-09-13, and it describes
// the product better than the digital-goods codes the Stripe guide suggests
// (nothing here is downloaded, and it is self-study rather than SaaS):
// illustrated notes, flashcards and marked practice. Verified accepted by
// Managed Payments (session created 200 with managed_payments on).
const PRODUCT_TAX_CODE = process.env.STRIPE_PRODUCT_TAX_CODE ?? 'txcd_20060058';

function readEnvFile() {
  if (!existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function upsertEnv(updates) {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    const line = `${key}=${value}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
  }
  writeFileSync(ENV_PATH, lines.join('\n').replace(/\n*$/, '\n'));
}

async function stripe(pathname, { method = 'GET', params } = {}) {
  const key = readEnvFile().STRIPE_TEST_SECRET_KEY;
  if (!key) throw new Error('STRIPE_TEST_SECRET_KEY is not set in .env.local');
  if (!key.startsWith('sk_test_')) throw new Error('STRIPE_TEST_SECRET_KEY must be a test-mode key (sk_test_...)');
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(params ? { body: new URLSearchParams(params).toString() } : {}),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${method} ${pathname} -> HTTP ${res.status}: ${body?.error?.message ?? 'unknown'}`);
  return body;
}

async function setup() {
  const env = readEnvFile();
  if (!env.STRIPE_TEST_SECRET_KEY) {
    throw new Error('Add STRIPE_TEST_SECRET_KEY=sk_test_... to .env.local first (the script never prints it)');
  }

  // Idempotent: reuse the product if a previous run created one.
  const products = await stripe('/products?limit=100&active=true');
  let productId = products.data.find((p) => p.name === 'Octav Learning Premium')?.id;
  if (!productId) {
    const product = await stripe('/products', {
      method: 'POST',
      params: {
        name: 'Octav Learning Premium',
        description: 'Unlimited AI marking and the full exam tier.',
        tax_code: PRODUCT_TAX_CODE,
      },
    });
    productId = product.id;
  } else {
    // Repair a product created before the tax code was known (the Managed
    // Payments requirement above) so a rerun is self-healing, not just idempotent.
    const current = products.data.find((p) => p.id === productId);
    if (current?.tax_code !== PRODUCT_TAX_CODE) {
      await stripe(`/products/${productId}`, {
        method: 'POST',
        params: { tax_code: PRODUCT_TAX_CODE },
      });
      console.log(`  set product tax_code -> ${PRODUCT_TAX_CODE}`);
    }
  }

  const ids = {};
  for (const want of PRICES) {
    const list = await stripe(`/prices?product=${productId}&active=true&limit=100`);
    const match = list.data.find((p) => p.unit_amount === want.amount && p.recurring?.interval === want.interval && p.currency === 'usd');
    const price =
      match ??
      (await stripe('/prices', {
        method: 'POST',
        params: {
          product: productId,
          currency: 'usd',
          unit_amount: String(want.amount),
          'recurring[interval]': want.interval,
          nickname: `${want.interval}ly`,
        },
      }));
    ids[want.plan] = price.id;
    console.log(`  ${want.plan}: ${price.id} ($${(want.amount / 100).toFixed(2)}/${want.interval})`);
  }

  const webhookSecret = env.STRIPE_TEST_WEBHOOK_SECRET ?? '';
  const stripeEnv = JSON.stringify({
    SECRET_KEY_TEST: env.STRIPE_TEST_SECRET_KEY,
    WEBHOOK_SECRET_TEST: webhookSecret,
    PRICE_MONTHLY_TEST: ids.monthly,
    PRICE_ANNUAL_TEST: ids.annual,
  });
  upsertEnv({
    STRIPE_TEST_PRICE_MONTHLY: ids.monthly,
    STRIPE_TEST_PRICE_ANNUAL: ids.annual,
    STRIPE_ENV: stripeEnv,
    SUBSCRIPTIONS_STORAGE: 'dummy',
    STRIPE_MODE: 'test',
  });
  console.log(`\nproduct ${productId}; wrote STRIPE_ENV + SUBSCRIPTIONS_STORAGE=dummy + STRIPE_MODE=test to .env.local`);
  if (!webhookSecret) {
    console.log('STRIPE_TEST_WEBHOOK_SECRET is EMPTY — run `stripe listen --forward-to localhost:3000/api/subscriptions`,');
    console.log('paste the whsec_... into .env.local, then re-run setup (or the webhook will 400 invalid_signature).');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cookie-aware fetch against the local dev server. */
function makeSession() {
  let cookie = '';
  return async (pathname, init = {}) => {
    const res = await fetch(`${ORIGIN}${pathname}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(cookie ? { cookie } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return res;
  };
}

async function check() {
  const env = readEnvFile();
  if (!env.STRIPE_ENV) throw new Error('Run `node scripts/stripe-sandbox.mjs setup` first');
  const session = makeSession();
  const email = `sandbox-${Date.now()}@example.com`;

  const health = await session('/api/subscriptions/_health');
  // NOTE: `_health` routes live in underscore-prefixed folders, which Next treats as
  // PRIVATE (unroutable) — so this 404s in dev even though the handler works. In
  // production the same path is served by the Lambda via CloudFront. Logged, not fatal.
  console.log(`_health: HTTP ${health.status} (dev route 404s by design — underscore folder)`);

  await session('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) });
  const verify = await session('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp: '123456' }), // dummy OTP (dev/e2e universe)
  });
  // Response.status is a PROPERTY (Playwright's APIResponse.status() is a method —
  // do not copy that convention here).
  if (verify.status !== 200) throw new Error(`login failed: HTTP ${verify.status} ${await verify.text()}`);

  const before = await (await session('/api/subscriptions/status')).json();
  console.log(`before: tier=${before.tier} status=${before.status}`);

  const checkout = await session('/api/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'monthly' }),
  });
  const body = await checkout.json();
  if (checkout.status !== 200) throw new Error(`checkout failed: HTTP ${checkout.status} ${JSON.stringify(body)}`);
  console.log(`\nREAL Stripe Checkout Session created:\n  ${body.url}`);
  console.log(`  (verify metadata: ${body.id ? `stripe checkout sessions retrieve ${body.id}` : 'n/a'})`);

  console.log('\nPaying with 4242 4242 4242 4242 (any future expiry / CVC / postcode) flips the tier.');
  console.log('Waiting up to 5 minutes for the webhook + tier flip...\n');
  for (let i = 1; i <= 60; i++) {
    await sleep(5000);
    const after = await (await session('/api/subscriptions/status')).json();
    if (after.tier === 'premium') {
      console.log(`PASS after ~${i * 5}s: tier=${after.tier} status=${after.status} plan=${after.plan} trialEnds=${after.trialEndsAt}`);
      console.log('End-to-end verified: checkout -> Stripe -> webhook signature -> retrieveSubscription -> tier.');
      return;
    }
    if (i % 6 === 0) console.log(`  still ${after.tier}/${after.status} (~${i * 5}s)`);
  }
  throw new Error('TIMEOUT: tier never flipped — check the stripe listen output and the dev server log');
}

const step = process.argv[2];
try {
  if (step === 'setup') await setup();
  else if (step === 'check') await check();
  else {
    console.log('usage: node scripts/stripe-sandbox.mjs <setup|check>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
