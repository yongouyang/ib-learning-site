#!/usr/bin/env node
/**
 * Regenerates the UX-review screenshots for the tier-hub pages
 * (docs/tier-hub-polish-plan.md §7): /ks3, /ks3/math, /ks3/english (multi-group
 * control), /ibdp, /ibdp/math, /igcse, /igcse/math — each at 375px + 1280px ×
 * light + dark. Self-contained: starts a throwaway Next dev server with the e2e
 * dummy wiring; hubs are public, so no sign-in. Writes to ux-screenshots/hub/
 * (gitignored).
 *
 * Run:  node scripts/capture-hub-ux.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3233;
const SERVER_LOG = path.resolve(process.cwd(), 'ux-screenshots', 'hub', 'server.log');
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'hub');
mkdirSync(OUT, { recursive: true });

// e2e dummy wiring (mirrors playwright.config.ts) — harmless for public pages.
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
};

async function waitForServer(timeoutMs = 180000) {
  console.log('waiting for dev server on', BASE);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) {
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

const PAGES = ['/ks3', '/ks3/math', '/ks3/english', '/ibdp', '/ibdp/math', '/igcse', '/igcse/math'];
const SHOTS = [];
for (const page of PAGES) {
  for (const theme of ['light', 'dark']) {
    for (const vp of [{ w: 375, h: 812, name: 'mobile' }, { w: 1280, h: 800, name: 'desktop' }]) {
      SHOTS.push({ file: `${page.replace(/\//g, '_')}-${vp.name}-${theme}.png`, viewport: { width: vp.w, height: vp.h }, theme, page });
    }
  }
}

const server = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
  env: ENV,
  stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
  detached: true,
});

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  // Establish an origin before the loop: localStorage on about:blank is opaque (SecurityError).
  await page.goto(BASE);

  for (const s of SHOTS) {
    await page.setViewportSize(s.viewport);
    await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), s.theme);
    await page.goto(`${BASE}${s.page}`);
    await page.waitForSelector('nav[aria-label="Breadcrumb"]', { state: 'attached' });
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
