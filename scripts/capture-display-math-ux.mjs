#!/usr/bin/env node
/**
 * Regenerates the UX-review screenshots for the display-math fix (2026-09-25).
 *
 * WHY: `StudyNoteBody` only recognised a display block when it STARTED the line, so
 * any `$$...$$` sitting inside a sentence or list item fell through to the inline
 * splitter, which splits on single `$`. Students saw a literal "$ … $" wrapper
 * (64 note lines across 14 topics) and two of those pages scrolled horizontally.
 * The affected topics are DERIVED FROM THE CORPUS, not hard-coded, so the sheet
 * always covers what the renderer actually has to handle.
 *
 * Only pages that CHANGED are captured (study pages carrying mid-line display math).
 * Element screenshots of the note card, after the framer-motion cards finish
 * animating (they start at opacity:0 — screenshotting too early yields a blank PNG).
 *
 * Self-contained: starts a throwaway Next dev server with the e2e dummy wiring.
 * Writes to ux-screenshots/display-math/ (gitignored).
 *
 * Run:  node scripts/capture-display-math-ux.mjs [--all-widths]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 3238;
const OUT = path.resolve(process.cwd(), 'ux-screenshots', 'display-math');
const SERVER_LOG = path.join(OUT, 'server.log');
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

/** Topics whose notes embed display math mid-line, with a distinctive needle each. */
function affected() {
  const root = path.resolve(process.cwd(), 'src/content/data/topics');
  const found = [];
  for (const subject of readdirSync(root)) {
    const dir = path.join(root, subject);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (file === 'order.json' || !file.endsWith('.json')) continue;
      const j = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
      for (const note of j.notes ?? []) {
        for (const line of String(note.body ?? '').split('\n')) {
          const t = line.trim();
          if (!t.includes('$$')) continue;
          // A pure display block (the whole line IS the block) was never broken, so it
          // is not a capture target; everything else with $$ on the line changed.
          if (t.startsWith('$$') && t.endsWith('$$') && t.match(/\$\$/g)?.length === 2) continue;
          const match = t.match(/^(.*?)\$\$.+?\$\$/s);
          if (!match) continue;
          // Needle = PLAIN prose from this line — never include `$...$`, because the needle is
          // matched against RENDERED text, where math has become KaTeX and the source no longer
          // appears. A needle containing math silently matches nothing (that dropped three topics
          // from the first sheet on 2026-09-25).
          const plain = (s) => s.replace(/^[•\-]\s*/, '').split('$')[0].replace(/[*_`]/g, '').trim();
          let needle = plain(match[1]);
          if (needle.length < 12) needle = plain(t.replace(/\$\$.+?\$\$/gs, ' '));
          needle = needle.slice(-45);
          if (needle.length >= 12) found.push({ subject, id: j.id, needle, line: t.slice(0, 70) });
        }
      }
    }
  }
  return found;
}

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

const targets = affected();
console.log(`${targets.length} affected note line(s) across ${new Set(targets.map((t) => t.id)).size} topic(s)`);

// Every affected topic on mobile (the width that overflowed) in both themes; the
// first few also on desktop, where only the layout can regress.
const seen = new Set();
const shots = [];
for (const t of targets) {
  if (seen.has(t.id)) continue;
  seen.add(t.id);
  const desktop = shots.filter((s) => s.viewport === 'desktop').length < 8;
  for (const theme of ['light', 'dark']) {
    shots.push({ ...t, theme, width: 375, height: 900, viewport: 'mobile' });
    if (desktop) shots.push({ ...t, theme, width: 1280, height: 900, viewport: 'desktop' });
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

let captured = 0;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE); // establish an origin for localStorage

  for (const s of shots) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.evaluate((t) => localStorage.setItem('iblearn-theme', t), s.theme);
    await page.goto(`${BASE}/subjects/${s.subject}/${s.id}/study`);
    await page.waitForSelector('h1');
    await page.waitForTimeout(1500); // framer-motion cards start at opacity:0
    // `:visible` matters: in dev, React StrictMode briefly renders the tree twice, so a
    // plain `.first()` can bind to a detached duplicate and then time out on scroll —
    // which silently dropped half the sheet on the first run (2026-09-25).
    const card = page.locator('li:visible, p:visible').filter({ hasText: s.needle }).first();
    try {
      await card.scrollIntoViewIfNeeded({ timeout: 10000 });
      await page.waitForTimeout(300);
      const container = card.locator('xpath=ancestor::div[contains(@class,"card")][1]');
      // A needle that still finds nothing must not drop the topic from the sheet: fall back
      // to the whole page so the reviewer always sees SOMETHING for it.
      const box = await container.boundingBox({ timeout: 5000 }).catch(() => null);
      await (box ? container : page).screenshot({
        path: path.join(OUT, `${s.id}-${s.viewport}-${s.theme}.png`),
      });
      captured++;
      console.log(`captured ${s.id}-${s.viewport}-${s.theme}.png  (needle: "${s.needle}")`, box ? '' : ' [page fallback]');
    } catch (err) {
      console.warn(`skipped ${s.id} (${s.viewport}/${s.theme}): ${err.message.split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log(`${captured}/${shots.length} screenshots written to ${OUT}`);
} catch (err) {
  console.error('Failed to capture screenshots:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
