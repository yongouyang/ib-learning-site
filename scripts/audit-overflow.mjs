#!/usr/bin/env node
/**
 * Horizontal-overflow audit for the topic surfaces.
 *
 * WHY THIS EXISTS: a page-level horizontal scroll on a phone is invisible to every
 * content gate and to `tsc`, and it is a *layout* defect — the only way to see it is to
 * render the page at phone width and measure `documentElement.scrollWidth`. Found the
 * 2026-09-24 breadcrumb defect this way (the quiz/flashcards trail printed the whole
 * topic title as an unshrinkable linked crumb: an 878px document inside a 320px
 * viewport), plus two unrelated study-page ones it did NOT cause.
 *
 * It is deliberately a script over the BUILT EXPORT, not a dev server: dev-mode font
 * and CSS loading produced one measurement (a display-math block reported ~4119px wide)
 * that a production build does not reproduce. Run `npm run build:static` first.
 *
 * Usage:
 *   npm run audit:overflow                 # topics whose title is long enough to be at risk
 *   npm run audit:overflow -- --all        # every topic (the full 245-topic sweep)
 *   npm run audit:overflow -- --top=50     # the 50 longest titles
 *   npm run audit:overflow -- --width=320  # a narrower device
 *
 * Exit code 1 if any page overflows, so it can gate.
 */
import { spawn } from 'node:child_process';
import { existsSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const WIDTH = Number(arg('width', 375));
const PORT = Number(arg('port', 3235));
const TOP = arg('top') ? Number(arg('top')) : null;
const ALL = process.argv.includes('--all');
// Titles shorter than this have never overflowed a 320px trail; they are still swept
// by `--all`, this is only the default risk set so the common run stays quick.
const RISK_LENGTH = Number(arg('min', 38));

const OUT = path.resolve(process.cwd(), 'out');
if (!existsSync(OUT)) {
  console.error('audit:overflow — no out/ directory. Run `npm run build:static` first.');
  process.exit(1);
}

const topicsRoot = path.resolve(process.cwd(), 'src/content/data/topics');
const topics = [];
for (const subject of readdirSync(topicsRoot)) {
  const dir = path.join(topicsRoot, subject);
  if (!statSync(dir).isDirectory()) continue;
  for (const file of readdirSync(dir)) {
    if (file === 'order.json' || !file.endsWith('.json')) continue;
    const j = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    topics.push({ subject, id: j.id, title: j.title, len: j.title.length });
  }
}
const selected = ALL
  ? topics
  : TOP
    ? [...topics].sort((a, b) => b.len - a.len).slice(0, TOP)
    : topics.filter((t) => t.len >= RISK_LENGTH).sort((a, b) => b.len - a.len);

const PAGES = ['study', 'quiz', 'flashcards'];
const BASE = `http://localhost:${PORT}`;

// Log outside the repo: this is a throwaway server, not an artefact.
const SERVER_LOG = path.join(os.tmpdir(), 'audit-overflow-server.log');
const server = spawn('npx', ['tsx', 'scripts/serve-static.ts', '--port', String(PORT)], {
  stdio: ['ignore', openSync(SERVER_LOG, 'a'), openSync(SERVER_LOG, 'a')],
  detached: true,
});

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`serve-static did not answer on ${BASE} — see ${SERVER_LOG}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 812 } });
  const page = await context.newPage();
  const failures = [];
  let checked = 0;

  for (const t of selected) {
    for (const kind of PAGES) {
      const url = `${BASE}/subjects/${t.subject}/${t.id}/${kind}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('nav[aria-label="Breadcrumb"]', { timeout: 15000 });
      } catch (e) {
        failures.push({ url, reason: `load failed: ${e.message.split('\n')[0]}`, worst: null });
        continue;
      }
      const res = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1 && (!worst || r.right > worst.right)) {
            const cls = String(el.className);
            const kind = el.closest('nav[aria-label="Breadcrumb"]')
              ? 'breadcrumb'
              : el.closest('.katex, .katex-display, math, mjx-container')
                ? 'katex'
                : 'other';
            worst = {
              kind,
              tag: el.tagName.toLowerCase(),
              cls: cls.slice(0, 70),
              right: Math.round(r.right),
              text: (el.textContent ?? '').trim().slice(0, 40),
            };
          }
        }
        return { vw, doc: document.documentElement.scrollWidth, worst };
      });
      checked++;
      if (res.doc > res.vw + 1) {
        failures.push({ url, reason: `scrollWidth ${res.doc} > ${res.vw}`, worst: res.worst });
      }
    }
  }

  console.log(`checked ${checked} pages across ${selected.length} topics at ${WIDTH}px`);
  if (failures.length === 0) {
    console.log('PASS — no horizontal overflow');
  } else {
    const byKind = {};
    for (const f of failures) {
      const k = f.worst?.kind ?? 'load';
      byKind[k] = (byKind[k] ?? 0) + 1;
    }
    console.log(`FAIL — ${failures.length} overflowing page(s) by category: ${JSON.stringify(byKind)}`);
    for (const f of failures) {
      console.log(`  ${f.reason}\n    ${f.url}`);
      if (f.worst) {
        console.log(
          `    worst: [${f.worst.kind}] <${f.worst.tag} class="${f.worst.cls}"> right=${f.worst.right} "${f.worst.text}"`
        );
      }
    }
    process.exitCode = 1;
  }
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
