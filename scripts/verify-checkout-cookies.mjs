#!/usr/bin/env node
/**
 * Measures the cookies the site actually sets, to test one claim in
 * `docs/privacy-notice-draft.md` §12: "We use one essential first-party cookie …
 * no third-party analytics cookies or cross-site tracking cookies."
 *
 * Why it needs a real browser: Stripe documents `__stripe_mid` / `__stripe_sid` as
 * fraud-prevention cookies it sets on the MERCHANT's domain, and until 2026-09-15
 * Stripe.js was a `<head>` script in the root layout (`src/app/layout.tsx`), so
 * those cookies landed on every page for every visitor — which made §12's "one
 * cookie" sentence false in a way no unit test can see. Only reading
 * `document.cookie` can. It is now injected by the billing panel (that fix is what
 * `ensureStripeScript()` in `src/components/BillingPanel.tsx` does), and this script
 * guards the result: part B fails if a page with no billing panel sets a `__stripe`
 * cookie, or if `/account` has a panel and Stripe.js never loads.
 *
 * It measures three states, with the Stripe.js request blocked to get a baseline:
 *   1. our own cookies (Stripe.js blocked — what the app sets by itself)
 *   2. + Stripe.js loaded, i.e. a billing panel on screen
 *   3. + a real embedded Checkout mounted (test mode, dummy auth)
 * and reports third-party cookies seen in the browser separately, since the
 * notice's claim is about OUR pages.
 *
 * Part A is a MEASUREMENT of whatever is deployed (it does not fail on what it
 * finds); part B is a GATE and exits non-zero on a broken invariant.
 *
 * Run:  node scripts/verify-checkout-cookies.mjs                       (both parts)
 *       node scripts/verify-checkout-cookies.mjs --skip-local          (live origin only)
 *       node scripts/verify-checkout-cookies.mjs --origin=https://octavlearning.com
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const value = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const REMOTE = value('origin', 'https://dev.octavlearning.com');
const SKIP_REMOTE = flag('skip-remote');
const SKIP_LOCAL = flag('skip-local');
const PORT = 3267;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'checkout-cookies');
const SERVER_LOG = path.join(OUT, 'server.log');
mkdirSync(OUT, { recursive: true });

const own = (origin) => new URL(origin).hostname;
let problems = 0;

function report(label, snapshot, origin) {
  const host = own(origin);
  const mine = snapshot.all.filter((c) => c.domain.replace(/^\./, '') === host);
  const third = snapshot.all.filter((c) => c.domain.replace(/^\./, '') !== host);
  console.log(`\n── ${label} ──`);
  console.log(`   document.cookie : ${snapshot.doc || '(empty)'}`);
  if (mine.length === 0) console.log('   cookies on our origin : none');
  for (const c of mine) {
    const life = c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'session';
    console.log(
      `   our origin: ${c.name.padEnd(18)} path=${c.path.padEnd(6)} expires=${life.padEnd(10)}` +
        ` httpOnly=${String(c.httpOnly).padEnd(5)} sameSite=${c.sameSite}`
    );
  }
  for (const c of third) {
    console.log(`   third-party: ${c.name} @ ${c.domain} (${c.expires > 0 ? 'persisted' : 'session'})`);
  }
  return { mine: mine.map((c) => c.name), third: third.map((c) => `${c.name}@${c.domain}`) };
}

async function snapshot(page, context) {
  return {
    doc: await page.evaluate(() => document.cookie),
    all: await context.cookies(),
  };
}

/**
 * Navigate and let Stripe.js settle.
 *
 * Deliberately NOT `waitUntil: 'networkidle'`: this is a PWA whose service worker
 * and analytics beacons keep the network busy, so networkidle never fires (the
 * first run of this script timed out on exactly that). `domcontentloaded` plus a
 * fixed settle window is the condition that actually works here.
 */
async function settle(page, url, { reload = false, ms = 5000 } = {}) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
  else await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(ms);
}

/** True if `name` was not present in `before` but is in `after`. */
const added = (before, after) => after.filter((n) => !before.includes(n));

// ─────────────────────────── part A: the live origin ───────────────────────────
if (!SKIP_REMOTE) {
  console.log(`\n=== PART A — ${REMOTE} (real origin, no sign-in needed) ===`);
  const browser = await chromium.launch();
  const measurements = {};

  // 1. Stripe.js blocked: whatever the app sets on its own.
  const bare = await browser.newContext();
  const barePage = await bare.newPage();
  barePage.setDefaultTimeout(60_000);
  await barePage.route('**://js.stripe.com/**', (r) => r.abort());
  await settle(barePage, `${REMOTE}/pricing`);
  measurements.bare = report('Stripe.js BLOCKED, /pricing', await snapshot(barePage, bare), REMOTE);
  await bare.close();

  // 2. Stripe.js allowed on the page that injects it (a billing panel is on screen).
  const plain = await browser.newContext();
  const plainPage = await plain.newPage();
  plainPage.setDefaultTimeout(60_000);
  await settle(plainPage, `${REMOTE}/pricing`, { ms: 8000 });
  const plainSnap = await snapshot(plainPage, plain);
  measurements.plain = report('Stripe.js ALLOWED, /pricing', plainSnap, REMOTE);
  await plain.close();

  // 3. The homepage, to see whether it is page-specific.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  otherPage.setDefaultTimeout(60_000);
  await settle(otherPage, `${REMOTE}/`, { ms: 8000 });
  measurements.home = report('Stripe.js ALLOWED, / (homepage)', await snapshot(otherPage, other), REMOTE);
  await other.close();

  await browser.close();

  const stripeOwn = added(measurements.bare.mine, measurements.plain.mine).filter((n) =>
    n.startsWith('__stripe')
  );
  const anyNew = added(measurements.bare.mine, measurements.plain.mine);
  console.log('\nVERDICT (live origin):');
  console.log(`   cookies set by our own code (Stripe.js blocked): ${measurements.bare.mine.join(', ') || 'none'}`);
  console.log(`   NEW on our origin once Stripe.js loads: ${anyNew.join(', ') || 'none'}`);
  console.log(`   Stripe fraud cookies on OUR domain: ${stripeOwn.join(', ') || 'NONE'}`);
  console.log(
    `   => §12's "one essential first-party cookie" is ${anyNew.length === 0 ? 'ACCURATE as far as this test can see' : 'FALSE and must be rewritten'}`
  );
}

// ─────────────────── part B: a real embedded checkout, locally ───────────────────
if (!SKIP_LOCAL) {
  console.log(`\n=== PART B — ${BASE} (dummy auth + real Stripe TEST mode) ===`);
  const envFile = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const pk = /^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(.+)$/m.exec(envFile)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (!pk || !/^pk_test_/.test(pk)) {
    console.error('SKIP: part B needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… in .env.local');
    process.exitCode = 2;
  } else {
    const NEXT_BIN = path.join('node_modules', 'next', 'dist', 'bin', 'next');
    const server = spawn(process.execPath, [NEXT_BIN, 'dev', '--port', String(PORT)], {
      env: {
        ...process.env,
        AUTH_STORAGE: 'dummy',
        AUTH_EMAIL: 'dummy',
        AUTH_TEST_MODE: '1',
        ANALYTICS_STORAGE: 'dummy',
        PROGRESS_STORAGE: 'dummy',
        FEEDBACK_STORAGE: 'dummy',
        SUBSCRIPTIONS_STORAGE: 'dummy',
        STRIPE_MODE: 'test',
      },
      stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
      detached: true,
    });
    server.unref();

    const ready = async (timeoutMs = 180_000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          if ((await fetch(`${BASE}/`)).ok) return true;
        } catch {
          /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return false;
    };

    if (!(await ready())) {
      console.error(`FAIL: local dev server never became ready — see ${SERVER_LOG}`);
      process.exitCode = 1;
    } else {
      const browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
      const page = await context.newPage();
      page.setDefaultTimeout(40_000);
      const block = (r) => r.abort();

      // THE INVARIANT THIS CHECK GUARDS (since 2026-09-15): a page with no billing
      // panel must not pull Stripe.js at all, so Stripe's device cookies never
      // reach a visitor who is not paying. Before the fix the root layout loaded
      // it on every page and this step saw __stripe_mid on the homepage.
      await settle(page, `${BASE}/`, { ms: 4000 });
      const homepage = report('signed out, / (no billing panel)', await snapshot(page, context), BASE);
      const homepageStripe = homepage.mine.filter((n) => n.startsWith('__stripe'));
      if (homepageStripe.length > 0) {
        console.error(
          `FAIL: Stripe.js is loading on a page with no billing panel — ${homepageStripe.join(', ')}`
        );
        problems++;
      }

      await page.route('**://js.stripe.com/**', block);
      await page.goto(`${BASE}/login`);
      await page.getByLabel('Email').fill(`cookie-check-${Date.now()}@example.com`);
      await page.getByRole('button', { name: 'Send sign-in code' }).click();
      await page.getByLabel('6-digit code').fill('123456');
      await page.getByRole('button', { name: 'Verify code' }).click();
      await page.waitForURL(`${BASE}/`);
      await settle(page, `${BASE}/pricing`);
      const baseline = report('signed in /pricing, Stripe.js BLOCKED', await snapshot(page, context), BASE);

      await page.unroute('**://js.stripe.com/**', block);
      await settle(page, `${BASE}/pricing`, { reload: true, ms: 6000 });
      const plain = report('signed in /pricing, Stripe.js ALLOWED', await snapshot(page, context), BASE);

      // /account carries the other billing panel, so Stripe.js IS expected here.
      await settle(page, `${BASE}/account`, { ms: 6000 });
      const account = report('signed in /account (billing panel)', await snapshot(page, context), BASE);
      const accountHasStripe = account.mine.some((n) => n.startsWith('__stripe'));
      if (!accountHasStripe) {
        console.error(
          'FAIL: /account has a billing panel but Stripe.js never loaded — the checkout cannot mount there.'
        );
        problems++;
      }

      let during = null;
      try {
        await page.getByRole('button', { name: /\$20 per month/i }).click();
        await page.locator('#checkout-form').waitFor({ state: 'attached' });
        await page.waitForTimeout(8000); // Stripe mounts the iframe + Link initialises
        during = report('DURING embedded checkout', await snapshot(page, context), BASE);
      } catch (err) {
        console.log(`\n   (checkout did not mount for the cookie check: ${err.message})`);
        problems++;
      }

      await browser.close();
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }

      console.log('\nVERDICT (local checkout):');
      console.log(`   / (no billing panel): ${homepageStripe.join(', ') || 'no Stripe cookies'}`);
      console.log(`   our own cookies: ${baseline.mine.join(', ') || 'none'}`);
      const afterStripe = added(baseline.mine, plain.mine);
      console.log(`   NEW once Stripe.js loads: ${afterStripe.join(', ') || 'none'}`);
      if (during) {
        const afterCheckout = added(plain.mine, during.mine);
        console.log(`   NEW while checkout is mounted: ${afterCheckout.join(', ') || 'none'}`);
        console.log(`   all cookies on our origin at checkout: ${during.mine.join(', ')}`);
        console.log(`   third-party cookies in the browser: ${during.third.join(', ') || 'none'}`);
      }
    }
  }
}

console.log(
  `\n${problems === 0 ? 'DONE' : `DONE WITH ${problems} PROBLEM(S)`} — artefacts: ${OUT}`
);
