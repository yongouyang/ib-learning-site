#!/usr/bin/env node
/**
 * Regenerates the UX-review screenshots for the admin DynamoDB dashboard
 * (Feature 2, /admin/dynamodb). Self-contained: starts a throwaway Next dev
 * server with the e2e dummy wiring, signs in as an admin, and captures
 * mobile (375px) + desktop, light + dark to ux-screenshots/admin/ (gitignored
 * — Playwright's test-results/ is cleared on every run, so screenshots must
 * NOT live there).
 *
 * Run:  node scripts/capture-admin-ux.mjs
 * Output: ux-screenshots/admin/{desktop,mobile}-{light,dark}.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3230;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'admin');
mkdirSync(OUT, { recursive: true });

// e2e dummy wiring (mirrors playwright.config.ts): dummy auth with the
// deterministic code 123456, admin allowlist matching the sign-in email.
const ENV = {
  ...process.env,
  AUTH_STORAGE: 'dummy',
  AUTH_EMAIL: 'dummy',
  AUTH_TEST_MODE: '1',
  ANALYTICS_STORAGE: 'dummy',
  ANALYTICS_ADMIN_EMAILS: 'admin@example.com',
  ADMIN_STORAGE: 'dummy',
  PROGRESS_STORAGE: 'dummy',
  FEEDBACK_STORAGE: 'dummy',
  FEEDBACK_PROVIDER: 'dummy',
  FEEDBACK_TEST_MODE: '1',
};

async function waitForServer(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.ok) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Dev server did not become ready in time');
}

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByText(/Enter the 6-digit code/).waitFor();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await page.waitForURL(`${BASE}/`);
}

const server = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
  env: ENV,
  stdio: 'ignore',
  detached: true,
});

const SHOTS = [
  { file: 'desktop-light.png', viewport: { width: 1280, height: 800 }, theme: 'light', page: '/admin/dynamodb' },
  { file: 'desktop-dark.png', viewport: { width: 1280, height: 800 }, theme: 'dark', page: '/admin/dynamodb' },
  { file: 'mobile-light.png', viewport: { width: 375, height: 812 }, theme: 'light', page: '/admin/dynamodb' },
  { file: 'mobile-dark.png', viewport: { width: 375, height: 812 }, theme: 'dark', page: '/admin/dynamodb' },
  { file: 'account-desktop-light.png', viewport: { width: 1280, height: 800 }, theme: 'light', page: '/account' },
  { file: 'account-desktop-dark.png', viewport: { width: 1280, height: 800 }, theme: 'dark', page: '/account' },
  { file: 'account-mobile-light.png', viewport: { width: 375, height: 812 }, theme: 'light', page: '/account' },
  { file: 'account-mobile-dark.png', viewport: { width: 375, height: 812 }, theme: 'dark', page: '/account' },
];

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);

  for (const s of SHOTS) {
    await page.setViewportSize(s.viewport);
    // Force the theme via localStorage before the app hydrates — more reliable
    // than emulateMedia for a stored-theme app.
    await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), s.theme);
    await page.goto(`${BASE}${s.page}`);
    // Wait for async content: the table dropdown (dynamodb) or the account page.
    if (s.page === '/admin/dynamodb') {
      await page.locator('#admin-table option[value^="octav-"]').first().waitFor({ state: 'attached' });
    } else {
      await page.getByRole('heading', { name: 'Admin console' }).waitFor();
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, s.file), fullPage: true });
    console.log('captured', s.file);
  }

  await browser.close();
  console.log(`UX screenshots written to ${OUT}`);
} catch (err) {
  console.error('Failed to capture screenshots:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
