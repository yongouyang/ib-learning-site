#!/usr/bin/env node
/**
 * UX-review screenshots for the E4.3 billing UI: the /pricing CTA block and the
 * /account Billing card, in the states that render differently — each at 375px +
 * 1280px × light + dark. Self-contained: starts a throwaway Next dev server with
 * the e2e dummy wiring (so the OTP is the deterministic 123456), signs in, and
 * intercepts /api/subscriptions/status per state — Stripe is never contacted.
 * Writes to ux-screenshots/billing/ (gitignored).
 *
 * Run:  node scripts/capture-billing-ux.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3234;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'billing');
const SERVER_LOG = path.join(OUT, 'server.log');
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

// e2e dummy wiring (mirrors playwright.config.ts) — the OTP is 123456.
const ENV = {
  ...process.env,
  AUTH_STORAGE: 'dummy',
  AUTH_EMAIL: 'dummy',
  AUTH_TEST_MODE: '1',
  ANALYTICS_STORAGE: 'dummy',
  PROGRESS_STORAGE: 'dummy',
  FEEDBACK_STORAGE: 'dummy',
  FEEDBACK_PROVIDER: 'dummy',
  FEEDBACK_TEST_MODE: '1',
  CONTACT_STORAGE: 'dummy',
  // Baked into the dev build at compile time (Next inlines NEXT_PUBLIC_*). A
  // placeholder on purpose: js.stripe.com is BLOCKED for the form states and
  // window.Stripe is stubbed, so no Stripe call can happen from this script.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_capture_ux',
};

const BASE_STATUS = {
  plan: null,
  status: null,
  tier: 'free',
  billingAvailable: true,
  currentPeriodEnd: null,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  card: null,
};

/** Viewports per state: the tablet band (640–760px) is where /pricing's 2-col
 *  plan grid squeezes the buttons narrowest, so the pricing states include it. */
const VIEWPORTS = {
  mobile: { w: 375, h: 1600 },
  tablet: { w: 700, h: 1200 },
  desktop: { w: 1280, h: 1200 },
};
const ALL_VIEWPORTS = ['mobile', 'tablet', 'desktop'];
const PRICING_VIEWPORTS = ['mobile', 'tablet', 'desktop'];

/**
 * One entry per visually distinct state. `status` is what /api/subscriptions/status
 * returns; `hang` leaves the request unanswered so the LOADING branch renders.
 */
const STATES = [
  { name: 'pricing-free', page: '/pricing', target: 'page', waitFor: 'Premium', status: BASE_STATUS },
  {
    name: 'pricing-unconfigured',
    page: '/pricing',
    target: 'page',
    waitFor: 'Premium',
    status: { ...BASE_STATUS, billingAvailable: false },
  },
  {
    name: 'pricing-canceled',
    page: '/pricing',
    target: 'page',
    waitFor: 'Premium',
    status: { ...BASE_STATUS, status: 'canceled', tier: 'free' },
  },
  {
    name: 'account-trialing',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: {
      ...BASE_STATUS,
      plan: 'monthly',
      status: 'trialing',
      tier: 'premium',
      trialEndsAt: '2026-09-27T02:17:13.000Z',
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
    },
  },
  {
    name: 'account-active',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: {
      ...BASE_STATUS,
      plan: 'monthly',
      status: 'active',
      tier: 'premium',
      currentPeriodEnd: '2026-10-13T00:00:00.000Z',
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
    },
  },
  {
    name: 'account-cancelling',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: {
      ...BASE_STATUS,
      plan: 'annual',
      status: 'active',
      tier: 'premium',
      currentPeriodEnd: '2026-10-13T00:00:00.000Z',
      cancelAtPeriodEnd: true,
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
    },
  },
  {
    name: 'account-past-due',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: {
      ...BASE_STATUS,
      plan: 'annual',
      status: 'past_due',
      tier: 'premium',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
    },
  },
  {
    name: 'account-incomplete',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: {
      ...BASE_STATUS,
      plan: 'monthly',
      status: 'incomplete',
      tier: 'free',
      currentPeriodEnd: '2026-09-20T00:00:00.000Z',
    },
  },
  { name: 'account-free', page: '/account', target: 'section', waitFor: 'Billing', status: BASE_STATUS },
  {
    name: 'account-unconfigured-premium',
    page: '/account',
    target: 'section',
    waitFor: 'Billing',
    status: { ...BASE_STATUS, tier: 'premium', billingAvailable: false },
  },
  // Non-data states: the panel's own loading and failure branches (the review
  // flagged that no shot existed for either, so nobody had ever SEEN them).
  { name: 'pricing-loading', page: '/pricing', target: 'page', waitFor: 'Premium', hang: true },
  { name: 'pricing-error', page: '/pricing', target: 'page', waitFor: 'Premium', error: 500 },
  // The embedded Checkout branch (2026-09-13). Stripe's iframe cannot be
  // captured without a real publishable key, so the SDK is STUBBED and paints a
  // labelled placeholder: this reviews the branch's own chrome (copy, container,
  // Cancel, spacing) — not Stripe's checkout.
  {
    name: 'pricing-checkout-form',
    page: '/pricing',
    target: 'page',
    waitFor: 'Premium',
    status: BASE_STATUS,
    clickPlan: true,
    stubStripe: 'ok',
  },
  {
    name: 'pricing-checkout-form-error',
    page: '/pricing',
    target: 'page',
    waitFor: 'Premium',
    status: BASE_STATUS,
    clickPlan: true,
    stubStripe: 'fail',
  },
];

/** The slice of Stripe.js the panel uses, faked: mount() paints a labelled box
 *  where the iframe would be (or nothing, for the 'fail' state). */
const STRIPE_STUB = `
  window.Stripe = () => ({
    createEmbeddedCheckoutPage: () => ({
      mount: (sel) => {
        const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (el) el.innerHTML = '<div style="height:520px;border:1px dashed #9ca3af;border-radius:8px;' +
          'display:flex;align-items:center;justify-content:center;color:#6b7280;font:14px system-ui">' +
          '[stubbed Stripe embedded checkout — plan, card + billing address]</div>';
      },
      destroy: () => {},
    }),
  });
`;

async function waitForServer(timeoutMs = 180000) {
  console.log('waiting for dev server on', BASE);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/`)).ok) {
        console.log('dev server ready');
        return;
      }
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Dev server did not become ready in time');
}

// Spawn the local Next binary DIRECTLY, not through npx: the wrapper re-parents
// the real next-server, so killing the npx pid leaves an orphan running and the
// next script/e2e run dies with "Another next dev server is already running".
const NEXT_BIN = path.join('node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [NEXT_BIN, 'dev', '--port', String(PORT)], {
  env: ENV,
  stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
  detached: true,
});

try {
  await waitForServer();
  const browser = await chromium.launch();

  // Sign in ONCE, keep the storage state, then give every state its own context
  // so a route interception can never leak into the next state (the first
  // version shared one page and re-routed per shot — which is also how a hung
  // run stayed silent).
  const signInContext = await browser.newContext();
  const signInPage = await signInContext.newPage();
  await signInPage.goto(BASE);
  await signInPage.goto(`${BASE}/login`);
  await signInPage.getByLabel('Email').fill(`ux-${Date.now()}@example.com`);
  await signInPage.getByRole('button', { name: 'Send sign-in code' }).click();
  await signInPage.getByLabel('6-digit code').fill('123456');
  await signInPage.getByRole('button', { name: 'Verify code' }).click();
  await signInPage.waitForURL(`${BASE}/`);
  const state = await signInContext.storageState();
  await signInContext.close();
  console.log('signed in (dummy OTP)');

  let failures = 0;
  for (const st of STATES) {
    for (const theme of ['light', 'dark']) {
      for (const vpName of st.viewports ?? ALL_VIEWPORTS) {
        const vp = { ...VIEWPORTS[vpName], name: vpName };
        const file = `${st.name}-${vp.name}-${theme}.png`;
        const context = await browser.newContext({ storageState: state, colorScheme: 'light' });
        const page = await context.newPage();
        // Every wait is bounded, so a stall raises instead of hanging for ever
        // (the previous run sat idle for 25 minutes with a 0-byte log).
        page.setDefaultTimeout(20_000);
        page.setDefaultNavigationTimeout(30_000);
        try {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          if (st.hang) {
            // Leave the request unanswered long enough to render the loading
            // branch, then abort it — a handler that NEVER settles can block
            // Playwright's own teardown.
            await page.route('**/api/subscriptions/status', async (route) => {
              await new Promise((r) => setTimeout(r, 20_000));
              await route.abort();
            });
          } else if (st.error) {
            await page.route('**/api/subscriptions/status', (route) => route.fulfill({ status: st.error, body: '{}' }));
          } else {
            await page.route('**/api/subscriptions/status', (route) =>
              route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st.status) })
            );
          }

          if (st.stubStripe) {
            // js.stripe.com must not load: the stub below is what defines
            // window.Stripe, and for 'fail' nothing does (the error branch).
            await page.route('**://js.stripe.com/**', (route) => route.abort());
            if (st.stubStripe === 'ok') await page.addInitScript(STRIPE_STUB);
            await page.route('**/api/subscriptions/checkout', (route) =>
              route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ client_secret: 'cs_test_capture_secret' }),
              })
            );
          }

          await page.goto(BASE); // establish the origin before localStorage
          await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
          await page.goto(`${BASE}${st.page}`);
          await page.getByRole('heading', { name: st.waitFor }).first().waitFor();
          if (st.clickPlan) {
            await page.getByRole('button', { name: /\$20 per month/i }).click();
            // 'attached', not 'visible': the container is empty until Stripe's
            // iframe (or our error message) paints, and Playwright treats a
            // zero-size element as hidden — the first version of this wait
            // timed out on a branch that HAD rendered.
            await page.locator('#checkout-form').waitFor({ state: 'attached' });
            // Wait for THIS branch's message by TEXT, not role: the page already
            // has other role=alert elements (offline banner, update toast), and
            // the first version of this wait matched one of those — so it
            // screenshotted 0.6s after the click, before the SDK-load bound (5s)
            // had even elapsed, and the shot showed no message at all.
            if (st.stubStripe === 'fail') {
              await page.getByText(/Couldn’t load the checkout/i).waitFor();
            }
          }
          await page.waitForTimeout(st.hang ? 400 : 600);

          // Always capture the CHANGED SURFACE (the card), never the full page:
          // a page-level shot mixes in the fixed nav/badge/bubble, which is how
          // the first pass produced a shot that looked like overlapping CTAs.
          const target =
            st.target === 'section'
              ? page.locator('section', { has: page.getByRole('heading', { name: 'Billing' }) })
              : page.locator('section', { has: page.getByRole('heading', { name: 'Premium' }) });
          await target.screenshot({ path: path.join(OUT, file) });
          console.log('captured', file);
        } catch (err) {
          failures++;
          console.error(`FAILED ${file}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
        } finally {
          await context.close().catch(() => {});
        }
      }
    }
  }

  await browser.close();
  console.log(`UX screenshots written to ${OUT}${failures ? ` (${failures} FAILED)` : ''}`);
  if (failures) process.exitCode = 1;
} catch (err) {
  console.error('Failed to capture screenshots:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  try {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
