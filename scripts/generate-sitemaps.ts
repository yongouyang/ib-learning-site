// Emits a sitemap index + curriculum-split urlsets into public/sitemap/.
//   npm run generate:sitemaps                    write (before `next build`)
//   npm run check:sitemaps                       fail if the committed output is stale
//   npm run verify:sitemaps                      after build:static, fail on any URL that is
//                                                not a prerendered page in out/
//
// Why not app/sitemap.ts: content files carry no date field, so the only truthful <lastmod> is
// the git commit date (fs/git are unavailable inside a metadata route, which would stamp the build
// clock and make every URL look new each deploy); we need stable semantic child names
// (/sitemap/ks3.xml) that survive `output: 'export'`; and empty tiers must be skipped (IGCSE has
// zero topics today).
//
// Single source of truth: tiers = src/lib/seo/curriculum.ts, course groupings = src/lib/courses.ts,
// free/locked split = src/lib/entitlements/exam-access.ts. Never fork those lists here.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import { getAllPapers, getSubjects } from '../src/content/registry';
import { COURSES } from '../src/lib/courses';
import { FREE_LADDER_LEVELS, isFreePaperSet } from '../src/lib/entitlements/exam-access';
import { SITE } from '../src/lib/seo/site';
import { STUDY_PATH, TIERS, tierOfTopic, type TierKey } from '../src/lib/seo/curriculum';
import { alternatesFor } from '../src/lib/seo/hreflang';

const OUT_DIR = 'public/sitemap';
const GOOGLE_URL_LIMIT = 45_000; // spec limit 50 000; chunk early
const MODE = process.argv.includes('--check') ? 'check' : process.argv.includes('--verify') ? 'verify' : 'write';

const subjects = getSubjects();
const topics = subjects.flatMap((s) => s.topics.map((t) => ({ ...t, subjectName: s.name })));
type Row = (typeof topics)[number];

interface Entry {
  url: string;
  lastmod?: string | null | undefined;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  alternates?: Record<string, string>;
  images?: string[];
}

/** git commit date of a path — the only truthful lastmod available (no date field in content). */
function gitDate(relPath: string): string | null {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', relPath], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

const topicLastmod = new Map<string, string | null>(
  subjects.flatMap((s) => s.topics.map((t) => [t.id, gitDate(`src/content/data/topics/${s.id}/${t.id}.json`)] as const)),
);
const topicsInTier = (tier: string) => topics.filter((t) => tierOfTopic(t) === tier);
/** Tiers with content only — an empty tier gets no hub, no sitemap, no index entry. */
const liveTiers = (Object.keys(TIERS) as TierKey[]).filter((k) => topicsInTier(k).length > 0);
const newest = (dates: (string | null | undefined)[]) => dates.filter((d): d is string => !!d).sort().at(-1) ?? new Date().toISOString();
const abs = (p: string) => `${SITE.origin}${p}`;

/** /, /ks3, /ks3/math, /subjects/math, /pricing, /terms. Hub lastmod = freshest child. */
function coreEntries(): Entry[] {
  const entries: Entry[] = [
    { url: abs('/'), lastmod: newest([...topicLastmod.values(), gitDate('src/app/page.tsx')]), changeFrequency: 'weekly', priority: 1, alternates: alternatesFor('/') },
    { url: abs('/pricing'), lastmod: gitDate('src/app/pricing/page.tsx'), changeFrequency: 'monthly', priority: 0.7, alternates: alternatesFor('/pricing') },
    { url: abs('/terms'), lastmod: gitDate('src/app/terms/page.tsx'), changeFrequency: 'yearly', priority: 0.2 },
  ];
  for (const tier of liveTiers) {
    const seg = TIERS[tier].segment;
    const kids = topicsInTier(tier);
    entries.push({ url: abs(`/${seg}`), lastmod: newest(kids.map((t) => topicLastmod.get(t.id))), changeFrequency: 'weekly', priority: 0.9, alternates: alternatesFor(`/${seg}`) });
    for (const subjectId of [...new Set(kids.map((t) => t.subjectId))]) {
      const sub = kids.filter((t) => t.subjectId === subjectId);
      entries.push({ url: abs(`/${seg}/${subjectId}`), lastmod: newest(sub.map((t) => topicLastmod.get(t.id))), changeFrequency: 'weekly', priority: 0.8, alternates: alternatesFor(`/${seg}/${subjectId}`) });
    }
  }
  for (const s of subjects) {
    entries.push({ url: abs(`/subjects/${s.id}`), lastmod: newest(s.topics.map((t) => topicLastmod.get(t.id))), changeFrequency: 'weekly', priority: 0.8 });
  }
  return entries;
}

/** Deep pages, one urlset per curriculum tier. /quiz + /flashcards are noindex → never here. */
function tierEntries(tier: TierKey): Entry[] {
  return topicsInTier(tier).map((t) => ({
    url: abs(STUDY_PATH(t)),
    lastmod: topicLastmod.get(t.id),
    changeFrequency: 'monthly',
    priority: 0.7,
    images: t.notes.filter((n) => n.illustration).slice(0, 8).map((n) => `${SITE.origin}${n.illustration!.src}`),
  }));
}

/** Free assessment surfaces only. NOTE: no /exams/<courseId> and no /papers/<courseId> page exists. */
function assessmentEntries(): Entry[] {
  const hub = gitDate('src/app/exams/page.tsx');
  const entries: Entry[] = [
    { url: abs('/diagnostics'), lastmod: gitDate('src/app/diagnostics/page.tsx'), changeFrequency: 'monthly', priority: 0.6 },
    { url: abs('/exams'), lastmod: hub, changeFrequency: 'monthly', priority: 0.6 },
    // /papers is its own hub (free-response sets), NOT a child of /exams — it was missing
    // until the sitemap-vs-out/ cross-check found an indexable page with no feed entry.
    { url: abs('/papers'), lastmod: gitDate('src/app/papers/page.tsx'), changeFrequency: 'monthly', priority: 0.6 },
  ];
  for (const course of COURSES) {
    const courseTopics: Row[] = topics.filter((t) => course.matches(t));
    const fresh = newest([...courseTopics.map((t) => topicLastmod.get(t.id)), hub]);
    entries.push(
      { url: abs(`/diagnostics/${course.id}`), lastmod: fresh, changeFrequency: 'monthly', priority: 0.5 },
      { url: abs(`/exams/${course.id}/ladder`), lastmod: fresh, changeFrequency: 'monthly', priority: 0.4 },
    );
    for (let lvl = 1; lvl <= FREE_LADDER_LEVELS; lvl++) {
      entries.push({ url: abs(`/exams/${course.id}/ladder/${lvl}`), lastmod: fresh, changeFrequency: 'monthly', priority: 0.4 });
    }
  }
  for (const paper of getAllPapers().filter((p) => isFreePaperSet(p.id))) {
    entries.push({ url: abs(`/papers/${paper.courseId}/${paper.id}`), lastmod: gitDate(`src/content/data/papers/${paper.courseId}/${paper.id}.json`), changeFrequency: 'monthly', priority: 0.5 });
  }
  return entries;
}

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

function urlsetXml(entries: Entry[]): string {
  const urls = entries
    .map((e) => {
      const lines = [`    <loc>${esc(e.url)}</loc>`];
      for (const [lang, href] of Object.entries(e.alternates ?? {})) lines.push(`    <xhtml:link rel="alternate" hreflang="${esc(lang)}" href="${esc(href)}"/>`);
      for (const src of e.images ?? []) lines.push(`    <image:image>\n      <image:loc>${esc(src)}</image:loc>\n    </image:image>`);
      if (e.lastmod) lines.push(`    <lastmod>${esc(e.lastmod)}</lastmod>`);
      if (e.changeFrequency) lines.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
      if (e.priority != null) lines.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function indexXml(children: { file: string; lastmod: string }[]): string {
  const items = children.map((c) => `  <sitemap>\n    <loc>${esc(abs(`/sitemap/${c.file}`))}</loc>\n    <lastmod>${esc(c.lastmod)}</lastmod>\n  </sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

const files: { file: string; xml: string; lastmod: string }[] = [];
function add(name: string, entries: Entry[]) {
  if (!entries.length) return;
  for (let i = 0; i < entries.length; i += GOOGLE_URL_LIMIT) {
    const chunk = entries.slice(i, i + GOOGLE_URL_LIMIT);
    files.push({
      file: `${name}${entries.length > GOOGLE_URL_LIMIT ? `-${i / GOOGLE_URL_LIMIT + 1}` : ''}.xml`,
      xml: urlsetXml(chunk),
      lastmod: newest(chunk.map((c) => c.lastmod ?? null)),
    });
  }
}

add('core', coreEntries());
for (const tier of liveTiers) add(TIERS[tier].segment, tierEntries(tier));
add('assessments', assessmentEntries());
const all = [{ file: 'index.xml', xml: indexXml(files), lastmod: newest(files.map((f) => f.lastmod)) }, ...files];
const pageUrls = () => all.filter((f) => f.file !== 'index.xml').flatMap((f) => [...f.xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

if (MODE === 'check') {
  const stale = all.filter((f) => !existsSync(`${OUT_DIR}/${f.file}`) || readFileSync(`${OUT_DIR}/${f.file}`, 'utf8') !== f.xml);
  const orphans = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.xml') && !all.some((a) => a.file === f)) : [];
  if (stale.length || orphans.length) {
    console.error(`stale sitemaps: ${[...stale.map((s) => s.file), ...orphans].join(', ')}\nrun: npm run generate:sitemaps`);
    process.exit(1);
  }
  console.log(`sitemaps fresh (${all.length} files, ${pageUrls().length} URLs)`);
  process.exit(0);
}

if (MODE === 'verify') {
  // Runs AFTER build:static. Three cross-checks, all of which have found a real defect here:
  //   1. a sitemap URL that 404s (the 13 tier hubs, until step S3 builds them);
  //   2. a sitemap URL the page itself marks noindex (we would be submitting pages we ask
  //      the engine to drop — the two systems must agree);
  //   3. an indexable, crawlable page in NO sitemap (silent orphan; this is how /papers
  //      was missing from the feed).
  // It is the only cheap way to keep this script honest about routes it does not own.
  if (!existsSync('out')) {
    console.error('verify: out/ missing — run `npm run build:static` first');
    process.exit(1);
  }
  const pathOf = (u: string) => {
    const p = u.replace(SITE.origin, '');
    return p === '' ? '/' : p;
  };
  const sitemapPaths = new Set(pageUrls().map(pathOf));

  const foreign = pageUrls().filter((u) => !u.startsWith(`${SITE.origin}/`));
  const missing404 = [...sitemapPaths].filter(
    (p) => !existsSync(`out${p}.html`) && !existsSync(`out${p === '/' ? '' : p}/index.html`),
  );

  // Classify every exported page by its own robots meta tag.
  // Duplicate <title>s are how a page silently fails to rank: two URLs, one string, no way
  // for the engine to tell them apart. Caught the ladder levels and the admin consoles here.
  const titles = new Map<string, string[]>();
  const noindexed: string[] = [];
  const indexable: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '_next' && !entry.name.startsWith('.')) walk(full);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      if (/404|_not-found/.test(full)) continue;
      let p = full.slice('out/'.length, -'.html'.length);
      if (p.endsWith('/index')) p = p.slice(0, -'index'.length);
      p = p === 'index' || p === '' ? '/' : `/${p}`;
      const html = readFileSync(full, 'utf8');
      const robots = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? '';
      (robots.includes('noindex') ? noindexed : indexable).push(p);
      const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '';
      titles.set(title, [...(titles.get(title) ?? []), p]);
    }
  };
  walk('out');

  const conflicts = [...sitemapPaths].filter((p) => noindexed.includes(p));
  const orphans = indexable.filter((p) => !sitemapPaths.has(p));
  // Two pages may legitimately share a title only if BOTH are noindex (e.g. an internal
  // console and its sub-pages) — an indexable collision is always a defect.
  const dupeTitles = [...titles.entries()].filter(
    ([t, paths]) => paths.length > 1 && t.trim() !== '' && paths.some((p) => !noindexed.includes(p)),
  );

  const problems = foreign.length + missing404.length + conflicts.length + orphans.length + dupeTitles.length;
  for (const f of foreign) console.error(`origin violation: ${f}`);
  for (const b of missing404) console.error(`404 in export: ${SITE.origin}${b}`);
  for (const c of conflicts) console.error(`sitemap URL is noindex: ${SITE.origin}${c}`);
  for (const o of orphans) console.error(`indexable page in no sitemap: ${SITE.origin}${o}`);
  for (const [t, paths] of dupeTitles) console.error(`duplicate <title> ${JSON.stringify(t)}: ${paths.join(', ')}`);
  if (problems) {
    console.error(
      `verify failed: ${problems} problem(s) across ${sitemapPaths.size} sitemap URLs, ` +
        `${indexable.length} indexable and ${noindexed.length} noindex pages in out/`,
    );
    process.exit(1);
  }
  console.log(
    `verify ok: ${sitemapPaths.size} sitemap URLs all live + indexable; ${indexable.length} indexable pages all submitted, titles unique; ${noindexed.length} noindex pages all excluded`,
  );
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
for (const f of all) writeFileSync(`${OUT_DIR}/${f.file}`, f.xml);

const skipped = (Object.keys(TIERS) as TierKey[]).filter((t) => !liveTiers.includes(t));
console.log(
  `wrote ${all.length} files to ${OUT_DIR} (${pageUrls().length} URLs) · ` +
    liveTiers.map((t) => `${TIERS[t].label}:${topicsInTier(t).length}`).join(' ') +
    ` · skipped empty tiers: ${skipped.map((t) => TIERS[t].label).join(', ') || 'none'}`,
);
for (const f of files) console.log(`  ${f.file.padEnd(16)} ${f.xml.split('\n').filter((l) => l.includes('<loc>')).length} urls · lastmod ${f.lastmod}`);
