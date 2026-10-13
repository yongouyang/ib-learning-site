#!/usr/bin/env node
/**
 * Wave 3c (IGCSE Biology 0610) spot-UX pass: sweeps every bio-igcse topic's
 * study/quiz/flashcards surfaces at 375px for KaTeX errors and page-level
 * horizontal overflow, then captures the four waiver spot shots into
 * ux-screenshots/content/wave3c/ (gitignored). Runs against the BUILT EXPORT
 * (npm run build:static first), like audit:overflow.
 *
 * Run:  node scripts/capture-wave3c-ux.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3234;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'content', 'wave3c');
mkdirSync(OUT, { recursive: true });
const SERVER_LOG = path.join(OUT, 'server.log');

const TOPICS = [
  'bio-igcse-classification', 'bio-igcse-cells', 'bio-igcse-diffusion-osmosis',
  'bio-igcse-molecules-enzymes', 'bio-igcse-photosynthesis', 'bio-igcse-human-nutrition',
  'bio-igcse-plant-transport', 'bio-igcse-plant-physiology', 'bio-igcse-heart-circulation',
  'bio-igcse-coordination', 'bio-igcse-homeostasis-extended', 'bio-igcse-inheritance',
  'bio-igcse-genetics-extended', 'bio-igcse-circulation-extended',
];
const SURFACES = ['study', 'quiz', 'flashcards'];

const SPOTS = [
  { url: '/igcse/biology', name: 'igcse-biology-hub-mobile-light', w: 375, h: 812, dark: false },
  { url: '/subjects/biology/bio-igcse-cells/study', name: 'study-cells-mobile-light', w: 375, h: 812, dark: false },
  { url: '/subjects/biology/bio-igcse-homeostasis-extended/study', name: 'study-homeostasis-extended-desktop-dark', w: 1280, h: 800, dark: true },
  { url: '/subjects/biology/bio-igcse-inheritance/quiz', name: 'quiz-inheritance-mobile-light', w: 375, h: 812, dark: false },
];

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('serve-static did not become ready in time');
}

const server = spawn('npx', ['tsx', 'scripts/serve-static.ts', '--port', String(PORT)], {
  stdio: ['ignore', openSync(SERVER_LOG, 'w'), openSync(SERVER_LOG, 'a')],
});

let failures = 0;
try {
  await waitForServer();
  const browser = await chromium.launch();

  // Sweep: KaTeX errors + page overflow on every surface of every new topic.
  const sweepPage = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  for (const topic of TOPICS) {
    for (const surface of SURFACES) {
      const url = `${BASE}/subjects/biology/${topic}/${surface}`;
      await sweepPage.goto(url, { waitUntil: 'domcontentloaded' });
      await sweepPage.waitForTimeout(600);
      const katexErrors = await sweepPage.locator('.katex-error').count();
      const overflow = await sweepPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (katexErrors > 0 || overflow > 0) {
        failures++;
        console.log(`FAIL ${topic}/${surface}: katex-errors=${katexErrors} overflow=${overflow}px`);
      }
    }
  }
  console.log(`sweep: ${TOPICS.length * SURFACES.length} pages checked, ${failures} failure(s)`);
  await sweepPage.close();

  // Spot shots (light/dark, mobile/desktop).
  for (const spot of SPOTS) {
    const ctx = await browser.newContext({
      viewport: { width: spot.w, height: spot.h },
      colorScheme: spot.dark ? 'dark' : 'light',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${spot.url}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${spot.name}.png`) });
    console.log('shot', spot.name);
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
process.exit(failures ? 1 : 0);
