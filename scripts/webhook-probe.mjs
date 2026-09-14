// Deployed-webhook probe for the subscriptions API (E4.2) — the gate that
// `_health` alone cannot be.
//
//   STRIPE_ENV='{"SECRET_KEY_TEST":"…","WEBHOOK_SECRET_TEST":"…",…}' \
//     [STRIPE_PROBE_MODE=live] node scripts/webhook-probe.mjs https://dev.octavlearning.com
//
// STRIPE_PROBE_MODE picks which key set to sign with, because the same secret
// carries BOTH sets and the DEV distribution verifies against TEST while PROD
// verifies against LIVE (default: test).
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

/** Which key set this run signs with (the two distributions verify different
 *  ones). Defaults to test, so every existing invocation keeps its behaviour. */
const probeMode = (process.env.STRIPE_PROBE_MODE ?? 'test').trim().toLowerCase();
if (probeMode !== 'test' && probeMode !== 'live') {
  console.error(`STRIPE_PROBE_MODE must be test or live (got "${probeMode}")`);
  process.exit(2);
}

function webhookSecret() {
  // The DEV distribution resolves the TEST key set; the PROD distribution
  // resolves LIVE. A prod origin with no live keys answers 503 by design, which
  // is why PROD only joins this probe in the change that adds the _LIVE set.
  const suffix = probeMode.toUpperCase();
  const secret = env[`WEBHOOK_SECRET_${suffix}`];
  if (!secret) {
    console.error(`STRIPE_ENV carries no WEBHOOK_SECRET_${suffix} — cannot sign a ${probeMode}-mode delivery.`);
    process.exit(2);
  }
  return secret;
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
    let taxCode = '(unknown)';
    try {
      // expand the product: Managed Payments REFUSES a Checkout Session whose
      // product has no tax code, so a live price created without it turns every
      // live checkout into a 400 — a failure worth catching here rather than in
      // front of a paying customer. (Test mode caught the same rule on 2026-09-13.)
      const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}?expand[]=product`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20_000),
      });
      ok = res.ok;
      if (ok) {
        const price = await res.json();
        taxCode = price.tax_code ?? price.product?.tax_code ?? null;
      } else {
        detail = (await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`;
      }
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }
    console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name} exists at Stripe (${id}) ${detail}`);
    if (!ok) {
      console.log('        Re-paste the id from Stripe; a customer only finds out when they pay.');
      failures++;
      continue;
    }
    const taxOk = typeof taxCode === 'string' && taxCode.length > 0;
    console.log(`  ${taxOk ? 'ok   ' : 'FAIL '} ${name}'s product has a tax code (${taxCode || 'none'})`);
    if (!taxOk) {
      console.log('        Managed Payments rejects every Checkout Session without one — set');
      console.log('        tax code txcd_20060058 (Training Services – Self-study Web-based).');
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
