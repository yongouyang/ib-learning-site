#!/usr/bin/env node
/**
 * Targeted study-page capture: one topic, one note (matched by a PLAIN-TEXT
 * needle — the needle is matched against rendered text, so never include math
 * source in it), at phone widths in both themes. Exists because
 * capture-display-math-ux.mjs derives its own targets from the corpus and
 * captures only the FIRST needle per topic — a specific deeper note (the 2026-09-26
 * determinant re-break in math-dp-ai-matrices) needs a directed capture.
 *
 * Run:  node scripts/capture-study-notes.mjs <subject>/<topic> "<needle>" [--desktop]
 * Writes ux-screenshots/display-math/<topic>-note-<width>-<theme>.png (gitignored).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3298;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'display-math');
mkdirSync(OUT, { recursive: true });

const [target, needle, ...rest] = process.argv.slice(2);
if (!target || !needle) {
  console.error('usage: node scripts/capture-study-notes.mjs <subject>/<topic> "<needle>" [--desktop]');
  process.exit(1);
}
const withDesktop = rest.includes('--desktop');
const widths = withDesktop ? [375, 1280] : [375];

const server = spawn('npx', ['tsx', 'scripts/serve-static.ts', '--port', String(PORT)], {
  env: { ...process.env, AUTH_STORAGE: 'dummy', PROGRESS_STORAGE: 'dummy' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('serve-static did not come up');
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/`); // origin for localStorage
  for (const width of widths) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), theme);
      await page.goto(`${BASE}/subjects/${target}/study`, { waitUntil: 'load' });
      await page.waitForSelector('h1');
      await page.waitForTimeout(800);
      const card = page
        .locator('li:visible, p:visible, div:visible')
        .filter({ hasText: needle })
        .last();
      await card.scrollIntoViewIfNeeded({ timeout: 10000 });
      await page.waitForTimeout(300);
      const container = card.locator('xpath=ancestor::div[contains(@class,"card")][1]');
      const file = path.join(OUT, `${target.split('/')[1]}-note-${width}-${theme}.png`);
      await container.screenshot({ path: file });
      console.log('captured', file);
    }
  }
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
