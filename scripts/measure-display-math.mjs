#!/usr/bin/env node
/**
 * One-shot measurement: which .katex-display blocks on a study page are WIDER than
 * their scroll container at phone widths (i.e. clipped with only a scroll to reach
 * the rest). Reads the built export through serve-static (the same topology the
 * overflow audit uses). Not a gate — the answer feeds a per-formula fix decision.
 *
 * Run:  node scripts/measure-display-math.mjs [subject/topic ...] [--width=375]
 *       (default: the three topics the 2026-09-25 review flagged, at 375 + 320)
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3299;
const BASE = `http://localhost:${PORT}`;
const argWidth = process.argv.find((a) => a.startsWith('--width='));
const widths = argWidth ? [Number(argWidth.split('=')[1])] : [375, 320];
const ids = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
const targets = ids.length
  ? ids
  : ['physics/phys-simple-machines-1', 'math/math-pythagoras-myp', 'math/math-dp-ai-matrices'];

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
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const t of targets) {
      await page.goto(`${BASE}/subjects/${t}/study`, { waitUntil: 'load' });
      await page.waitForSelector('.katex-display', { timeout: 15000 }).catch(() => {});
      const rows = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.katex-display')).map((el) => {
          const host = el.parentElement;
          return {
            clipped: host ? host.scrollWidth > host.clientWidth + 1 : false,
            contentWidth: host?.scrollWidth ?? 0,
            containerWidth: host?.clientWidth ?? 0,
            preview: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
          };
        }),
      );
      const clipped = rows.filter((r) => r.clipped);
      console.log(`\n${t} @ ${width}px — ${rows.length} display block(s), ${clipped.length} clipped:`);
      for (const c of clipped) {
        console.log(`  ${c.contentWidth}px in ${c.containerWidth}px  "${c.preview}"`);
      }
    }
  }
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
