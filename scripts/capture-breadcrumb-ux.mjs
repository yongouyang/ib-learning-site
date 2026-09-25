#!/usr/bin/env node
/**
 * Regenerates the UX-review screenshots for the breadcrumb surfaces changed by
 * the 2026-09-24 overflow fix (docs/UX_GUIDELINES.md standing review pass).
 *
 * Why these pages: the quiz/flashcards trails print the WHOLE topic title as a
 * mid-trail linked crumb, so the crumb's width is a function of the corpus. The
 * longest title is derived from the topic JSONs rather than hard-coded — a
 * longer title added later is the one that gets a screenshot. A short-title
 * topic is included as the control (it should be visually unchanged: no
 * ellipsis, no cap in play).
 *
 * Self-contained: starts a throwaway Next dev server with the e2e dummy wiring.
 * Writes to ux-screenshots/breadcrumb/ (gitignored).
 *
 * Run:  node scripts/capture-breadcrumb-ux.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3234;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'breadcrumb');
const SERVER_LOG = path.join(OUT, 'server.log');
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

/** Longest + shortest title in the corpus, as {subject, id, title}. */
function pickTopics() {
  const root = path.resolve(process.cwd(), 'src/content/data/topics');
  const all = readdirSync(root).flatMap((subject) => {
    const dir = path.join(root, subject);
    if (!statSync(dir).isDirectory()) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json') && f !== 'order.json')
      .map((f) => {
        const t = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
        return { subject, id: t.id, title: t.title };
      });
  });
  const sorted = all.sort((a, b) => b.title.length - a.title.length);
  return { longest: sorted[0], control: sorted[sorted.length - 1] };
}

// e2e dummy wiring (mirrors playwright.config.ts) — these pages are public, but
// the quiz route reads progress state, which must not touch a real backend.
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

const { longest, control } = pickTopics();
console.log(`longest title (${longest.title.length} chars): ${longest.id}`);
console.log(`control title (${control.title.length} chars): ${control.id}`);

const PAGES = [
  { page: `/subjects/${longest.subject}/${longest.id}/quiz`, tag: 'long-quiz' },
  { page: `/subjects/${longest.subject}/${longest.id}/flashcards`, tag: 'long-flashcards' },
  { page: `/subjects/${longest.subject}/${longest.id}/study`, tag: 'long-study' },
  { page: `/subjects/${control.subject}/${control.id}/quiz`, tag: 'control-quiz' },
  { page: `/subjects/${control.subject}/${control.id}/flashcards`, tag: 'control-flashcards' },
];

const SHOTS = [];
for (const p of PAGES) {
  for (const theme of ['light', 'dark']) {
    for (const vp of [{ w: 375, h: 812, name: 'mobile' }, { w: 1280, h: 800, name: 'desktop' }]) {
      SHOTS.push({ file: `${p.tag}-${vp.name}-${theme}.png`, viewport: { width: vp.w, height: vp.h }, theme, page: p.page });
    }
  }
}

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
  // Establish an origin before the loop: localStorage on about:blank is opaque.
  await page.goto(BASE);

  for (const s of SHOTS) {
    await page.setViewportSize(s.viewport);
    await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), s.theme);
    await page.goto(`${BASE}${s.page}`);
    await page.waitForSelector('nav[aria-label="Breadcrumb"]', { state: 'attached' });
    await page.waitForTimeout(400);
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
