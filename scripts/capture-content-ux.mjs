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
  // The skeleton state (entitlements still resolving). Only reachable while /api/auth/me is in flight,
  // so this shot delays that response and photographs the aria-busy block the reviewer could not see.
  { name: 'premium-set-skeleton', path: '/papers/math-y7/math-y7-set-2', waitFor: 'Loading this set…', delayAuthMe: true },
  { name: 'mixed-review', path: '/mixed-review', waitFor: /Q\.|Loading mixed review/ },
  { name: 'mixed-review-weak', path: '/mixed-review?mode=weak', waitFor: /Focused on your weak areas|No weak areas found yet/ },
  // The weak-mode FALLBACK: local progress holds a weak topic (so ids are sent) but the filtered draw
  // is refused (a stale id list, the case that used to dead-end), so the retry draws from all topics
  // and the yellow banner says so. Seeded progress + a forced 404 on the two-segment path.
  { name: 'mixed-review-weak-fallback', path: '/mixed-review?mode=weak', waitFor: 'Could not build a weak-area review', seedWeakProgress: true, failFiltered: true },
  // The two cards the first review pass could not see. They only render for a session the CLIENT
  // believes is entitled, so the shot signs in through the dummy OTP flow and patches the me()
  // response's entitlements (the user object itself stays the server's), then makes the content fetch
  // answer 401 / 403. That is also exactly the production-issue reproduction path for these states.
  { name: 'premium-set-401', path: '/papers/math-y7/math-y7-set-2', waitFor: 'Sign in to open this set', asEntitled: true, paperStatus: 401 },
  { name: 'premium-set-403', path: '/papers/math-y7/math-y7-set-2', waitFor: 'Not included in your plan', asEntitled: true, paperStatus: 403 },
  { name: 'premium-set-fetching', path: '/papers/math-y7/math-y7-set-2', waitFor: 'Loading this set…', asEntitled: true, paperStatus: 'slow' },
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
          if (shot.seedWeakProgress) {
            await page.evaluate(() => {
              window.localStorage.setItem(
                'iblearn_progress',
                JSON.stringify({
                  version: 2,
                  userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
                  topicProgress: {
                    'math:math-yr7-calculations': {
                      topicId: 'math-yr7-calculations',
                      subjectId: 'math',
                      topicTitle: 'Written Calculations',
                      subjectTitle: 'Math',
                      attempts: [{ date: '2026-09-01T10:00:00.000Z', correctCount: 1, totalCount: 10 }],
                    },
                  },
                  examResults: [],
                  ladderProgress: {},
                  flashcardProgress: {},
                })
              );
            });
          }
          if (shot.failFiltered) {
            // Two-segment path = the id-filtered draw; the one-segment retry is left to the server.
            await page.route('**/api/content/public/mixed-review/*/*', (route) =>
              route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'no_questions' }),
              })
            );
          }
          if (shot.asEntitled) {
            // Forge the me() response (a capture-only stub, not a session): the shell only fetches the
            // paper once the CLIENT believes it is entitled, and the two cards under review are exactly
            // what an entitled client sees when the SERVER disagrees (401 expired session / 403 stale
            // tier). Routing me() avoids needing dummy-auth env in this capture server.
            await page.route('**/api/auth/me', async (route) => {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  user: {
                    userId: 'capture-user',
                    email: 'capture@example.com',
                    displayName: 'Capture',
                    role: 'student',
                    tier: 'premium',
                    childProfiles: [],
                  },
                  entitlements: ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'],
                }),
              });
            });
            await page.route('**/api/content/premium/**', async (route) => {
              if (shot.paperStatus === 'slow') {
                await new Promise((r) => setTimeout(r, 8000));
                await route.continue();
                return;
              }
              await route.fulfill({
                status: shot.paperStatus,
                contentType: 'application/json',
                body: JSON.stringify({ error: shot.paperStatus === 401 ? 'login_required' : 'not_entitled' }),
              });
            });
          }
          if (shot.delayAuthMe) {
            // Hold the entitlements response so the skeleton is on screen long enough to photograph.
            await page.route('**/api/auth/me', async (route) => {
              await new Promise((r) => setTimeout(r, 8000));
              await route.continue();
            });
          }
          await page.goto(`${BASE}${shot.path}`);
          const waiter = shot.waitForSelector
            ? page.locator(shot.waitForSelector).first()
            : shot.waitForLabel
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
