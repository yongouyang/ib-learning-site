#!/usr/bin/env node
/**
 * Verifies the BROWSER half of Embedded Checkout against REAL Stripe test mode.
 *
 * Why this exists: the unit tests stub `window.Stripe`, so they can prove our
 * wiring but not that Stripe.js accepts it. The two things they cannot see are
 * exactly the ones an API-version bump breaks silently —
 *   * `stripe.createEmbeddedCheckoutPage()` is the name the pinned
 *     2026-03-25.dahlia release uses (it replaced `initEmbeddedCheckout()`, which
 *     now throws an IntegrationError), and
 *   * the `appearance` option is accepted.
 * This drives a real browser: sign in (dummy OTP), click a plan, create a real
 * test-mode Checkout Session, and assert Stripe's checkout iframe mounts.
 *
 * It is NOT part of CI: it needs a real `pk_test_…` in .env.local (the key is
 * never printed) plus the STRIPE_ENV test key set, and it talks to Stripe.
 *
 * Run:  node scripts/check-embedded-checkout.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3266;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'embedded-checkout-check');
const SERVER_LOG = path.join(OUT, 'server.log');
mkdirSync(OUT, { recursive: true });

// Preflight: the key must exist LOCALLY (its value is never logged).
const envFile = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const pk = /^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(.+)$/m.exec(envFile)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!pk || !/^pk_(test|live)_/.test(pk)) {
  console.error('FAIL: put NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… in .env.local first');
  process.exit(2);
}
if (pk.startsWith('pk_live_')) {
  console.error('FAIL: refusing to run against a LIVE publishable key — this creates real checkout sessions');
  process.exit(2);
}

const ENV = {
  ...process.env,
  // Dummy auth so the flow is reachable from a script (OTP 123456).
  AUTH_STORAGE: 'dummy',
  AUTH_EMAIL: 'dummy',
  AUTH_TEST_MODE: '1',
  ANALYTICS_STORAGE: 'dummy',
  PROGRESS_STORAGE: 'dummy',
  FEEDBACK_STORAGE: 'dummy',
  FEEDBACK_PROVIDER: 'dummy',
  FEEDBACK_TEST_MODE: '1',
  CONTACT_STORAGE: 'dummy',
  SUBSCRIPTIONS_STORAGE: 'dummy',
  // Real Stripe TEST mode: `.env.local` supplies STRIPE_ENV (test key set) and
  // the publishable key above; `next dev` loads that file itself.
  STRIPE_MODE: 'test',
};

const NEXT_BIN = path.join('node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [NEXT_BIN, 'dev', '--port', String(PORT)], {
  env: ENV,
  stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
  detached: true,
});
// Detached: unref so this script can exit while the server is still shutting
// down, and kill the whole process GROUP at the end — SIGTERM to the `npx`
// wrapper alone leaves the real next-server running and the run hanging.
server.unref();

async function waitForServer(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('dev server did not become ready');
}

let failures = 0;
let exitCode = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(`embedded-check-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/pricing`);
  await page.getByRole('heading', { name: 'Premium' }).first().waitFor();
  // Deterministic wait for the session POST: a non-200 here (400 bad params, 503
  // keys not wired, 409 already subscribed) is the failure this check exists to
  // name, so it is awaited rather than sniffed from a listener afterwards.
  const [postResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/subscriptions/checkout') && r.request().method() === 'POST',
      { timeout: 60_000 }
    ),
    page.getByRole('button', { name: /\$20 per month/i }).click(),
  ]);
  const postStatus = postResponse.status();
  const postBody = await postResponse.text().catch(() => '');
  const hasSecret = postBody.includes('client_secret');

  const container = page.locator('#checkout-form');
  await container.waitFor({ state: 'attached' });

  let iframeCount = 0;
  try {
    await page.waitForFunction(() => document.querySelectorAll('#checkout-form iframe').length > 0, undefined, {
      timeout: 30_000,
    });
    iframeCount = await page.locator('#checkout-form iframe').count();
  } catch {
    /* reported below */
  }

  // …but an iframe is NOT proof the checkout rendered: the first version of this
  // check "passed" on a blank white container, because Stripe had mounted its
  // frame and put nothing in it. Assert Stripe's actual content instead.
  const checkoutFrame = page.frameLocator('#checkout-form iframe').first();
  let renderedText = '';
  try {
    await checkoutFrame.getByText(/Card information|Payment method/i).first().waitFor({ timeout: 45_000 });
    renderedText = (await checkoutFrame.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    /* reported below */
  }

  const iframeHosts = await page.locator('#checkout-form iframe').evaluateAll((nodes) =>
    nodes.map((n) => {
      try {
        return new URL((n).src).host;
      } catch {
        return '(no src)';
      }
    })
  );

  await page.screenshot({
    path: path.join(OUT, 'pricing-embedded-checkout.png'),
    clip: (await container.boundingBox()) ?? undefined,
  });

  console.log(`session POST: ${postStatus} client_secret=${hasSecret}`);
  console.log('iframes mounted inside #checkout-form:', iframeCount, iframeHosts);
  console.log('rendered checkout text:', renderedText || '(nothing rendered)');
  console.log('console errors:', consoleErrors.length ? consoleErrors : 'none');

  if (postStatus !== 200 || !hasSecret) {
    fail(`session POST not 200/client_secret: ${postStatus} ${postBody.slice(0, 200)}`);
  }
  if (iframeCount === 0) {
    fail('Stripe mounted no iframe inside #checkout-form — is `createEmbeddedCheckoutPage` the right call for this Stripe.js build, and is the publishable key valid?');
  }
  if (!iframeHosts.every((h) => h.endsWith('stripe.com') || h.endsWith('stripe.network'))) {
    fail(`unexpected iframe host(s): ${iframeHosts.join(', ')}`);
  }
  if (!renderedText) {
    fail('Stripe mounted a frame but rendered NO checkout inside it (blank container) — this is the failure mode the iframe-only assertion used to miss');
  }
  const integrationError = consoleErrors.find((e) => /IntegrationError|appearance|createEmbeddedCheckoutPage/i.test(e));
  if (integrationError) fail(`Stripe.js rejected the integration: ${integrationError}`);

  await browser.close();
  console.log(failures === 0 ? `PASS: Stripe checkout mounted. Screenshot: ${OUT}` : `FAILED (${failures})`);
  exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('check failed:', err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  // Shut the dev server down AND prove it: a leaked server makes the next run die
  // with "Another next dev server is already running", which reads as an unrelated
  // bug. The first version of this cleanup never ran at all — it sat after a
  // process.exit() inside the try block, and finally blocks do not run then.
  const groupAlive = () => {
    try {
      process.kill(-server.pid, 0); // signal 0 = "does the GROUP still exist?"
      return true;
    } catch {
      return false;
    }
  };
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 20 && groupAlive(); i++) await new Promise((r) => setTimeout(r, 250));
  if (groupAlive()) {
    console.error(`WARN: dev server ${server.pid} ignored SIGTERM — escalating to SIGKILL`);
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      /* gone */
    }
    await new Promise((r) => setTimeout(r, 500));
    if (groupAlive()) {
      console.error(`FAIL: dev server on port ${PORT} is still running — kill ${server.pid} before the next run`);
      exitCode = 1;
    }
  }
  process.exit(exitCode);
}
