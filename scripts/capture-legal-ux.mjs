#!/usr/bin/env node
/**
 * UX-review screenshots for the published legal pages: /terms and /privacy, at
 * 375px + 1280px × light + dark, plus close-ups of the tables at 375px (the
 * rendering most likely to break in a narrow column). Writes to
 * ux-screenshots/legal/ (gitignored).
 *
 * Self-contained: starts a throwaway Next dev server. These pages are PUBLIC, so
 * unlike capture-billing-ux.mjs there is no sign-in and no API interception.
 *
 * `--base=http://localhost:3000` reuses an ALREADY-RUNNING dev server instead of
 * starting one. That is not a nicety: Next 16 refuses to start a second dev server
 * for the same project directory ("Another next dev server is already running"), so
 * with one up this script cannot start its own — it would just fail to become ready.
 *
 * Run:  node scripts/capture-legal-ux.mjs
 *       node scripts/capture-legal-ux.mjs --base=http://localhost:3222
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3235;
const baseArg = process.argv.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length).replace(/\/$/, '') : `http://localhost:${PORT}`;
const EXTERNAL = Boolean(baseArg);
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'legal');
const SERVER_LOG = path.join(OUT, 'server.log');
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'terms', path: '/terms', heading: 'Terms of Use' },
  { name: 'privacy', path: '/privacy', heading: 'Privacy Notice' },
];
const VIEWPORTS = {
  mobile: { w: 375, h: 1400 },
  desktop: { w: 1280, h: 1200 },
};

const server = EXTERNAL
  ? null
  : spawn(
      process.execPath,
      [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--port', String(PORT)],
      {
        env: process.env,
        stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
        detached: true,
      }
    );
server?.unref();

const ready = async (timeoutMs = 180_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/terms`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

let failures = 0;
try {
  if (!(await ready())) throw new Error(`dev server never became ready — see ${SERVER_LOG}`);
  const browser = await chromium.launch();

  for (const pg of PAGES) {
    for (const theme of ['light', 'dark']) {
      for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
        const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: 'light' });
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        try {
          await page.goto(BASE);
          // Theme is a localStorage preference read on mount; set it, then load the page.
          await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
          await page.goto(`${BASE}${pg.path}`);
          await page.getByRole('heading', { name: pg.heading }).first().waitFor();
          await page.waitForTimeout(600);
          const file = `${pg.name}-${vpName}-${theme}.png`;
          await page.screenshot({ path: path.join(OUT, file), fullPage: true });
          console.log('captured', file);
        } catch (err) {
          failures++;
          console.error(`FAILED ${pg.name}-${vpName}-${theme}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
        } finally {
          await context.close().catch(() => {});
        }
      }
    }
  }

  // Close-ups: the tables are the one construct that can overflow a narrow column.
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 1400 }, colorScheme: 'light' });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
      await page.goto(`${BASE}/privacy`);
      await page.getByText('These are all the cookies we set').first().waitFor();
      const section = page.locator('div.overflow-x-auto').first();
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const file = `privacy-cookie-table-mobile-${theme}.png`;
      await section.screenshot({ path: path.join(OUT, file) });
      console.log('captured', file);
    } catch (err) {
      failures++;
      console.error(`FAILED cookie-table-${theme}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close();
  console.log(`UX screenshots written to ${OUT}${failures ? ` (${failures} FAILED)` : ''}`);
} catch (err) {
  console.error('Failed to capture screenshots:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (server) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}
