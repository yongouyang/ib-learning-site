# Technical SEO Architecture — Google + Bing

Authored: 2026-08-30 (senior-SEO-architect pass). Status: **proposal — no `src/` code landed yet.**
Scope: crawl + index architecture for the static export (`out/` → S3 → CloudFront), structured
data, international/regional targeting, robots + discovery. Non-goal: content marketing calendar.

## 0. Current state (measured, not assumed)

| Check | Finding |
|---|---|
| Static URL surface | **808** prerendered `.html` files after a fresh `build:static` (798 in the stale 28-Aug export; excl. 404/`_not-found`/offline) |
| Topics in registry | **217** committed topic JSONs → 217 `/study` + 217 `/quiz` + 217 `/flashcards` |
| Curriculum split | KS3 **197** (Y7 60 / Y8 49 / Y9 52 / un-yearred 36), IB DP Math AI **20**, **IGCSE 0** |
| Deep-page text | Prerendered and crawlable — `out/subjects/math/math-yr7-angles/study.html` = 166 KB, ~10 100 chars of visible copy. No JS-render gap. |
| Internal links | Real `<a href>` in the static HTML for every topic + tool variant (found in `out/subjects/math.html`) → crawler reachable today |
| `robots.txt` | `src/app/robots.ts` exists: `Allow: /` + 10 AI-training bots disallowed. **No `Sitemap:` line.** |
| Sitemaps | **None** (`out/sitemap*.xml` does not exist) |
| Per-page metadata | **Missing.** Subject and topic pages export no `metadata`/`generateMetadata` → every deep page ships `<title>Octav Learning</title>` and no description/canonical (verified in the built HTML) |
| Structured data | None anywhere |
| hreflang | None |
| **DEV vs PROD** | `https://dev.octavlearning.com` serves a **full indexable clone** of prod (own bucket, own distribution) with **zero** noindex / X-Robots-Tag / disallow. `grep -rn "noindex" src terraform` → no hits. **This is the highest-severity item in this document.** |
| Content dates | `Topic` has no `updatedAt`/`createdAt` (see `src/content/types.ts`) → `<lastmod>` must come from git, not the build clock |
| CDN URL rewrite | `url_rewrite` CloudFront Function appends `.html` **only when the URI contains no dot** → `/sitemap.xml`, `/robots.txt`, `/sitemap/ks3.xml` pass through untouched. Verified in `terraform/modules/site/main.tf` |
| Checkout pages | None — `/pricing` is static; Stripe (Phase E4) deferred, so there is nothing paywall-shaped to hide yet |

**Reframing of the brief.** With 798 URLs on a fresh-ish domain, *crawl budget* is not the binding
constraint — Google and Bing will crawl this site in one or two visits. The constraints that actually
decide rankings here are:

1. **Host canonicalisation** (prod vs dev) — otherwise every signal is split across two hosts.
2. **Index quality** — choosing one canonical URL per topic out of the study/quiz/flashcards trio, so 217 pages compete instead of 651 near-duplicates.
3. **Serious titles/meta + curriculum-anchored URL architecture** — the current `/subjects/<subject>/<topic>` tree does not express KS3 / IGCSE / IB DP anywhere, and the pages have no title.
4. **Entity clarity** (JSON-LD) + **discovery latency** (sitemaps, IndexNow for Bing).

Everything below is ordered by that leverage.

---

## 1. Dynamic XML sitemap strategy (curriculum hierarchy)

### 1.1 URL architecture first, sitemaps second

A sitemap can *group* URLs by curriculum, but it cannot *tell* Google that `/subjects/math/math-dp-ai-binomial/study` is an IB DP page — the URL path, the breadcrumb, the `<title>` and the `Course` schema do that. So the hierarchy is introduced as **additive hub routes**, leaving existing deep URLs alone (no 301s, no re-index dip):

```
/                                   brand + curriculum chooser
├── /ks3                            TIER hub      → "KS3 revision"            (index)
│   └── /ks3/<subjectId>            TIER×SUBJECT  → "KS3 Maths", "Year 7…"    (index)
├── /igcse                          TIER hub      → emitted ONLY when ≥1 IGCSE topic exists
│   └── /igcse/<subjectId>
├── /ibdp                           TIER hub      → "IB DP"                   (index)
│   └── /ibdp/<courseId>            TIER×COURSE   → "IB DP Math AI"           (index)
├── /subjects/<subjectId>           subject index across tiers (exists today) → index, 10 pages
│   └── /subjects/<s>/<topicId>/study   DEEP page — the only indexed leaf      → index, 217 pages
│       ├── …/quiz                                                              → noindex, follow
│       └── …/flashcards                                                        → noindex, follow
└── assessment surfaces (measured against the real route tree — see 1.3a)
    ├── /diagnostics, /diagnostics/<courseId>            1 + 13  index (tier-0, never gated)
    ├── /exams, /exams/<c>/ladder, /exams/<c>/ladder/1-2  1 + 13 + 26  index (free levels)
    └── /papers/<c>/<c>-set-1                             13       index (FREE_PAPER_SETS_PER_COURSE)
```

**1.3a Route inventory (verified, and it corrected two assumptions in this design).**
`src/app/exams/[courseId]/` contains only `[paperId]/` and `ladder/` — there is **no
`/exams/<courseId>` page**, and `out/papers/` has no `<courseId>` page either — there is **no
`/papers/<courseId>` hub**. Emitting either (as a naive per-course loop does) puts 26 guaranteed
404s into a sitemap, which is the single worst thing a sitemap can do for a new domain. Separately,
`src/app/exams/[courseId]/[paperId]/ExamRunnerClient.tsx` gates **all** timed mock papers on
`exam-sets-full` (`if (loaded && !has('exam-sets-full'))` → `LockedFeature`), so
`/exams/<c>/paper-1` and `/paper-2` are login walls for an anonymous crawler — including Googlebot,
which runs JS-free at first pass — and must be `noindex`, not sitemap'd.

Three levels, three distinct intents, no cannibalisation *provided* titles/H1s differ:
tier = "KS3 revision", tier×subject = "KS3 Maths", leaf = "Angles — KS3 Year 7 Maths".
`/subjects/<id>` is deliberately re-roled as the *cross-curriculum* index (the only page that legitimately lists Y7 → DP for one subject).

### 1.2 Indexability decision table

| Surface | Count | Verdict | Mechanism |
|---|---|---|---|
| `/`, `/pricing`, `/terms` | 3 | index | sitemap |
| tier hubs, tier×subject hubs | 2 + 11 (today) | index | sitemap |
| `/subjects/<id>` | 10 | index | sitemap |
| `…/study` | 217 | index | sitemap |
| `…/quiz`, `…/flashcards` | 434 | **noindex, follow** | `meta robots` (keep crawlable so links pass equity to `/study`) |
| `/diagnostics`, `/exams`, `/papers` hubs + `/diagnostics/<c>`, `/exams/<c>/ladder`, ladder levels 1–2, `/papers/<c>/<c>-set-1` | **68** | index | sitemap (`assessments.xml`, measured) |
| `/pricing`, `/terms` | 2 | index | sitemap (`core.xml`) — and their titles no longer repeat the brand (§6.1) |
| `/exams/<c>/paper-1`, `/exams/<c>/paper-2` (timed mocks — **premium-gated in code**) | 17 | **noindex, follow** | `meta robots` — never in a sitemap |
| paper sets 2+, ladder levels 3–5 (`src/lib/entitlements/exam-access.ts`) | 13 + 39 | **noindex, follow** | `meta robots` — never in a sitemap |
| `/account`, `/login`, `/progress`, `/mixed-review`, `/leaderboard` | 5 | noindex, follow | `meta robots` (user state / handle PII) |
| `/offline`, `/admin/*`, `/api/*` | — | disallow | `robots.txt` (see §4) |
| **every URL on `dev.octavlearning.com`** | ~800 | **noindex + disallow** | edge header, §4.3 |

Total indexable set as generated and measured in this repo: **311 URLs** (26 core + 197 KS3 +
20 IB DP + 68 assessment) out of 809 prerendered pages — a 62% reduction in the indexable surface
with zero content deleted.

`noindex` is chosen over robots.txt-`Disallow` for app surfaces on purpose: a disallowed URL can
still enter the index as "Indexed, though blocked by robots.txt" (a page with no snippet and no
control), whereas `noindex` requires the URL to be fetched — so it must be crawlable to be
removable. `Disallow` is reserved for non-pages (APIs, admin, static chunks).

### 1.3 Why a build-time generator instead of Next's `sitemap.ts`

`next/dist/docs/.../sitemap.md` (v16.3) offers `sitemap.ts` (one URL set), nested-segment
`sitemap.ts` files, or `generateSitemaps()` → `/sitemap/[id].xml`. Three of our requirements are
outside that box:

* **`lastmod` honesty.** Content files carry no date field; the only true timestamp is git
  (`git log -1 --format=%cI -- <file>`). A metadata route runs inside the bundler with no `fs`/git
  access and would stamp the build date, making every URL "updated" on every deploy — the fastest
  way to get `<lastmod>` ignored.
* **Stable, semantic file names** (`/sitemap/ks3.xml`, `/sitemap/ibdp.xml`) that survive the
  `output: 'export'` topology. `generateSitemaps` emits `/sitemap/<id>.xml`, i.e. numeric ids, and
  is a dynamic route — awkward under export.
* **Tier-aware skipping** — IGCSE has **0** topics today, so we must not publish an `/igcse` hub or
  an empty IGCSE sitemap. That decision needs the registry + `order.json`, which a plain Node script
  can read.

So: `scripts/generate-sitemaps.mjs` writes real XML into `public/sitemap/` (gitignored, exactly like
the `generate:registry` pattern), Next copies `public/` into `out/`, and the existing CI
`s3 sync` + `cloudfront create-invalidation` carries it with no terraform change.

### 1.4 Implementation (written, type-checked and executed against this repo)

Three new modules are the single source of truth for the curriculum hierarchy — the app routes
(S3), the sitemap generator and the JSON-LD builders all import them, per the `AGENTS.md`
single-source convention.

```ts
// src/lib/seo/curriculum.ts
import type { Stage, Topic } from '../../content/types';

export type TierKey = 'ks3' | 'igcse' | 'ibdp';

export interface TierMeta {
  segment: string;
  label: string;
  hubTitle: string;
  /** The qualification a learner sits. null = no award exists at this tier (KS3). */
  credential: string | null;
}

export const TIERS: Record<TierKey, TierMeta> = {
  ks3: { segment: 'ks3', label: 'KS3', hubTitle: 'Key Stage 3 (ages 11–14)', credential: null },
  igcse: { segment: 'igcse', label: 'IGCSE', hubTitle: 'International GCSE', credential: 'Cambridge International GCSE (9–1)' },
  ibdp: { segment: 'ibdp', label: 'IB DP', hubTitle: 'IB Diploma Programme', credential: 'IB Diploma Programme certificate' },
};

const STAGE_TO_TIER: Record<Stage, TierKey> = { ks3: 'ks3', igcse: 'igcse', dp: 'ibdp' };

export const tierOfTopic = (t: { stage: Stage }): TierKey => STAGE_TO_TIER[t.stage];
export const tierMeta = (t: { stage: Stage }): TierMeta => TIERS[tierOfTopic(t)];

/** The indexed canonical leaf. quiz/flashcards are noindex variants of this URL. */
export const STUDY_PATH = (t: { subjectId: string; id: string }) => `/subjects/${t.subjectId}/${t.id}/study`;
export const topicPath = STUDY_PATH;

export const tierHubPath = (tier: TierKey) => `/${TIERS[tier].segment}`;
export const tierSubjectPath = (tier: TierKey, subjectId: string) => `/${TIERS[tier].segment}/${subjectId}`;

/** "Key Stage 3, Year 7" | "International GCSE" | "IB DP AI (SL)" — used in titles + educationalLevel. */
export function curriculumLabel(t: Topic): string {
  if (t.stage === 'ks3') return t.year ? `Key Stage 3, Year ${t.year}` : 'Key Stage 3';
  if (t.stage === 'dp') return `IB DP${t.course ? ` ${t.course.toUpperCase()}` : ''}${t.level ? ` (${t.level.toUpperCase()})` : ''}`;
  return TIERS.igcse.hubTitle;
}

/** Only where a credential genuinely exists; KS3 awards nothing. */
export const credentialFor = (t: Topic): string | null => tierMeta(t).credential;

/**
 * Derivable, stable, never hand-written: `MATH-KS3-Y7-ANGLES`, `CHEM-KS3-Y7-STATES-1`,
 * `MATH-IBDP-AI-SEQUENCES`. Structural tokens (subject abbrev, year, stage, course, level)
 * are encoded once in the prefix, so they are stripped from the slug half — but numeric
 * discriminators are KEPT, because `bio-body-1` and `bio-body-2` must not collapse.
 * Uniqueness across the whole registry is asserted in tests/unit/seo.test.ts.
 */
export function courseCodeFor(t: Topic): string {
  const tier = tierMeta(t);
  const subject = t.subjectId.slice(0, 4).toUpperCase();
  const stageToken = [t.subjectId, `yr${t.year ?? ''}`, `y${t.year ?? ''}`, tier.segment, 'dp', 'igcse', t.course, t.level]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  const slug = t.id
    .split('-')
    .filter((tok, i) => i > 0 && !stageToken.includes(tok.toLowerCase()))
    .join('-')
    .toUpperCase();
  const mid = t.year ? `Y${t.year}` : t.course ? t.course.toUpperCase() : t.level ? t.level.toUpperCase() : '';
  return [subject, tier.label.replace(/\s/g, ''), mid, slug].filter(Boolean).join('-');
}
```

```ts
// src/lib/seo/hreflang.ts — H0/H1 switch; §3 explains the phases
import { SITE } from './site';

/** H0 = one global English variant (x-default + en-GB self-reference). See plan §3.1. */
export const HREFLANG_PHASE: 'H0' | 'H1' = 'H0';

export const LOCALES = {
  'en-GB': { path: '', region: 'United Kingdom' },
  'en-US': { path: '/en-us', region: 'United States' },
  'en-SG': { path: '/en-sg', region: 'Singapore' },
  'en-AE': { path: '/en-ae', region: 'United Arab Emirates' },
} as const;
export type Locale = keyof typeof LOCALES;

/** H1: only locales that actually ship a variant may appear, en-GB first (= the x-default target). */
export const PUBLISHED_LOCALES: Locale[] = ['en-GB'];

export function localeMapFor(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of PUBLISHED_LOCALES) {
    const url = `${SITE.origin}${LOCALES[l].path}${path}`;
    map[l] = url;
    map['x-default'] ??= url;
  }
  return map;
}

/** Emitted on hub / brand URLs only — never on the 217 deep topic pages. */
export function alternatesFor(path: string): Record<string, string> {
  if (HREFLANG_PHASE === 'H0') {
    const url = `${SITE.origin}${path}`;
    return { 'x-default': url, 'en-GB': url };
  }
  return localeMapFor(path);
}
```

`src/lib/seo/site.ts` is in §2.2. The generator:

```ts
// scripts/generate-sitemaps.ts  (run with tsx; imports the real registry — no forked content lists)
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
```

Measured output of `npx tsx scripts/generate-sitemaps.ts` in this repo:

```
wrote 5 files to public/sitemap (311 URLs) · KS3:197 IB DP:20 · skipped empty tiers: IGCSE
  core.xml         26 urls · lastmod 2026-08-30T00:30:57+08:00
  ks3.xml          197 urls · lastmod 2026-08-23T09:38:35+08:00
  ibdp.xml          20 urls · lastmod 2026-08-23T09:38:35+08:00
  assessments.xml   68 urls · lastmod 2026-08-30T00:30:57+08:00
```

> **`next build` type-checks `scripts/**`** — verified here: a `Map.get()` type slip in this script
> failed `npm run build:static` with "Failed to type check". So the generator is `(string | null |
> undefined)`-strict and imports only browser-safe modules. Also verified: a stale `.next/dev`
> (1.1 GB) whose generated `validator.ts` points at the stashed `src/app/api` routes aborts
> `build:static` — `rm -rf .next/dev` before a local export build.

package.json wiring (note the **ordering constraint**: write → build → verify):

```jsonc
"scripts": {
  "generate:sitemaps": "tsx scripts/generate-sitemaps.ts",
  "check:sitemaps": "tsx scripts/generate-sitemaps.ts --check",
  "verify:sitemaps": "tsx scripts/generate-sitemaps.ts --verify",
  "build:static": "npm run generate:sitemaps && bash scripts/build-static.sh && npm run verify:sitemaps"
}
```

`/public/sitemap/` goes in `.gitignore` (generated artefact, same policy as `src/content/registry.ts`
which is *committed*; here the XML is derived and re-derived per build). `public/` is copied verbatim
into `out/`, so the existing CI `aws s3 sync out/` + `cloudfront create-invalidation --paths "/*"`
carry the sitemaps with **no terraform change** — and the `url_rewrite` Function only appends `.html`
when the URI has no dot, so `/sitemap/ks3.xml` passes through untouched (verified in
`terraform/modules/site/main.tf`). One local-topology gap: `scripts/serve-static.ts` has no `.xml`
MIME entry, so it would serve the sitemaps as `application/octet-stream` (S3 sends
`application/xml`). Add:

```ts
  '.xml': 'application/xml; charset=utf-8',
```

### 1.5 Emitted XML — real output from this repo

`https://octavlearning.com/sitemap/index.xml` (children = only tiers with content; IGCSE skipped at
0 topics):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://octavlearning.com/sitemap/core.xml</loc>
    <lastmod>2026-08-30T00:30:57+08:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://octavlearning.com/sitemap/ks3.xml</loc>
    <lastmod>2026-08-23T09:38:35+08:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://octavlearning.com/sitemap/ibdp.xml</loc>
    <lastmod>2026-08-23T09:38:35+08:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://octavlearning.com/sitemap/assessments.xml</loc>
    <lastmod>2026-08-30T00:30:57+08:00</lastmod>
  </sitemap>
</sitemapindex>```

A hub from `core.xml` (H0 hreflang block, §3.2; `lastmod` = freshest child, so it moves only when
content moves):

```xml
  <url>
    <loc>https://octavlearning.com/ks3/math</loc>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://octavlearning.com/ks3/math"/>
    <xhtml:link rel="alternate" hreflang="en-GB" href="https://octavlearning.com/ks3/math"/>
    <lastmod>2026-08-23T09:38:35+08:00</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
```

A deep page from `ks3.xml` (illustrated notes ride along as an image sitemap — the site's actual
differentiator, and Google Images is a real acquisition channel for diagrams):

```xml
  <url>
    <loc>https://octavlearning.com/subjects/chemistry/chem-states-1/study</loc>
    <image:image>
      <image:loc>https://octavlearning.com/images/chemistry/chem-states-1-three-states.svg</image:loc>
    </image:image>
    <image:image>
      <image:loc>https://octavlearning.com/images/chemistry/chem-states-1-changes-of-state.svg</image:loc>
    </image:image>
    <lastmod>2026-08-19T21:53:19+08:00</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
```

From `assessments.xml` — note the free-only split encoded from `exam-access.ts` (set 1 of 2, ladder
level 1 of 5), each with its own git-sourced `lastmod`:

```xml
  <url>
    <loc>https://octavlearning.com/exams/math-y7/ladder/1</loc>
    <lastmod>2026-08-30T00:30:57+08:00</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>https://octavlearning.com/papers/math-y7/math-y7-set-1</loc>
    <lastmod>2026-07-26T11:23:10+08:00</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
```

### 1.5a The integrity gate (`--verify`), and what it caught here

`--verify` runs **after** the export and fails the build on any sitemap URL that is not a
prerendered page in `out/` (and on any absolute-origin slip). Executed against the freshly built
export in this repo:

```
verify failed: 13 problem(s) across 311 sitemap URLs, 298 indexable and 511 noindex pages in out/
404 in export: https://octavlearning.com/ks3
404 in export: https://octavlearning.com/ks3/math
   … (+9 more /ks3/<subject>, /ibdp, /ibdp/math)
```

Those 13 are exactly the tier hubs that step **S3** creates — i.e. the gate correctly proves the
sequencing constraint: **do not ship the sitemap before the hub routes exist**, or Google/Bing get 13
404s on day one and learn to distrust the feed. Two options, both fine: land S3 first, or ship S2 with
`coreEntries()` hub emission gated behind a `HUBS_LIVE = false` flag. Writing the sitemap *first* is
the mistake; engines purge URL sets that 404 and a fresh domain's crawl budget is spent on errors.

### 1.6 Expectation setting on sitemap fields

* `lastmod` — the only field Google documents as acted upon ("we may use it to prioritise recrawl"). It must be *accurate*, which is why the generator reads git.
* `changefreq` / `priority` — emitted for Bing compatibility and human readability; **Google states it ignores both.** Never let a priority value drive an architectural decision.
* One index, stable child names, and *no* URLs in a sitemap that 301, 404, `noindex`, or are blocked by robots.txt — each such mismatch is a manual-action-grade hygiene defect in GSC/CLUE.

---

## 2. Structured data / Schema markup

### 2.1 What markup does and does not buy here

Be precise about the payoff: **Google deprecated the `Course` rich result (July 2023)**; there is no
Course badge in the SERP, and Bing's eligible-feature list tracks Google's loosely. What `Course` +
`EducationalOrganization` still do in 2026:

* let Google's Knowledge Graph and Bing's entity store resolve **Octav Learning = an educational
  organisation about KS3/IGCSE/IB DP**, and bind each deep page to a curriculum tier;
* feed the retrieval layer of AI answers (Google AI Overviews, Copilot/ChatGPT search) — the
  structured fact is quoted far more often than unstructured prose;
* power the rich results that *are* still eligible: **Breadcrumb** (site crumb trail) and
  **Organization logo**.

So: ship `Organization`/`WebSite` (site-wide), `Course` (every study page), `BreadcrumbList`
(every tier/leaf page). Skip `FAQPage` on topic pages (eligible only for well-known government and
health sites since Aug 2023) and skip `HowTo`/`Speaking`/`SpecialAnnouncement` (deprecated or
irrelevant).

### 2.2 `EducationalOrganization` + `WebSite` — `src/app/layout.tsx`

Rendered once, `@id`-anchored so every `Course.provider` can reference it instead of repeating it
217 times (this is what makes the payload cheap on the deep pages).

```tsx
// src/components/json-ld.tsx — the only place that renders JSON-LD
export function JsonLd({ nodes }: { nodes: unknown[] }) {
  return (
    <script
      type="application/ld+json"
      // no HTML-escaping inside a JSON island, and no client JS: engines that do not run JS
      // still see the graph. dangerouslySetInnerHTML is the documented Next/React way.
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }) }}
    />
  );
}

// src/lib/seo/organization.ts — the site-wide graph, mounted once in app/layout.tsx
import { SITE } from './site';

export function orgNodes() {
  return [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE.origin}/#organization`,
        name: 'Octav Learning',
        alternateName: 'Octav Learning — KS3, IGCSE and IB DP study platform',
        url: `${SITE.origin}/`,
        logo: {
          '@type': 'ImageObject',
          '@id': `${SITE.origin}/#logo`,
          url: `${SITE.origin}/icons/icon-512.png`,
          width: 512,
          height: 512,
          caption: 'Octav Learning',
        },
        // PWA source icon is a square mark on a light field — the safe asset for a logo signal.
        image: { '@id': `${SITE.origin}/#logo` },
        description:
          'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for UK Key Stage 3, IGCSE and the IB Diploma Programme, across ten subjects.',
        disambiguatingDescription:
          'An independent online study resource. Octav Learning is not an IB World School, not a Cambridge Assessment International Education exam centre, and awards no qualifications; it is not endorsed by or affiliated with the IBO or CAIE.',
        // We prepare students FOR a credential; we never award one. Saying so in markup keeps the
        // EducationalOrganization + educationalCredentialAwarded combination truthful.
        knowsLanguage: ['en-GB'],
        inLanguage: ['en-GB'],
        areaServed: [
          { '@type': 'Country', name: 'United Kingdom' },
          { '@type': 'Country', name: 'United Arab Emirates' },
          { '@type': 'Country', name: 'Singapore' },
          { '@type': 'Country', name: 'Germany' },
          { '@type': 'Country', name: 'Switzerland' },
          { '@type': 'Country', name: 'India' },
          { '@type': 'Country', name: 'Australia' },
          { '@type': 'Place', name: 'International schools worldwide' },
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'info@octavlearning.com',
          availableLanguage: ['en-GB'],
          // Contact Us feature (docs/supportability-features-plan.md) is the real channel;
          // Cloudflare Email Routing → info@ verified 2026-08-28.
        },
        sameAs: [], // fill as social profiles land — an empty array is worse than omitting the key
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.origin}/#website`,
        url: `${SITE.origin}/`,
        name: 'Octav Learning',
        inLanguage: 'en-GB',
        publisher: { '@id': `${SITE.origin}/#organization` },
        // No SearchAction: sitelinks searchbox is retired (Nov 2024) and our search is a
        // client-side filter over one subject's topics, not a site-wide search endpoint.
      },
  ];
}

// app/layout.tsx, next to <AnalyticsTracker />:
//   <JsonLd nodes={orgNodes()} />
```

```ts
// src/lib/seo/site.ts
export const SITE = {
  origin: 'https://octavlearning.com', // prod only — never parameterise by request host:
  // the DEV distribution must not be able to advertise itself as canonical.
  name: 'Octav Learning',
  inLanguage: 'en-GB', // UK curriculum spine; see §3 for the regional decision
};
```

Mount it in `app/layout.tsx` next to `<AnalyticsTracker />`.

### 2.3 `Course` + `BreadcrumbList` — every study page

> **Status:** the tier/label/credential/code layer below is **landed** as
> `src/lib/seo/{curriculum,meta,text,page-meta,assessments,topic-ref}.ts` (§6). The `course.ts`
> node builders and the `JsonLd` component are still the S4 proposal — with one correction to
> this listing: `subjectName` is not on `Topic`, it comes from `findTopic()` in
> `src/lib/seo/topic-ref.ts`.

One `generateMetadata` + JSON-LD pair shared by the tier hubs and the topic pages, so titles,
descriptions, canonicals and markup cannot drift apart. Field values are all *real* registry data
(verified: `math-yr7-angles` → 7 notes / 12 flashcards / 15 questions).

```ts
// src/lib/seo/course.ts
import type { Topic } from '@/content/types';
import { SITE } from './site';
import {
  tierMeta, tierOfTopic, curriculumLabel, credentialFor, courseCodeFor, STUDY_PATH,
  tierHubPath, tierSubjectPath,
} from './curriculum';

export function courseNode(topic: Topic, lastModified: string | null) {
  const url = `${SITE.origin}${STUDY_PATH(topic)}`;
  const tier = tierMeta(topic);
  return {
    '@type': 'Course',
    '@id': `${url}#course`,
    // courseCode is optional but powers engine-side filtering; make it derivable, not invented.
    courseCode: courseCodeFor(topic), // real: math-yr7-angles -> "MATH-KS3-Y7-ANGLES"
    name: topic.title,
    description: topic.description,
    url,
    inLanguage: SITE.inLanguage,
    // curriculum identity — the whole point of this template
    educationalLevel: curriculumLabel(topic), // "Key Stage 3, Year 7" / "International GCSE" / "IB DP Maths AI (SL)"
    ...(credentialFor(topic) // null for every KS3 topic — verified via the executed generator run
      ? {
          // Only emitted where a qualification actually exists. KS3 awards nothing, so
          // educationalCredentialAwarded is omitted rather than faked.
          educationalCredentialAwarded: {
            '@type': 'EducationalOccupationalCredential',
            name: credentialFor(topic), // "IGCSE" | "IB Diploma Programme certificate"
            credentialCategory: 'qualification',
            recognizedTerminology: credentialFor(topic),
          },
        }
      : {}),
    learningResourceType: ['Study notes', 'Flashcards', 'Practice questions'],
    // real content, not marketing copy: one entry per note heading
    teaches: topic.notes.map((n) => n.heading),
    provider: { '@id': `${SITE.origin}/#organization` },
    isAccessibleForFree: true, // policy: tier-0 content is never gated (src/lib/entitlements/features.ts)
    accessibility: {
      '@type': 'AccessibilityFeature',
      accessMode: 'Visual',
      accessModeSufficient: ['text'],
      accessibilityFeature: ['structuralTags', 'readingOrder', 'highContrastDisplay'],
    },
    ...(lastModified ? { dateModified: lastModified, timeRequired: 'PT20M' } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkMode: 'self-paced',
      url,
      inLanguage: SITE.inLanguage,
    },
  };
}

export function breadcrumbNode(topic: Topic, subjectName: string) {
  const tier = tierMeta(topic);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
      { '@type': 'ListItem', position: 2, name: tier.hubTitle, item: `${SITE.origin}${tierHubPath(tierOfTopic(topic))}` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${tier.label} ${subjectName}`,
        item: `${SITE.origin}${tierSubjectPath(tierOfTopic(topic), topic.subjectId)}`,
      },
      { '@type': 'ListItem', position: 4, name: topic.title, item: `${SITE.origin}${STUDY_PATH(topic)}` },
    ],
  };
}
```

```tsx
// src/app/subjects/[subjectId]/[topicId]/study/page.tsx  (rewrite)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject, getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import { courseNode, breadcrumbNode } from '@/lib/seo/course';
import { metaForTopic } from '@/lib/seo/meta';
import { JsonLd } from '@/components/json-ld';
import StudyPageClient from './StudyPageClient';

export function generateStaticParams() {
  return getSubjects().flatMap((s) => s.topics.map((t) => ({ subjectId: s.id, topicId: t.id })));
}

// registry lookup is O(topics) per page at build time — fine for SSG (217 pages),
// and it is what keeps markup, titles and the sitemap reading the SAME object.
function load(subjectId: string, topicId: string) {
  const subject = getSubject(subjectId as SubjectId);
  const topic = subject && getTopic(subjectId as SubjectId, topicId);
  return topic && subject ? { topic, subjectName: subject.name } : null;
}

export async function generateMetadata(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}): Promise<Metadata> {
  const { subjectId, topicId } = await props.params;
  const found = load(subjectId, topicId);
  if (!found) return {};
  return metaForTopic(found.topic, found.subjectName); // title/description/canonical/OG — §2.4
}

export default async function StudyPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const { subjectId, topicId } = await props.params;
  const found = load(subjectId, topicId);
  if (!found) notFound();
  const { topic, subjectName } = found;
  return (
    <>
      <JsonLd nodes={[courseNode(topic, null), breadcrumbNode(topic, subjectName)]} />
      <StudyPageClient subjectId={subjectId} topicId={topicId} />
    </>
  );
}
```

### 2.4 The metadata template that fixes the current title bug

> **Landed**, with three changes forced by measuring the real corpus: the brand comes from the
> layout template (never from the title string — see §6.1), titles are budgeted in *display cells*
> not characters (§6.6), and every string passes through `plainText()` so no `$R^2$` reaches a
> meta tag (§6.5). Topic leaves are brand-free; see §6 "One deviation". The final source is
> `src/lib/seo/meta.ts` + `src/lib/seo/page-meta.ts`.

```ts
// src/lib/seo/meta.ts
import type { Metadata } from 'next';
import type { Topic } from '@/content/types';
import { SITE } from './site';
import { curriculumLabel, topicPath } from './curriculum';

export function metaForTopic(topic: Topic, subjectName: string): Metadata {
  const path = topicPath(topic);
  const level = curriculumLabel(topic); // real: "Key Stage 3, Year 7"
  const title = `${topic.title} — ${level} ${subjectName}`; // brand: layout template only
  const description = `${topic.description} ${topic.notes.length} illustrated notes, ${topic.flashcards.length} flashcards and ${topic.questions.length} practice questions with worked answers.`;
  return {
    title, // explicit: the layout template would append " · Octav Learning" a second time
    description,
    alternates: { canonical: path }, // self-canonical; §3.2 adds languages on hubs only
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    openGraph: { type: 'article', url: `${SITE.origin}${path}`, title, description, siteName: SITE.name },
    twitter: { card: 'summary_large_image', title, description },
    // Deep tool pages stay crawlable (equity flows to /study) but never compete in the index.
  };
}

export function metaForTool(topic: Topic, tool: 'quiz' | 'flashcards'): Metadata {
  const level = curriculumLabel(topic);
  return {
    title: `${topic.title} ${tool === 'quiz' ? 'Quiz' : 'Flashcards'} — ${level} ${topic.subjectName}`,
    description:
      tool === 'quiz'
        ? `Test yourself on ${topic.title} with ${topic.questions.length} ${level} ${topic.subjectName} questions and instant feedback.`
        : `Memorise ${topic.title} with ${topic.flashcards.length} ${level} ${topic.subjectName} flashcards.`,
    robots: { index: false, follow: true }, // noindex, follow
    alternates: { canonical: topicPath(topic) }, // belt-and-braces: point at the study page
  };
}
```

Titles ≤ ~60 chars where possible; Google truncates and rewrites pages whose title is only the
topic name ("Angles" → rewritten to a query-matched variant). The `— <Curriculum> <Subject>` suffix
is the single highest-value string change available to this site: it puts KS3/IGCSE/IB DP in the
snippet of all 217 deep pages.

### 2.5 Validation (do not skip)

* CI job in `.github/workflows/ci.yml`: extract every `application/ld+json` from `out/**/*.html`
  (regex + `JSON.parse`) and assert parseability — a single stray quote currently ships silently.
* Rich-Results parity: paste a built page into **Google Rich Results Test** *and* **Bing's Structured
  Data Validator** (Bing is stricter about undeclared properties and about `@id` cross-references).
* Regression guard: `tests/unit/seo.test.ts` (landed in this pass, 9 tests) encodes the
  truthfulness and integrity invariants in CI — KS3 topics must return `credentialFor() === null`,
  tier mapping must cover every `Stage`, `courseCodeFor()` must be **unique across all 217 topics**,
  and the H0 hreflang group must be self-referencing with ISO-parsable codes.
* That uniqueness test paid for itself immediately: the first `courseCodeFor()` draft collapsed
  **217 topics into 156 codes** (ids like `bio-body-1` / `bio-cell-1` share a trailing token, and
  un-yearred KS3 topics collapse further). The fix drops *structural* tokens (subject abbrev, year,
  stage, course, level) from the slug half while **keeping numeric discriminators**, which is what
  makes `bio-body-1` ≠ `bio-body-2`. 217/217 unique.

---

## 3. Hreflang / regional targeting

### 3.1 The honest architectural call (read before pasting)

hreflang's documented job is to relate **URLs whose content differs by language or region**. Google's
requirement set is: bidirectional (every alternate points back at every other, including itself),
self-referencing, and *actually distinct destinations*. Our situation:

* one body of English content, no regional variants, no regional pricing, no `en-AE`-specific copy;
* identical pages served to all visitors from a single CloudFront distribution.

Emitting five hreflang alternates that all resolve to the same URL text is an **hreflang loop of
duplicates**: it adds nothing, costs maintenance on 217+ pages, and — the real risk — if we later
ship a genuine `en-US` variant, five years of mis-declared tags have to be unwound. Google's own
guidance is explicit that hreflang is unnecessary when content targets one language and you don't
regionalise it.

**Recommended today (Phase H0):** no regional hreflang. Instead:
1. `x-default` only, declared as a *self-reference* — this is the legal subset that keeps the door
   open and tells engines "one global variant, pick by language" (see 3.2).
2. Regional intent is captured by **content + entities**, not tags: curriculum names in title/H1
   (§2.4), `areaServed` + `inLanguage: "en-GB"` in the org node (§2.2), and a country-aware section
   on each tier hub ("International schools in the UAE / Singapore / Europe teaching the British
   curriculum") which is what actually ranks for "IGCSE maths tuition Dubai"-class queries.
3. Bing: regional delivery comes from `en-GB`/`en-AE` `inLanguage` + `areaServed` + local links
   (directories, school partnerships), not from hreflang alone.

**Only when a genuine regional variant exists** (Phase H1 — e.g. `/en-ae/` with a Gulf school-term
calendar, AED pricing after Stripe E4, or an `en-US` AP-vs-IGCSE page) do we turn on the full tag set.
The code below is written so H1 is a data change, not a rewrite.

### 3.2 Phase H0 — exact header, minimal and truthful

```html
<!-- every page: prod host is canonical -->
<link rel="canonical" href="https://octavlearning.com/ks3/math" />
<!-- single-variant global audience: declare the fallback only -->
<link rel="alternate" hreflang="x-default" href="https://octavlearning.com/ks3/math" />
<link rel="alternate" hreflang="en-GB" href="https://octavlearning.com/ks3/math" />
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
<html lang="en-GB">
```

Rationale: `x-default` (no match) + `en-GB` (the curriculum spine) + `en` as the implicit fallback is
Google's documented minimum for "one language, global audience", and it is *already* consistent with
the curriculum tree so it cannot drift. Do not emit `en-US`/`en-SG`/`en-AE` here — an alternate that
points at the identical URL for a different region is the anti-pattern in 3.1.

In Next's Metadata API (`node_modules/next/dist/docs` → `alternative-urls-types.d.ts`: keys are
`LangCode | 'x-default'`, values may be a string or an array):

```tsx
// src/app/subjects/[subjectId]/page.tsx — hub example (leaves keep the plain self-canonical)
import type { Metadata } from 'next';
import { SITE } from '@/lib/seo/site';
import { alternatesFor } from '@/lib/seo/hreflang'; // §1.4 module — one switch for both phases

export async function generateMetadata(): Promise<Metadata> {
  const path = '/ks3/math';
  return {
    title: 'KS3 Maths — Key Stage 3 Mathematics revision notes | Octav Learning',
    description: 'Free illustrated KS3 Maths notes, flashcards and practice questions for Years 7–9.',
    alternates: { canonical: path, languages: alternatesFor(path) },
    // renders exactly: canonical + <link rel="alternate" hreflang="x-default"> + hreflang="en-GB"
  };
}
```

`alternatesFor()` is the single switch: H0 returns `{ 'x-default', 'en-GB' }` (both self-referencing,
verified output in §1.5), H1 returns the full `localeMapFor()` group. Nothing at the call site changes
when the phase flips.

### 3.3 Phase H1 — the full regional set, implemented correctly

Two hard rules that decide whether this works at all:

* **Group symmetry.** Every URL in the group declares *all* alternates *including itself*; one
  missing self-reference silently drops the whole group's hreflang (Bing behaves the same way).
* **Scoping.** Apply it to the **hub layer + `/` + `/pricing`** (~14 URLs), never to the 217 deep
  pages. Long-tail topic pages are curriculum- and topic-specific; a UAE student and a UK student
  want the same "Angles" page, so regional alternates there are noise. Hubs are where the
  *country* intent lives, and it is where the cannibalisation risk actually bites.

The registry is already landed (`src/lib/seo/hreflang.ts`, §1.4) with `HREFLANG_PHASE = 'H0'`. Going
H1 is two edits in that one file, and nothing at any call site:

```ts
export const HREFLANG_PHASE: 'H0' | 'H1' = 'H1';

// '/<locale>/' wraps the curriculum tree, so tier structure survives regionalisation and
// /en-ae/ks3/math is still recognisably "KS3 → Maths". Unpublished locales must NOT be
// listed: a self-reference to a path that 404s voids the whole group.
export const PUBLISHED_LOCALES: Locale[] = ['en-GB', 'en-AE'];   // en-GB first = the x-default target
```

`LOCALES['en-GB'].path` is `''`, which keeps the existing URLs (`/ks3/math`) as the British variant
and adds prefixed paths for the others — no migration of the current tree, and the sitemap generator
picks the group up through `alternatesFor()` automatically.


Rendered header for `https://octavlearning.com/en-gb/ks3/math` once all four locales are live:

```html
<link rel="canonical" href="https://octavlearning.com/en-gb/ks3/math" />
<link rel="alternate" hreflang="en-GB" href="https://octavlearning.com/en-gb/ks3/math" />
<link rel="alternate" hreflang="en-US" href="https://octavlearning.com/en-us/ks3/math" />
<link rel="alternate" hreflang="en-SG" href="https://octavlearning.com/en-sg/ks3/math" />
<link rel="alternate" hreflang="en-AE" href="https://octavlearning.com/en-ae/ks3/math" />
<link rel="alternate" hreflang="x-default" href="https://octavlearning.com/en-gb/ks3/math" />
```

Same group, expressed in the sitemap (equally valid, cheaper to maintain, and the recommended form
above ~1 000 URLs — a 217-page × 5-locale hreflang header would blow the 50 KB uncompressed
`<head>` guidance, which is a *page-speed* constraint as well as an SEO one):

```xml
<url>
  <loc>https://octavlearning.com/en-gb/ks3/math</loc>
  <xhtml:link rel="alternate" hreflang="en-GB" href="https://octavlearning.com/en-gb/ks3/math"/>
  <xhtml:link rel="alternate" hreflang="en-US" href="https://octavlearning.com/en-us/ks3/math"/>
  <xhtml:link rel="alternate" hreflang="en-SG" href="https://octavlearning.com/en-sg/ks3/math"/>
  <xhtml:link rel="alternate" hreflang="en-AE" href="https://octavlearning.com/en-ae/ks3/math"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://octavlearning.com/en-gb/ks3/math"/>
  <lastmod>2026-08-30T09:12:04+08:00</lastmod>
</url>
```

The generator in §1.4 already emits this block — `alternatesFor()` is the H0 stub; swapping it for
`localeMapFor()` is the only change H1 needs.

### 3.4 Rules that are easy to get wrong (and the CI check for each)

| Rule | Why | Guard |
|---|---|---|
| Codes are `language` or `language-REGION` (ISO 639-1 / ISO 3166-1 Alpha-2), lowercase language, **uppercase region as written** | `en-gb` and `en-GB` both parse; `gb` (invalid) and `UK` (not a ISO 3166 code) do not | regex in `hreflang-group.test.ts` |
| Never pair hreflang with a **redirect by IP** | an `en-AE` visitor auto-301'd to `/en-ae/` traps crawlers and blocks the tag from being read | no geo-IP routing; a dismissible banner instead |
| Region-only codes (`en-001`) are allowed but use sparingly | `en-001` = "English, world"; valid for a global fallback | assert `x-default` present exactly once per group |
| hreflang target must be `200`, indexable, and non-canonicalised-away | a `noindex` or 301 target voids the whole group | crawl every alternate in `check:sitemaps` |
| Canonical must be *inside* its own hreflang group | canonical-to-a-different-group silently drops hreflang | unit assertion |
| `<html lang>` ≠ hreflang | keep `<html lang="en-GB">`; hreflang is about *URL* targeting | lint |

---

## 4. robots.txt + crawl-budget optimisation

### 4.1 Production `robots.ts` (drop-in replacement for `src/app/robots.ts`)

```ts
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';

// Static by nature; force-static lets `output: 'export'` emit it (unchanged from today).
export const dynamic = 'force-static';

/**
 * Blocked = bulk AI *training* crawlers. Retrieval/answer crawlers are deliberately
 * ALLOWED (see AI_ANSWER_ENGINES) — they are how we surface in ChatGPT/Claude/Copilot
 * answers, and Bing's AdaptiveCrawler is treated as a search-index bot, not a trainer.
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',            // OpenAI training corpus
  'CCBot',             // Common Crawl (feeds many trainers)
  'Bytespider',        // Bytedance/TikTok
  'Amazonbot',         // Alexa training
  'Applebot-Extended', // Apple Intelligence training (Applebot itself stays allowed)
  'meta-externalagent',// Meta AI assistant training
  'ClaudeBot',         // Anthropic training crawl (Claude-User/Claude-SearchBot allowed)
  'anthropic-ai',
  'Google-Extended',   // Gemini training — does NOT affect Search/AI Overviews eligibility
];

/** Answer-engine retrieval — explicitly Allow'd so intent survives future rule edits. */
const AI_ANSWER_ENGINES = [
  'OAI-SearchBot',     // ChatGPT search retrieval
  'ChatGPT-User',      // user-initiated fetch — NOTE: currently blocked by the old file
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'DuckAssistantBot',
  'Applebot',          // Apple Siri/Spotlight retrieval
];

/** Non-pages. Disallow here; page-shaped surfaces use meta robots (see note below). */
const NEVER_CRAWLED = [
  '/api/',            // auth/progress/analytics/feedback/leaderboard/contact Lambdas + _health probes
  '/admin/',          // analytics + dynamodb consoles
  '/offline',         // SW offline shell
  '/_next/',          // hashed bundles + RSC payloads
  '/progress',
  '/account',
  '/login',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 1. Everyone (incl. Googlebot + Bingbot): the curriculum tree is open.
      { userAgent: '*', allow: '/', disallow: NEVER_CRAWLED },
      // 2. AI answer engines: full access, stated positively.
      { userAgent: AI_ANSWER_ENGINES, allow: '/' },
      // 3. Training crawlers: nothing.
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
    ],
    // Single entry point; the index lists the curriculum-split children.
    sitemap: `${SITE.origin}/sitemap/index.xml`,
    host: SITE.origin,
  };
}
```

Rendered output:

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /offline
Disallow: /_next/
Disallow: /progress
Disallow: /account
Disallow: /login

User-Agent: OAI-SearchBot
User-Agent: ChatGPT-User
User-Agent: Claude-SearchBot
User-Agent: Claude-User
User-Agent: PerplexityBot
User-Agent: DuckAssistantBot
User-Agent: Applebot
Allow: /

User-Agent: GPTBot
User-Agent: CCBot
User-Agent: Bytespider
User-Agent: Amazonbot
User-Agent: Applebot-Extended
User-Agent: meta-externalagent
User-Agent: ClaudeBot
User-Agent: anthropic-ai
User-Agent: Google-Extended
Disallow: /

Sitemap: https://octavlearning.com/sitemap/index.xml
Host: https://octavlearning.com
```

### 4.2 Deliberate omissions, each of which is a common mistake

* **No `Crawl-delay`** — ignored by Google and Bing, and honoured only by some Chinese/regional
  crawlers. If throttling is ever needed, it belongs in the CDN, not robots.txt.
* **Do not `Disallow: /quiz` / `/flashcards`** — they must be *fetched* for `noindex` to be seen.
  Disallowing them creates the "Indexed, though blocked by robots.txt" state (URL in the index, no
  snippet, no control) and stops link equity reaching `/study`.
* **Same logic for `/account`, `/login`, `/progress`.** They are in `NEVER_CRAWLED` above only
  because they have no inbound links we care about preserving; if the funnel ever links them
  (it will — pricing CTAs), switch them to `noindex, follow` and drop them here. This is the one
  judgement call in 4.1 worth revisiting; meta robots is the safer default for page-shaped URLs.
* **No `noai`/`nosnippet`** — `nosnippet` would kill the snippet we need for curriculum queries;
  `max-image-preview:large` is a *gain* (illustrations in Google Images + AI Overviews).
* **`max-snippet:-1, max-image-preview:large`** in the `robots` meta (2.4) rather than `all` — an
  explicit directive string, so a future "block AI" decision is one edit.
* **`Host:`** is Yandex-only (harmless, dropped by Google/Bing) — keep it out if you prefer a minimal
  file. Remove it if you also remove Yandex from the plan.
* **Bing and `AdaptiveCrawler`:** Bing's AI-training crawler is separate from `bingbot`; blocking
  `bingbot`-adjacent agents as a class would cost indexation. We do not block it — an explicit
  product decision, documented here so nobody "tidies" it later.

### 4.3 DEV environment canonicalisation — do this with the robots change, not after

`dev.octavlearning.com` currently serves 798 indexable clones. Fix at the edge (matches the existing
`dev_brand_rewrite` precedent: dev-only differences live in the dev distribution, never in the build
artefact):

```hcl
# terraform/modules/site/main.tf — dev instance only (var.dev_brand_rewrite == true)
resource "aws_cloudfront_function" "dev_noindex" {
  for_each = var.dev_brand_rewrite ? toset(["dev"]) : toset([])
  name     = "${var.name_prefix}-dev-noindex"
  runtime  = "cloudfront-js-2.0"
  publish  = true
  code = <<-EOT
    function handler(event) {
      var response = event.response;
      var headers = response.headers;
      headers['x-robots-tag'] = { value: "noindex, follow", referrerPolicy: "no-referrer" };
      return response;
    }
  EOT
}
# + associate on the dev distribution's default behavior (viewer-response event)
```

Belt-and-braces (zero-terraform-code alternative): ship a dev-only `robots.txt` in the deploy step —
`aws s3 cp envs/dev-robots.txt s3://iblearn-site-305655353474/robots.txt --cache-control "public,max-age=300"`
in the `deploy-dev` job, containing `User-agent: * / Disallow: /` and a `Sitemap:` line pointing at
**prod** so dev never advertises itself. Then confirm in GSC's URL Inspection + Bing's URL Inspection
that the header is present. Note `X-Robots-Tag` cannot be set from a CloudFront *request* function —
it must be the viewer-response event.

### 4.4 Crawl-budget mechanics that actually move on a site this size

1. **Shrink the indexable set before growing it.** 798 crawled → ~250 indexable (3 + 13 hubs + 10
   subject pages + 217 study + ~120 assessment surfaces, minus noindex). Concentrating inbound
   equity on 250 URLs beats spreading it over 798 near-duplicates.
2. **Kill the RSC `.txt` dupes.** `out/**/*.txt` (`__next._tree.txt`, `subjects/math.txt`, …) are
   crawlable and mirror each page. `/_next/` is disallowed above; the route-adjacent `.txt` files are
   not, and Google's `$` end-match is *not* supported by Bing (it would treat `$` literally). The
   clean fix is at the edge: in `url_rewrite`, return 404 (or `x-robots-tag: none`) for
   `uri.endsWith('.txt')` requests that aren't `/robots.txt` — same CDN, both engines, no spec
   dependency.
3. **Internal-link depth ≤ 3** for every study page: `/ → /ks3 → /ks3/math → …/study`. Today the
   path is `/ → /subjects → /subjects/math → …/study` (fine), but the tier hubs give the curriculum
   the click-depth and anchor-text signal ("KS3 Maths angles") that `/subjects/math` cannot.
4. **Bing-specific: IndexNow.** Bing (and Yandex/Naver/Seznam) accept instant URL submission; Google
   does not, and Bing's crawl of a new domain is otherwise slow. Wire it into `deploy-dev`/`deploy-prod`
   after invalidation — it is the single cheapest Bing win on this list:

   ```js
   // scripts/ping-indexnow.mjs — run after the s3 sync + invalidation
   import { readFileSync } from 'node:fs';
   const KEY = process.env.INDEXNOW_KEY;             // 32-hex, GitHub secret
   const KEY_LOCATION = `${KEY}`;                    // served at /<KEY>.txt (must be reachable)
   const index = readFileSync('public/sitemap/index.xml', 'utf8');
   const urls = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]); // child sitemaps
   const res = await fetch('https://api.searchmall.net/indexnow/sendUrl', { // or api.indexnow.org
     method: 'POST',
     headers: { 'content-type': 'application/json; charset=utf-8', host: 'octavlearning.com' },
     body: JSON.stringify({ host: 'octavlearning.com', key: KEY, keyLocation: `https://octavlearning.com/${KEY_LOCATION}.txt`, urlList: urls }),
   });
   console.log('indexnow', res.status, urls.length, 'sitemaps pinged');
   ```
   (`200`/`202` = accepted. Ping the *sitemap* URLs, not all 250 pages — the engine ingests the
   urlsets from there. Commit `public/<KEY>.txt` as an empty verification file, or generate it in CI
   from the secret so the key never lands in the repo.)
5. **Verification + properties.** Add to `metadata` in `layout.tsx`:
   `verification: { google: process.env.NEXT_PUBLIC_GSC_HASH, msvalidate: process.env.NEXT_PUBLIC_BWT_HASH }`
   — read `next/dist/docs` before relying on `msvalidate` typing; `other: { 'msvalidate.01': … }` is
   the documented escape hatch if the key is absent. DNS verification is preferable (survives
   redeploys, can't be dropped by a head-reconciliation bug). Then submit `sitemap/index.xml` in GSC
   and Bing's portal, and set the **target country per subfolder** only if H1 regionalisation ever
   ships (the old Search Console "International Targeting" tab is deprecated for new directories).

---

## 5. Implementation order (each step independently shippable + gated)

| # | Change | Effort | Gate/rollback |
|---|---|---|---|
| ~~**S0**~~ **DONE** | Dev `X-Robots-Tag: noindex, follow` viewer-response Function on the DEV distribution only (§4.3) | — | `terraform fmt -check` ✓, `terraform validate` ✓, local `plan`: **+1 create, ~1 update on `module.site` only, `module.site_prod` absent from the diff**. Apply is CI-only, so the header itself is NOT yet verified live — `curl -I https://dev.octavlearning.com/` after the next `deploy-dev`. |
| ~~**S1**~~ **DONE** | Per-page metadata for every route (§2.4 + §1.2) | — | 809 pages rebuilt; **298 indexable / 511 noindex**; 0 duplicate titles except the two internal `/admin` pages; 0 sitemap∩noindex conflicts; `npm test` 1192 ✓; `validate:content` ✓; `audit:content` 0/0 ✓; e2e not run (no browser binaries) |
| ~~**S2a**~~ **DONE** | `src/lib/seo/{site,curriculum,hreflang}.ts` + `scripts/generate-sitemaps.ts` + npm scripts + `.xml` MIME + `/public/sitemap/` ignored (§1.4) | — | executed: 310 URLs across 4 urlsets + index, XML well-formed (`xml.etree` parse), `--check` green, `--verify` red on exactly the 13 unbuilt hubs, `build:static` type-check green |
| **S2b** | `robots.ts` v2 (`Sitemap:` line + inventory) — **do not land before S3**, or 13 sitemap URLs 404 on day one (§1.5a) | 0.5 d | `npm run generate:sitemaps && npm run build:static && npm run verify:sitemaps && npm run test:e2e:static`; add `check:sitemaps` + `verify:sitemaps` to the CI `build-and-test` job |
| **S3** | Tier hub routes `/ks3`, `/ibdp`, `/ks3/<subject>`, `/ibdp/<course>` (+ `/igcse` when content exists) — unblocks S2b | 2–3 d | content-free tier → **do not create the route**; UX-review subagent pass (mobile/desktop × light/dark) per `AGENTS.md` |
| **S4** | JSON-LD: org graph + `Course` + `BreadcrumbList` (§2) | 1 d | LD+JSON parse test over `out/**/*.html`; Rich Results Test + Bing validator on 3 sample URLs |
| **S5** | IndexNow + verification + GSC/CLUE submission (§4.4–4.5) — **IndexNow half DONE 2026-09-03** (`scripts/ping-indexnow.mjs`, `ping:indexnow`, key-file + ping steps in both deploy jobs, gated on the `INDEXNOW_KEY` secret; key generated, awaiting the secret + a deploy). Remaining, user-owned: GSC/Bing verification (DNS preferred) + `sitemap/index.xml` submission in both consoles | 0.5 d | CI secret `INDEXNOW_KEY`; watch "Discovered – currently not indexed" ratio |
| **S6** | IGCSE content (blocking prerequisite for the `/igcse/` leg of this plan) | — | the largest real SEO upside here: IGCSE is the highest-volume international-school query family and we currently have **0** pages for it |

## 6. What actually landed, and what the build taught us

### S0 — DEV indexation (terraform, `modules/site/main.tf`)

`aws_cloudfront_function.dev_noindex` is created under `count = var.dev_brand_rewrite ? 1 : 0`
— the existing dev-only flag — and associated to the **default behavior** as `viewer-response`.
Prod's `aws_cloudfront_distribution` has no such flag, so it gets no function, no association and
no header; the local plan confirmed `module.site_prod` does not appear in the diff at all.
`robots.txt` is deliberately left shared: a dev `Disallow: /` would make the `noindex` unreadable,
which is the exact failure mode §4.2 warns about.

### S1 — metadata on every route

| Helper | File | Covers |
|---|---|---|
| `plainText` / `displayWidth` / `clipToWidth` | `src/lib/seo/text.ts` | KaTeX → plain text; pixel-aware width budget |
| `metaForTopic` / `metaForTool` / `metaForSubject` / `titleQualifier` / `subjectSeoName` | `src/lib/seo/meta.ts` | 217 study + 434 tool + 10 subject pages |
| `pageMeta` + `INDEXABLE_ROBOTS` / `NOINDEX_ROBOTS` | `src/lib/seo/page-meta.ts` | every non-topic page, one title convention |
| `metaForDiagnostic` / `metaForLadderOverview` / `metaForLadderLevel` / `metaForMockPaper` / `metaForPaperSet` | `src/lib/seo/assessments.ts` | 67 assessment pages |
| `findTopic` | `src/lib/seo/topic-ref.ts` | shared registry lookup for metadata + (later) JSON-LD |

### Six findings that only a real build produced

1. **Titles already carried the brand twice.** `/pricing`, `/terms` and `/offline` set
   `title: 'Pricing — Octav Learning'` while the root layout's `title.template` appends
   `%s · Octav Learning` → the live HTML said **"Pricing — Octav Learning · Octav Learning"**.
   `pageMeta()` is now the only way a title is written here: it returns the brand-free half.
2. **Two ladder titles were byte-identical.** `"…revision ladder level 3"` overflowed the budget
   for long subject names and clipped to the same string for several levels — duplicate `<title>`s
   detected by walking `out/`. The short form (`… ladder level 3`) fits and stays distinct; the
   same check later caught free/locked paper sets sharing one title, now disambiguated by set number.
3. **Client-component pages cannot export metadata.** `/account`, `/progress`, `/admin/*` are
   `'use client'` route files, so the noindex lives in a **segment `layout.tsx`** that returns
   `children` untouched — no DOM change, no reflow, no UX pass needed.
4. **A `/papers` page was indexable but in no sitemap.** Found by the same walk; the generator now
   emits it, and `--verify` was upgraded to assert all three cross-checks permanently (see below).
5. **Topic prose contains live KaTeX that must not reach a meta tag** — 12 note headings and 2
   descriptions carry `$R^2$`, `3 \times 3`, `(a+b)^n`. `plainText()` maps ~40 commands to their
   glyphs and converts `^2`→`²`, `^n`→`ⁿ`; stress-tested over **23 115 corpus strings with zero
   residual `$`, `\`, `{` or `}`**, and asserted in CI.
6. **Width, not characters.** `Fairy Tales & Fables (童话与寓言)` is 28 characters and 33 cells.
   Budgeting in characters would have let every Chinese title overflow, so the budget is in cells.

### Measured index shape after S1

```
pages                       809
  indexable (self-canonical, in a sitemap)   298
  noindex, follow                            511   = 434 tool variants + 17 timed mocks
                                                        + 39 locked ladder levels + 13 locked sets
                                                        + 8 app/admin surfaces
duplicate <title>s            0   (except the two internal /admin pages, intentionally shared)
sitemap ∩ noindex             0
indexable − sitemap           0
sitemap − live pages         13   (the unbuilt /ks3 + /ibdp hubs — step S3)
```

`--verify` now enforces those four lines permanently (404 / sitemap∩noindex / indexable-not-in-any-feed /
duplicate `<title>` across indexable pages), so the sitemap, the `noindex` decisions and the entitlement
code can never drift apart silently. Proven in both directions: green when stub hub pages are added to
`out/`, red with exactly the 13 real misses today.

### Gates run for this pass (2026-08-31)

`npm test` 1192/1192 (26 new) · `tsc --noEmit` ✓ · `lint` 0 errors and **0 problems in any file touched
here** · `validate:content` ✓ · `audit:content` 0/0 · `validate:illustrations` ✓ ·
`validate:illustration-layout` ✓ · `generate:registry` unchanged ✓ · `build:static` ✓ ·
`test:e2e` Desktop Chrome **249/249** ✓ · `test:e2e:static` at CI parity (`--workers=1`) **254 passed,
3 skipped, 0 failed** ✓ (`pwa.spec:105` install-button is flaky — it failed on an earlier run of this
tree and on the stashed baseline, then passed) · new
`tests/e2e/seo.spec.ts` locks the wiring in both modes. Terraform: `fmt`/`validate` ✓ and a read-only
`plan` that touches `module.site` only — **the dev header is not live until the next CI deploy**, then
verify with `curl -I https://dev.octavlearning.com/`.

### One deviation from §2.4, on purpose

Topic leaves are **brand-free** (`title: { absolute }`: *"Angles — KS3 Year 7 Maths"*). With the
brand suffix, 121/217 titles had to be clipped; without it, only 20 are, and the clipped half is
always the topic name rather than the curriculum keyword. Hubs, subject pages and assessment
surfaces keep the templated brand. `metaForTool` gets a 75-cell budget instead of 60: a noindex page
never appears in a truncated snippet, so its title exists for the browser tab and history list,
where the whole topic name is what matters.

### Known issues / caveats

* **Local environment traps (each cost a detour, none is a repo bug):** a pnpm-style `node_modules`
  with an extraneous `eslint-plugin-react-hooks` makes `npm run lint` die with
  `Cannot redefine plugin "react-hooks"` — `npm ci` fixes it. Any `next dev` run regenerates
  `.next/dev/types/validator.ts`, which then breaks `build:static` — `rm -rf .next/dev` after dev use.
  `illustrations.spec` flakes nondeterministically under local multi-worker runs (baseline included):
  run Playwright with `--workers=1` to match CI.
* **Pre-existing content bug found while verifying (NOT fixed here):**
  `math-dp-ai-complex-numbers` note `n1` renders a red KaTeX `ParseError` in production, because two
  `$$…$$` blocks share one line with prose (`… = -6$$,   not $$\sqrt{36} = 6$$`). Exactly 5 such lines
  exist site-wide (also `math-dp-ai-matrices` ×2, `math-yr8-linear-equations`, `phys-simple-machines-1`)
  and neither `validate:content` nor `audit:content` has a rule for them. Fix: one `$$…$$` per line, plus
  an audit rule `display_math_not_alone_on_line`. Raw LaTeX in the DOM is also a content-quality problem
  for engines, not just cosmetics — worth its own content pass.

* **Route inventory corrections found by executing the plan** (each was a would-be 404 or a wrong
  `noindex` call in the first draft — recorded so nobody re-introduces them): there is no
  `/exams/<courseId>` page and no `/papers/<courseId>` hub; all timed mock papers
  (`/exams/<c>/paper-N`) are premium-gated in `ExamRunnerClient.tsx` and must be `noindex`; free
  assessment inventory is `/diagnostics/<c>`, `/exams/<c>/ladder[/1-2]`, `/papers/<c>/<c>-set-1`.
* **`next build` type-checks `scripts/**`.** A new script in `scripts/` is now a build-blocking
  file; keep it strict-typed and free of `@/` alias imports at *value* level (aliases resolve only
  because the imports are type-erased — `tsx` has no path-alias loader).
* **Stale `.next/dev` breaks `npm run build:static` locally** (1.1 GB generated `validator.ts`
  references the `src/app/api` routes the script stashes away → "Failed to type check").
  `rm -rf .next/dev` first. CI is unaffected (clean checkout). Worth a line in `AGENTS.md` if it
  bites again.
* **IGCSE is empty.** Any plan that assumes `/igcse/` pages exists is fiction until S6 lands.
  The generator skips empty tiers by design; do not hand-write an `igcse.xml`.
* `src/lib/seo/curriculum.ts` now exists and is the map (S2a). S3 routes and S4 JSON-LD must import
  `STUDY_PATH` / `tierHubPath` / `tierSubjectPath` / `curriculumLabel` / `courseCodeFor` from it —
  do not re-derive paths anywhere.
* `educationalCredentialAwarded` at KS3 would be a factual error (KS3 awards nothing) — the templates
  omit it there. Do not "optimise" this by adding it.
* Subject-name enrichment (`topic.subjectName`) used in §2.3 does not exist on `Topic` today — either
  add it to the registry output or derive it from `subjectMeta`. Flagged so the first build doesn't
  fail on a type error.
* Titles are a **user-visible** change (SERP + tab text): run the standing UX-review pass on the
  `<title>` strings before S1 is called done.
