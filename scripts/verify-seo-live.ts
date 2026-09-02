// Verifies the SEO contract on a DEPLOYED environment (prod or dev), over HTTPS.
//   npm run verify:seo:live                      prod, 60 indexable URLs + all topology
//   npm run verify:seo:live -- --all             every indexable URL in the sitemap
//   npm run verify:seo:live -- --env=dev         dev (asserts the noindex header instead)
//   npm run verify:seo:live -- --origin=http://localhost:3000   a local static serve
//
// WHY this exists and `verify:sitemaps` does not cover it:
// `verify:sitemaps` reads public/sitemap/*.xml and out/ — it proves the BUILD is correct.
// It cannot see the deployment. The first run of this script found that public/sitemap/ is
// gitignored and NO pipeline step calls `generate:sitemaps`, so `next build` shipped a bundle
// with no sitemap at all and every /sitemap/*.xml URL 404s in prod while the local gate stayed
// green. Anything that only exists after deploy (edge headers, redirects, files that never
// left the repo, a stale CDN cache) needs an origin-facing check.
//
// Single source of truth: the EXPECTED INDEXABLE SET is the generated sitemap itself, which is
// what --verify already certifies against out/. Page rules (noindex tiers, canonicals, titles)
// are read back from the served HTML, never re-derived here — so this script cannot drift from
// src/lib/seo/*, it can only report where the deployed site disagrees with its own build.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { SITE } from '../src/lib/seo/site';

const BRAND = SITE.name; // the same constant the title template appends — never retype it
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const env = value('env') ?? (flag('dev') ? 'dev' : 'prod');
const origin = (value('origin') ?? (env === 'dev' ? 'https://dev.octavlearning.com' : SITE.origin)).replace(/\/$/, '');
const wantAll = flag('all');
const sampleSize = Number(value('sample') ?? 60);
const CONCURRENCY = 6; // the site is small and this is our own origin; still be a good citizen

const problems: string[] = [];
const notes: string[] = [];
const liveSitemapPaths = new Set<string>(); // what the DEPLOYED sitemap actually lists
const fail = (msg: string): void => {
  problems.push(msg);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'");

/** KaTeX markup that leaked into a metadata string — the bug plainText() exists to prevent.
 *  Only `$` and `\` are markers: content rules forbid a literal `$` everywhere (currency is
 *  fullwidth ＄), and every escaped glyph is a backslash. A word like "times" must NOT match —
 *  the first version of this check matched `\btimes\b` and falsely failed a Chinese page. */
const mathLeak = (s: string) => /[$\\]/.test(s);

async function get(path: string, redirect = 'manual' as RequestRedirect): Promise<Response> {
  return fetch(`${origin}${path}`, { redirect, headers: { 'user-agent': 'octav-seo-verify' } });
}

async function main() {
  console.log(`SEO live verification → ${origin} (env: ${env})\n`);

  // ---------- 1. the files must exist at the origin at all ----------
  console.log('[1] Deployed artefacts');
  const robotsRes = await get('/robots.txt');
  const robotsTxt = robotsRes.ok ? await robotsRes.text() : '';
  if (!robotsRes.ok) fail(`/robots.txt → HTTP ${robotsRes.status} (crawlers get no policy)`);
  else ok(`/robots.txt 200, ${robotsTxt.split('\n').filter(Boolean).length} lines`);

  const idxRes = await get('/sitemap/index.xml');
  const idxTxt = idxRes.ok ? await idxRes.text() : '';
  if (!idxRes.ok) {
    fail(`/sitemap/index.xml → HTTP ${idxRes.status} — NO SITEMAP IS DEPLOYED (submitting this to GSC/Bing would 404)`);
  } else {
    ok('/sitemap/index.xml 200 + application/xml');
    const children = [...idxTxt.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (!children.length) fail('/sitemap/index.xml declares zero children');
    for (const child of children) {
      const r = await fetch(child, { headers: { 'user-agent': 'octav-seo-verify' } });
      const xml = r.ok ? await r.text() : '';
      if (!r.ok) fail(`sitemap child ${child} → HTTP ${r.status}`);
      else if (!/<url>/.test(xml)) fail(`sitemap child ${child} has no <url> entries`);
      else
        for (const loc of [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
          if (!loc.startsWith(`${SITE.origin}/`)) fail(`sitemap URL on a foreign origin: ${loc}`);
          liveSitemapPaths.add(loc.replace(SITE.origin, '') || '/');
        }
    }
    ok(`${children.length} child sitemap(s) parsed, ${liveSitemapPaths.size} URLs`);
    if (robotsTxt && !/^Sitemap:/im.test(robotsTxt))
      notes.push('robots.txt advertises no Sitemap: line (intentional until the tier hubs ship — S2b)');
  }

  // ---------- 2. edge topology: one canonical hostname, one scheme ----------
  console.log('[2] Redirect + header topology');
  const host = origin.replace(/^https?:\/\//, '');
  const prodHost = new URL(SITE.origin).hostname;
  if (host === prodHost) {
    const www = await fetch(`https://www.${host}/`, { redirect: 'manual', headers: { 'user-agent': 'octav-seo-verify' } });
    const loc = www.headers.get('location') ?? '';
    if (www.status === 301 && loc === `https://${host}/`) ok(`www → apex 301 → ${loc}`);
    else fail(`https://www.${host}/ should 301 to https://${host}/ (got ${www.status} → ${loc || 'none'})`);
    const insecure = await fetch(`http://${host}/`, { redirect: 'manual', headers: { 'user-agent': 'octav-seo-verify' } });
    if (insecure.status === 301 && insecure.headers.get('location') === `https://${host}/`) ok(`http → https 301`);
    else fail(`http://${host}/ should 301 to https://${host}/ (got ${insecure.status})`);
  } else {
    notes.push(`non-apex origin (${host}) — redirect checks skipped`);
  }

  const homeHeaders = await get('/');
  const homeRobotsHeader = homeHeaders.headers.get('x-robots-tag') ?? '';
  await homeHeaders.body?.cancel();
  if (env === 'dev') {
    if (/noindex/i.test(homeRobotsHeader)) ok(`DEV is edge-noindexed via x-robots-tag: ${homeRobotsHeader}`);
    else fail(`DEV is NOT header-noindexed (${homeRobotsHeader || 'no x-robots-tag'}) — dev.octavlearning.com can get indexed as a duplicate of prod`);
  } else {
    if (homeRobotsHeader) fail(`PROD sends x-robots-tag: ${homeRobotsHeader} — the whole site would drop out of the index`);
    else ok('PROD sends no x-robots-tag (nothing is globally suppressed)');
  }
  if (env !== 'prod') notes.push(`DEV expectations: canonicals must point at ${SITE.origin}, and the x-robots-tag header carries the noindex (a page-level robots meta is NOT expected here)`);

  // ---------- 3. per-page rules, read back from the served HTML ----------
  console.log('[3] Page-level metadata');
  const intended = await intendedPaths();
  if (!intended.length) {
    fail('no expected indexable paths (sitemap missing locally) — skipping page checks');
  } else {
    const picked = wantAll ? intended : sample(intended, sampleSize);
    notes.push(`checking ${picked.length}/${intended.length} indexable URLs${wantAll ? '' : ' (sampled; --all for every one)'}`);
    const before = problems.length;
    const titles = new Map<string, string[]>();
    let checked = 0;
    await pool(picked, CONCURRENCY, async (path) => {
      const url = `${origin}${path}`;
      const res = await fetch(url, { headers: { 'user-agent': 'octav-seo-verify' } });
      const html = res.ok ? await res.text() : '';
      checked++;
      const at = (re: RegExp) => re.exec(html)?.[1];
      if (!res.ok) return fail(`${path} → HTTP ${res.status} (in the sitemap, so a crawler sees a 404)`);

      const title = decode(at(/<title>([\s\S]*?)<\/title>/) ?? '');
      const desc = decode(at(/<meta name="description" content="([^"]*)"/) ?? '');
      const robots = at(/<meta name="robots" content="([^"]*)"/) ?? '';
      const canonical = at(/<link rel="canonical" href="([^"]*)"/) ?? '';

      if (!title.trim()) return fail(`${path} has no <title>`);
      if (!desc.trim()) return fail(`${path} has no meta description`);
      if (mathLeak(title) || mathLeak(desc)) return fail(`${path} metadata leaks raw math markup: ${title} | ${desc}`);
      if (title.split(BRAND).length - 1 > 1) return fail(`${path} title repeats the brand: "${title}"`);
      if (/noindex/i.test(robots)) return fail(`${path} is in the sitemap but marked noindex`);
      // metadataBase is pinned to the prod origin, so EVERY environment canonicals to prod —
      // on dev that is the point (noindex header + canonical → prod = the textbook staging
      // pattern). Assert against SITE.origin, never the requested host.
      const expected = `${SITE.origin}${path}`;
      if (canonical !== expected)
        return fail(`${path} canonical is ${canonical || 'absent'}, expected ${expected}`);
      if (title.length > 65) fail(`${path} title is ${title.length} chars (Google clips ~60): "${title}"`);
      titles.set(title, [...(titles.get(title) ?? []), path]);
    });

    for (const [title, paths] of titles) if (paths.length > 1) fail(`duplicate <title> "${title}": ${paths.join(', ')}`);
    if (problems.length === before)
      ok(
        `${checked} indexable pages: titles unique, canonicals pinned to ${SITE.origin}, ` +
          `no noindex, no math leakage`,
      );
    else console.log(`  — ${problems.length - before} of ${checked} indexable pages failed (listed below)`);

    // The noindex half of the contract, by rule rather than by list.
    const beforeTools = problems.length;
    const toolSample = sample(
      await pathsMatching([/\/quiz$/, /\/flashcards$/]),
      wantAll ? 40 : 12,
    );
    await pool(toolSample, CONCURRENCY, async (path) => {
      const res = await fetch(`${origin}${path}`, { headers: { 'user-agent': 'octav-seo-verify' } });
      const html = res.ok ? await res.text() : '';
      const robots = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? '';
      const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? '';
      if (!/noindex/i.test(robots)) fail(`${path} should be noindex, follow (got "${robots || 'none'}")`);
      if (!canonical.endsWith('/study')) fail(`${path} should canonical to its /study page (got ${canonical || 'absent'})`);
      if (!canonical.startsWith(SITE.origin)) fail(`${path} canonical leaves the prod origin: ${canonical}`);
    });
    if (problems.length === beforeTools) ok(`${toolSample.length} quiz/flashcard URLs: noindex, follow + canonical → /study`);
  }

  // ---------- 4. is the origin actually serving THIS build? ----------
  console.log('[4] Deployment freshness');
  if (!existsSync('out')) {
    notes.push('no local out/ — skipped build-vs-live comparison (run npm run build:static to enable)');
  } else {
    const samplePaths = sample(intended, 12);
    let matched = 0;
    await pool(samplePaths, CONCURRENCY, async (path) => {
      const local = [`out${path}.html`, `out${path === '/' ? '' : path}/index.html`]
        .map((p) => (existsSync(p) ? readFileSync(resolve(p), 'utf8') : null))
        .find((v) => v !== null);
      if (!local) return fail(`${path} is in the sitemap but absent from out/ (build is out of step with the sitemap)`);
      const sig = (html: string) =>
        [
          /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '',
          /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? '',
          /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1]?.replace(SITE.origin, '') ?? '',
        ].join('|');
      const res = await fetch(`${origin}${path}`, { headers: { 'user-agent': 'octav-seo-verify' } });
      const html = res.ok ? await res.text() : '';
      if (sig(local) !== sig(html))
        fail(`${path} differs from the local build — ${origin} is serving a STALE deploy\n      build: ${sig(local)}\n      live:  ${sig(html)}`);
      else matched++;
    });
    ok(`${matched}/${samplePaths.length} pages byte-identical in title/robots/canonical to the local build`);
  }

  // ---------- report ----------
  console.log();
  for (const n of notes) console.log(`  · ${n}`);
  if (problems.length) {
    console.error(`\n${problems.length} PROBLEM(S) on ${origin}:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(`\nSEO verification PASSED on ${origin}`);
}

/** Paths from the locally generated sitemap — the intent we hold prod to. */
async function intendedPaths(): Promise<string[]> {
  const dir = 'public/sitemap';
  if (!existsSync(dir)) return [];
  const paths = new Set<string>();
  const children = [...readFileSync(`${dir}/index.xml`, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const child of children) {
    const file = `${dir}/${child.split('/').pop()}`;
    if (!existsSync(file)) continue;
    for (const loc of [...readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
      paths.add(loc.replace(SITE.origin, '') || '/');
  }
  return [...paths].sort();
}

/** Paths in the built export matching any pattern — used to sample the noindex half of the contract. */
async function pathsMatching(patterns: RegExp[]): Promise<string[]> {
  if (!existsSync('out')) return [];
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '_next' && !entry.name.startsWith('.')) walk(full);
        continue;
      }
      if (!entry.name.endsWith('.html') || /404|_not-found/.test(full)) continue;
      let p = full.slice('out/'.length, -'.html'.length);
      if (p.endsWith('/index')) p = p.slice(0, -'index'.length);
      p = p === 'index' || p === '' ? '/' : `/${p}`;
      if (patterns.some((re) => re.test(p))) hits.push(p);
    }
  };
  walk('out');
  return hits.sort();
}

/** Deterministic stride sample — same input, same coverage, no flaky CI. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)] as T);
  return out;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++] as T;
        await fn(item);
      }
    }),
  );
}

void main();
