// Deployed-webhook probe for the subscriptions API (E4.2) — the gate that
// `_health` alone cannot be.
//
//   STRIPE_ENV='{"SECRET_KEY_TEST":"…","WEBHOOK_SECRET_TEST":"…",…}' \
//     node scripts/webhook-probe.mjs https://dev.octavlearning.com
//
// Why: on 2026-09-13 the deploy smoke went GREEN while every Stripe webhook
// returned 500. `_health` proved routing, IAM and the secret, but the first
// thing a real delivery does — a conditional PutItem into the ledger — died on
// "Invalid ConditionExpression: Attribute name is a reserved keyword" (`bucket`
// needs an #alias). No unit test and no local e2e could see it: mocks skip
// DynamoDB's server-side validator, and local runs use the in-memory dummy
// ledger. Only a real signed request against the deployed origin catches it.
//
// What one run proves, in order:
//   1. CloudFront routes /api/subscriptions (bare path) to the subscriptions
//      Lambda, and X-Octav-Env makes it resolve the right key set;
//   2. every price id in STRIPE_ENV actually exists at Stripe (added 2026-09-14
//      after a paste typo made monthly checkout 502 while annual worked);
//   3. our signature verification accepts a correctly signed payload;
//   4. the ledger's conditional write SUCCEEDS (IAM + expression validity);
//   5. a real Stripe API call is made (the handler re-reads the subscription);
//   6. an unsigned request is rejected — catching a routing regression where
//      the feedback Lambda answers instead (it would 400 with its own schema).
//
// Safe to run anywhere: the payload references a subscription that does not
// exist, so the handler acknowledges and applies nothing. It writes one
// TTL-bounded ledger row per run.
import { createHmac } from 'node:crypto';

const origin = (process.argv[2] ?? '').replace(/\/$/, '');
if (!origin) {
  console.error('usage: STRIPE_ENV=<json> node scripts/webhook-probe.mjs <origin>');
  process.exit(2);
}

function stripeEnv() {
  const raw = process.env.STRIPE_ENV;
  if (!raw) {
    console.error('STRIPE_ENV is not set — the probe signs with the deployed webhook secret.');
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error('STRIPE_ENV is not valid JSON (single-line, straight quotes).');
    process.exit(2);
  }
}

const env = stripeEnv();

function webhookSecret() {
  // The DEV distribution resolves the TEST key set; the PROD distribution
  // resolves LIVE. A prod origin with no live keys answers 503 by design, so
  // this probe is wired into the DEV deploy job first and joins PROD in the same
  // change that adds the _LIVE key set (see docs/PROGRESS.md).
  return env.WEBHOOK_SECRET_TEST ?? env.WEBHOOK_SECRET_LIVE;
}

const secret = webhookSecret();
if (!secret) {
  console.error('STRIPE_ENV carries no webhook secret to sign with.');
  process.exit(2);
}

const eventId = `evt_probe_${Date.now().toString(36)}`;
const payload = JSON.stringify({
  id: eventId,
  object: 'event',
  type: 'customer.subscription.updated',
  created: Math.floor(Date.now() / 1000),
  // Deliberately nonexistent: the handler re-reads from Stripe, gets "No such
  // subscription", and acknowledges — so the probe never touches real data.
  data: { object: { id: 'sub_probe_nonexistent' } },
});
const t = Math.floor(Date.now() / 1000);
const signature = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

let failures = 0;

/** Every configured price id must exist at Stripe. A wrong id surfaces ONLY
 *  when a customer clicks a plan (502 "No such price"), and `_health` proves
 *  merely that the key set is COMPLETE — so on 2026-09-14 monthly checkout was
 *  dead on DEV because `PRICE_MONTHLY_TEST` was `price_1UF2vWj0a9…`, two
 *  characters dropped while pasting into the repo secret, while annual (pasted
 *  correctly) worked. This is that gate: the secret is checked against Stripe
 *  in the same run that applies it to the Lambda. */
async function checkPrices() {
  const checks = [];
  for (const mode of ['TEST', 'LIVE']) {
    const key = env[`SECRET_KEY_${mode}`];
    if (!key) continue;
    for (const plan of ['MONTHLY', 'ANNUAL']) {
      const id = env[`PRICE_${plan}_${mode}`];
      if (id) checks.push({ name: `PRICE_${plan}_${mode}`, id, key });
    }
  }
  if (checks.length === 0) {
    console.log('  FAIL  STRIPE_ENV carries no price ids to check');
    failures++;
    return;
  }
  for (const { name, id, key } of checks) {
    let detail = '';
    let ok = false;
    try {
      const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20_000),
      });
      ok = res.ok;
      if (!ok) detail = (await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`;
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }
    console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name} exists at Stripe (${id}) ${detail}`);
    if (!ok) {
      console.log('        Re-paste the id from Stripe; a customer only finds out when they pay.');
      failures++;
    }
  }
}

async function check(name, init, expect) {
  let status = 0;
  let body = '';
  try {
    const res = await fetch(`${origin}/api/subscriptions`, { ...init, signal: AbortSignal.timeout(20_000) });
    status = res.status;
    body = await res.text();
  } catch (err) {
    console.log(`  FAIL  ${name} — request failed: ${err instanceof Error ? err.message : err}`);
    failures++;
    return;
  }
  const ok = status === expect.status && (!expect.match || expect.match.test(body));
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name} — HTTP ${status} ${body.slice(0, 120)}`);
  if (!ok) {
    if (expect.status === 200 && status === 500) {
      console.log('        500 here means the handler threw AFTER verifying the signature —');
      console.log('        check /aws/lambda/iblearn-subscriptions for the exception (a DynamoDB');
      console.log('        validation/AccessDenied error on the ledger write is the known class).');
    }
    if (/"configured"|markscheme|studentAnswer/.test(body)) {
      console.log('        This is the FEEDBACK Lambda answering — the /api/subscriptions behavior');
      console.log('        is missing or ordered after /api/*.');
    }
    failures++;
  }
}

console.log(`webhook probe against ${origin} (event ${eventId})`);
await checkPrices();
await check(
  'signed delivery is accepted and applied-or-ignored',
  { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload },
  { status: 200, match: /"received":\s*true/ }
);
await check('unsigned delivery is rejected', { method: 'POST', body: '{}' }, { status: 400, match: /missing_signature/ });

if (failures) {
  console.log(`\nFAILED: ${failures} subscriptions probe check(s) failed against ${origin}`);
  process.exit(1);
}
console.log('\nSigned-webhook path verified end to end.');
