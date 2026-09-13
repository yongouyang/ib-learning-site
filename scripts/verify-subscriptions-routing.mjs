// Verifies that /api/subscriptions* on a DEPLOYED origin is served by the
// subscriptions Lambda (E4.2) — not by the feedback Lambda that owns /api/*.
//
//   node scripts/verify-subscriptions-routing.mjs https://dev.octavlearning.com
//   node scripts/verify-subscriptions-routing.mjs https://octavlearning.com
//
// Why this exists next to the CI smoke probe: the smoke only greps
// `"ok":true` from /api/subscriptions/_health. That catches a MISSING lambda,
// but not a mis-ROUTED one, and `/api/*` silently accepts the paths — every
// unclaimed /api/... path lands on the feedback Lambda, which answers 200 to
// some of them (GET /api/subscriptions/status returned 200 {"configured":true}
// before this shipped) or 400s with an AI-marking schema ("stem",
// "markscheme", "studentAnswer"). Those bodies are the signature of a
// fall-through, so they are asserted against explicitly here. This is the class
// that already bit the bare /api/contact path once (2026-08-24) and would have
// silently swallowed every Stripe webhook.
//
// Read-only: no session required, no writes, no Stripe calls. Safe anywhere.

const origin = (process.argv[2] ?? '').replace(/\/$/, '');
if (!origin) {
  console.error('usage: node scripts/verify-subscriptions-routing.mjs <origin>');
  process.exit(2);
}

/** Bodies that prove the FEEDBACK Lambda answered instead of ours. */
function feedbackSignature(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  if (/"configured"\s*:\s*(true|false)/.test(text)) return 'feedback GET shape ({"configured":…})';
  if (/markscheme|studentAnswer|modelAnswer/.test(text)) return 'feedback POST schema (markscheme/studentAnswer)';
  if (/"error"\s*:\s*"quota_exceeded"/.test(text)) return 'feedback AI-mark quota error';
  return null;
}

async function probe(name, path, init, expect) {
  let status = 0;
  let body = '';
  try {
    const res = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(20_000) });
    status = res.status;
    body = await res.text();
  } catch (err) {
    console.log(`  FAIL  ${name} — request failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }

  // The control probe (/api/feedback) is EXPECTED to be answered by the feedback
  // Lambda, so the leak heuristic must not apply to it — otherwise the check that
  // proves the new behaviours did not capture a sibling path always fails.
  const leak = expect.ownedByFeedback ? null : feedbackSignature(body);
  if (leak) {
    console.log(`  FAIL  ${name} — HTTP ${status}, answered by the FEEDBACK Lambda (${leak})`);
    console.log(`        body: ${body.slice(0, 140)}`);
    return false;
  }
  if (status !== expect.status) {
    console.log(`  FAIL  ${name} — HTTP ${status}, expected ${expect.status}`);
    console.log(`        body: ${body.slice(0, 140)}`);
    return false;
  }
  if (expect.match && !expect.match.test(body)) {
    console.log(`  FAIL  ${name} — HTTP ${status} but body did not match ${expect.match}`);
    console.log(`        body: ${body.slice(0, 140)}`);
    return false;
  }
  console.log(`  ok    ${name} — HTTP ${status} ${body.slice(0, 80)}`);
  return true;
}

const checks = [
  // The only unauthenticated endpoint: proves routing AND the DynamoDB/IAM
  // grant AND that STRIPE_ENV parsed (a partial/wiped secret 500s it).
  probe('GET  _health (unauthenticated)', '/api/subscriptions/_health', {}, { status: 200, match: /"ok":\s*true/ }),
  // Session-gated: ours is 401 login_required; the feedback GET is 200.
  probe('GET  status (no session)', '/api/subscriptions/status', {}, { status: 401, match: /login_required/ }),
  probe(
    'POST checkout (no session)',
    '/api/subscriptions/checkout',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'monthly' }) },
    { status: 401, match: /login_required/ }
  ),
  // The bare path is where Stripe POSTs. Signature-gated, so an unsigned request
  // must reach OUR handler and be rejected there: 400 missing_signature.
  probe('POST webhook (bare path, no signature)', '/api/subscriptions', { method: 'POST', body: '{}' }, {
    status: 400,
    match: /missing_signature/,
  }),
  probe(
    'POST webhook (forged signature)',
    '/api/subscriptions',
    { method: 'POST', headers: { 'stripe-signature': 't=1,v1=deadbeef' }, body: '{}' },
    { status: 400, match: /invalid_signature/ }
  ),
  // A sibling path that must NOT have been captured by the new behaviours.
  probe('GET  feedback still owns /api/feedback', '/api/feedback', {}, {
    status: 200,
    match: /"configured"/,
    ownedByFeedback: true,
  }),
];

const results = [];
for (const check of checks) results.push(await check);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} routing checks passed against ${origin}`);
if (failed) {
  console.log('If the failures say "answered by the FEEDBACK Lambda", the /api/subscriptions');
  console.log('behaviours are missing or ordered AFTER /api/* in the distribution.');
  process.exit(1);
}
