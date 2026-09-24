#!/usr/bin/env tsx
/**
 * Internal-linking audit for the static export (docs/seo-technical-plan.md, §2.E).
 *
 * Search Console answers "what do people search for"; it cannot answer "can a crawler
 * reach this page and in how many clicks", which is what a thin-hub problem actually is.
 * This script reads the built site — run `npm run build:static` first — and reports:
 *
 *   - the click depth of every indexable page from `/` (BFS over the rendered <a href>),
 *   - indexable pages with no inbound internal link at all (orphans),
 *   - the least-linked hubs and their outbound counts (thin hubs),
 *   - how many indexable pages are only reachable through the sitemap,
 *   - anchor-text variety for the most-linked targets (repeated identical anchors).
 *
 * It is deliberately a script over `out/`, not a source scan: the links that matter are the
 * ones Next actually emits (cards built from the registry, breadcrumbs, footer), and a
 * grep of .tsx would miss every generated one.
 *
 * Usage: npx tsx scripts/audit-internal-links.ts [--top=20] [--depth=3]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const OUT = 'out';
const SITEMAP_DIR = 'public/sitemap';

if (!existsSync(OUT)) {
  console.error(`audit:links — no ${OUT}/ directory. Run \`npm run build:static\` first.`);
  process.exit(1);
}

const topN = Number(process.argv.find((a) => a.startsWith('--top='))?.slice(6) ?? 20);
const maxDepth = Number(process.argv.find((a) => a.startsWith('--depth='))?.slice(8) ?? 3);

/** Every prerendered page: file path -> URL path ("/" for the homepage). */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function toUrl(file: string): string {
  const rel = '/' + relative(OUT, file).replace(/\\/g, '/');
  if (rel === '/index.html') return '/';
  return rel.replace(/\.html$/, '').replace(/\/index$/, '');
}

const pages = walk(OUT).map(toUrl);
const pageSet = new Set(pages);

interface Edge {
  from: string;
  to: string;
  anchor: string;
}

const edges: Edge[] = [];
const anchorCounts = new Map<string, Map<string, number>>();

for (const url of pages) {
  const file = url === '/' ? join(OUT, 'index.html') : join(OUT, `${url}.html`);
  const html = readFileSync(existsSync(file) ? file : join(OUT, `${url}/index.html`), 'utf8');
  const linkRe = /<a\b[^>]*href="([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRe)) {
    let href = match[1];
    if (!href.startsWith('/') || href.startsWith('//')) {
      if (!href.startsWith('http')) continue;
      // A self-referencing absolute URL counts as an internal link.
      try {
        const u = new URL(href);
        href = u.pathname;
      } catch {
        continue;
      }
    }
    if (href.startsWith('/api/') || href.startsWith('/_next/')) continue;
    const target = href.length > 1 ? href.replace(/\/$/, '') : href;
    if (!pageSet.has(target)) continue;
    const anchor = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    edges.push({ from: url, to: target, anchor });
    if (!anchorCounts.has(target)) anchorCounts.set(target, new Map());
    const counts = anchorCounts.get(target)!;
    counts.set(anchor, (counts.get(anchor) ?? 0) + 1);
  }
}

const inbound = new Map<string, number>(pages.map((p) => [p, 0]));
const outbound = new Map<string, number>(pages.map((p) => [p, 0]));
const adjacency = new Map<string, Set<string>>(pages.map((p) => [p, new Set()]));
for (const { from, to } of edges) {
  inbound.set(to, (inbound.get(to) ?? 0) + 1);
  outbound.set(from, (outbound.get(from) ?? 0) + 1);
  adjacency.get(from)!.add(to);
}

// Click depth from the homepage.
const depth = new Map<string, number>([['/', 0]]);
const queue = ['/'];
while (queue.length > 0) {
  const current = queue.shift()!;
  const d = depth.get(current)!;
  for (const next of adjacency.get(current) ?? []) {
    if (!depth.has(next)) {
      depth.set(next, d + 1);
      queue.push(next);
    }
  }
}

// The indexable set comes from the sitemaps, not from the file system — a noindex page in
// out/ is intentionally not in there.
const sitemapFiles = existsSync(SITEMAP_DIR)
  ? readdirSync(SITEMAP_DIR).filter((f) => f.endsWith('.xml'))
  : [];
const indexable = new Set<string>();
for (const name of sitemapFiles) {
  const xml = readFileSync(join(SITEMAP_DIR, name), 'utf8');
  for (const m of xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)) {
    const url = m[1].length > 1 ? m[1].replace(/\/$/, '') : m[1];
    indexable.add(url);
  }
}

const pct = (n: number, d: number): string => `${((n / d) * 100).toFixed(1)}%`;
const depthHistogram = new Map<number, number>();
for (const url of indexable) {
  const d = depth.get(url) ?? -1; // -1 = never linked from a page
  depthHistogram.set(d, (depthHistogram.get(d) ?? 0) + 1);
}

console.log(`audit:links — ${pages.length} prerendered pages, ${edges.length} internal links`);
console.log(`indexable (from ${sitemapFiles.length} sitemaps): ${indexable.size}`);
if (indexable.size === 0) {
  console.error('audit:links — no sitemap URLs found. Run `npm run generate:sitemaps` first.');
  process.exit(1);
}

console.log('\n== click depth from / (indexable pages only) ==');
for (const d of [...depthHistogram.keys()].sort((a, b) => a - b)) {
  const label = d === -1 ? 'unlinked (no page links to it)' : `${d} click${d === 1 ? '' : 's'}`;
  console.log(`  ${label.padEnd(30)} ${String(depthHistogram.get(d)).padStart(4)}  ${pct(depthHistogram.get(d)!, indexable.size)}`);
}

const unlinked = [...indexable].filter((u) => !depth.has(u));
const tooDeep = [...indexable].filter((u) => (depth.get(u) ?? 0) > maxDepth);

console.log(`\n== hubs with the fewest inbound internal links (top ${topN}) ==`);
const hubs = [...indexable]
  .filter((u) => outbound.get(u)! >= 8) // a hub links out; a leaf does not
  .sort((a, b) => inbound.get(a)! - inbound.get(b)!)
  .slice(0, topN);
for (const hub of hubs) {
  const anchors = anchorCounts.get(hub) ?? new Map();
  const distinct = anchors.size;
  console.log(
    `  in ${String(inbound.get(hub)).padStart(4)}  out ${String(outbound.get(hub)).padStart(4)}  distinct anchors ${String(distinct).padStart(2)}  ${hub}`
  );
}

console.log(`\n== repeated anchors on the most-linked targets (top ${topN}) ==`);
const mostLinked = [...indexable].sort((a, b) => inbound.get(b)! - inbound.get(a)!).slice(0, topN);
for (const target of mostLinked) {
  const anchors = [...(anchorCounts.get(target) ?? new Map())].sort((a, b) => b[1] - a[1]);
  const [topAnchor, count] = anchors[0] ?? ['—', 0];
  console.log(
    `  ${String(inbound.get(target)).padStart(4)} inbound, ${anchors.length} distinct — most used ${count}x "${topAnchor}"  ${target}`
  );
}

if (unlinked.length > 0) {
  console.log(`\n== indexable pages no page links to (${unlinked.length}) ==`);
  for (const url of unlinked.slice(0, topN)) console.log(`  ${url}${unlinked.length > topN ? '' : ''}`);
}
if (tooDeep.length > 0) {
  console.log(`\n== indexable pages deeper than ${maxDepth} clicks (${tooDeep.length}) ==`);
  for (const url of tooDeep.slice(0, topN)) console.log(`  ${depth.get(url)}  ${url}`);
}

const neverLinked = unlinked.length;
console.log(
  `\nsummary: ${indexable.size - neverLinked - tooDeep.length}/${indexable.size} indexable pages within ${maxDepth} clicks; ` +
    `${neverLinked} unlinked; ${tooDeep.length} deeper than ${maxDepth}`
);
