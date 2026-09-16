#!/usr/bin/env node
/**
 * UX-review screenshots for the Phase 1b content surfaces (docs/premium-content-protection-plan.md):
 * the premium paper shell and mixed review, at 375px + 1280px × light + dark, plus the state variants
 * that only exist for these two:
 *
 *   /papers/math-y7/math-y7-set-2   anonymous → the tease over public metadata (the old build shipped
 *                                   the whole paper here, so this artifact is the UX half of the leak fix)
 *   /mixed-review                   loading → drawn set, and the weak-areas mode
 *
 * Writes to ux-screenshots/content/ (gitignored). `--base=http://localhost:3000` reuses an
 * ALREADY-RUNNING dev server — Next 16 refuses to start a second one for the same directory.
 *
 * Run:  node scripts/capture-content-ux.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3237;
const baseArg = process.argv.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length).replace(/\/$/, '') : `http://localhost:${PORT}`;
const EXTERNAL = Boolean(baseArg);
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'content');
const SERVER_LOG = path.join(OUT, 'server.log');
mkdirSync(OUT, { recursive: true });

// `waitFor` is the text that proves the state actually rendered before the shutter.
const SHOTS = [
  { name: 'premium-set-tease', path: '/papers/math-y7/math-y7-set-2', waitFor: 'See Premium plans' },
  // Free control shot: the answer box is an aria-label, so it needs getByLabel — getByText cannot see
  // accessible names (the first version of this script timed out on exactly that).
  { name: 'premium-set-free-control', path: '/papers/math-y7/math-y7-set-1', waitForLabel: /Your answer/i },
  { name: 'mixed-review', path: '/mixed-review', waitFor: /Q\.|Loading mixed review/ },
  { name: 'mixed-review-weak', path: '/mixed-review?mode=weak', waitFor: /Focused on your weak areas|No weak areas found yet/ },
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
      if ((await fetch(`${BASE}/papers/math-y7/math-y7-set-2`)).ok) return true;
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

  for (const shot of SHOTS) {
    for (const theme of ['light', 'dark']) {
      for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
        const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: 'light' });
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        try {
          await page.goto(BASE);
          // Theme is a localStorage preference read on mount; set it, then load the page.
          await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
          await page.goto(`${BASE}${shot.path}`);
          const waiter = shot.waitForLabel
            ? page.getByLabel(shot.waitForLabel).first()
            : page.getByText(shot.waitFor).first();
          await waiter.waitFor();
          await page.waitForTimeout(700);
          const file = `${shot.name}-${vpName}-${theme}.png`;
          await page.screenshot({ path: path.join(OUT, file), fullPage: true });
          console.log('captured', file);
        } catch (err) {
          failures++;
          console.error(`FAILED ${shot.name}-${vpName}-${theme}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
        } finally {
          await context.close().catch(() => {});
        }
      }
    }
  }

  // The premium tease at 375px is the state most likely to break: an inert preview plus a benefit card
  // in one narrow column. Photograph it on its own so the reviewer can judge the stacking.
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 1400 }, colorScheme: 'light' });
    const page = await context.newPage();
    try {
      await page.goto(BASE);
      await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
      await page.goto(`${BASE}/papers/math-y7/math-y7-set-2`);
      await page.getByText('See Premium plans').first().waitFor();
      await page.waitForTimeout(400);
      const card = page.locator('.card').last();
      await card.scrollIntoViewIfNeeded();
      const file = `premium-tease-card-mobile-${theme}.png`;
      await card.screenshot({ path: path.join(OUT, file) });
      console.log('captured', file);
    } catch (err) {
      failures++;
      console.error(`FAILED tease-card-${theme}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
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
