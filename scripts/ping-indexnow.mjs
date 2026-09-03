#!/usr/bin/env node
// Ping IndexNow (Bing / Yandex / Naver / Seznam) after a deploy so the child
// sitemaps get re-ingested immediately instead of waiting for a crawl.
// Plan: docs/seo-technical-plan.md §4.4 item 4.
//
// Usage: node scripts/ping-indexnow.mjs [--origin=https://octavlearning.com]
//   INDEXNOW_KEY   32-hex key; the verification file must be reachable at
//                  <origin>/<INDEXNOW_KEY>.txt (CI writes it into out/ before
//                  the s3 sync). Unset → graceful no-op (exit 0) so the step
//                  can be unconditional in CI.
//
// The sitemap child <loc>s are absolute PROD urls by design, so we remap them
// onto --origin (the same trick verify:seo:live uses for the dev gate).

import { readFileSync } from 'node:fs';

const originArg = process.argv.find((a) => a.startsWith('--origin='));
const origin = (originArg ? originArg.split('=')[1] : 'https://octavlearning.com').replace(/\/$/, '');
const host = new URL(origin).host;

const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.log('indexnow: INDEXNOW_KEY unset — skipping (step is a no-op until the secret exists)');
  process.exit(0);
}
if (!/^[0-9a-f]{32}$/.test(key)) {
  console.error('indexnow: INDEXNOW_KEY must be 32 lowercase hex chars');
  process.exit(1);
}

const index = readFileSync('public/sitemap/index.xml', 'utf8');
const urls = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => {
  const loc = m[1].trim();
  const path = new URL(loc).pathname;
  return `${origin}${path}`;
});
if (urls.length === 0) {
  console.error('indexnow: no <loc> entries found in public/sitemap/index.xml');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${origin}/${key}.txt`,
    urlList: urls,
  }),
});
// 200 = processed, 202 = accepted for later processing. Anything else is a
// real failure (403 = key file unreachable, 422 = bad payload) and must go red.
console.log(`indexnow: HTTP ${res.status} — pinged ${urls.length} child sitemap(s) for ${host}`);
if (res.status !== 200 && res.status !== 202) {
  console.error(`indexnow: unexpected status ${res.status}: ${await res.text()}`);
  process.exit(1);
}
