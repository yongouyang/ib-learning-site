# Premium content protection & server-side content delivery — decision record

> **Status: DECIDED 2026-09-16.** Branch `feature/server-side-rendering`, HEAD `71b6fe6`, tree
> clean at measurement time (this file and `docs/PROGRESS.md` are the only changes).
> This supersedes the 2026-09-14 intention note (same file). Every figure in §2 was **re-measured
> against a fresh `npm run build:static` on 2026-09-16** (`out/version.json` → `71b6fe6`), because
> the `out/` directory that the first revision was measured against turned out to be three weeks
> stale (2026-08-23) and its page counts were wrong.
>
> **No code has changed yet.** This file records decisions and the target design; §5 is the work queue.
>
> **Decisions: §1 · Measurements: §2 · Why not full SSR: §3 · Target design: §4 · Phases: §5 ·
> Gotchas: §6 · Gates: §7 · Ceiling: §8 · Not doing: §9**

---

## 1. Decisions (2026-09-16)

Two concerns get bundled together; they have different answers and are therefore phased (§5).

| # | Question | Decision |
|---|---|---|
| 1 | **What must be true when this is done** | **All three, phased**: (a) anonymous URL-guessing of premium sets is closed, (b) bulk pulls by a paying subscriber are throttled and attributable, (c) free-content harvesting stops being a one-request job |
| 2 | **Architecture** | **Keep the static export; deliver content from a session-gated API.** No per-request HTML rendering of the site. Premium question/markscheme data leaves the build |
| 3 | **SEO boundary** | **Only study (notes) pages stay prerendered with content.** Quiz/flashcards are already `noindex`; diagnostics, ladder 1–2 and paper set 1 become metadata shells served by the same public content API |
| 4 | **Premium content at request time** | **Bundled into the content Lambda at build time** (esbuild, like the other 9 Lambdas) — content deploys atomically with the code that serves it; no extra IAM, no cold-start fetch, no second source of truth |
| 5 | **Free content API posture** | **Edge-cached, with the per-IP budget applied on origin misses** — normal users hit cache; a first-seen bulk harvest from one IP is rate-limited |
| 6 | **Offline** | **The service worker caches free content only.** Premium payloads are never cached; `/api/` stays skipped for them |

Consequence of decision 2, worth stating plainly: **"server-side rendering" here means
server-side content delivery, not per-request HTML rendering.** The protection ceiling is identical
(§8) and the cost is a fraction of a hosting migration. It also deletes the 5.1 MB site-wide chunk
(§2), which is plausibly the largest Core Web Vitals win available to this site.

---

## 2. Measured state (fresh build, 2026-09-16, HEAD `71b6fe6`)

| Fact | Evidence |
|---|---|
| **886** prerendered `.html` files, plus **4,426** RSC payload `.txt` files | `find out -name '*.html' \| wc -l` |
| **One 5.1 MB chunk is loaded site-wide** — `out/_next/static/chunks/0r3e9qb8mo18-.js` (4.6 MB of source text), referenced by **858 of 886** pages **including `/`** | `<script src="/_next/static/chunks/0r3e9qb8mo18-.js" async crossorigin>` in `out/index.html`; `grep -rl` over `out/**/*.html` |
| **That chunk contains complete premium papers** — stem, `markscheme` and `modelAnswer` for `math-y9-set-2` all present | escape-insensitive search for the paper's own strings; see the probe note in §6.6 |
| **Every premium set is also a public HTML page** with its markschemes (`out/papers/math-y9/math-y9-set-2.html`, 8 `markscheme` occurrences) and an RSC twin carrying the same | `curl`-equivalent read of `out/` |
| The whole `_next/static/chunks` directory is **6.9 MB**, so one GET retrieves essentially the entire product | `du -sh` |
| **334 indexable / 550 noindex** pages; `verify:sitemaps --verify` green | build output, `--verify` line |
| Content: **233 topics**, **2,796 flashcards**, **29 paper sets = 14 free (set 1) + 15 premium** (14× set 2, 1× set 3), **5.7 MB** of topic/paper JSON | filesystem + JSON parse |
| The registry is **one eager module**: 233 static `import … from './data/topics/…'`, with `subjects`/`papers` as module-scope values reachable from the exported accessors — so **no import can be tree-shaken** | `src/content/registry.ts` |
| Client entry points into the whole bank: `HomePageClient.tsx` (`getSubjects`), `progress/page.tsx` (`getSubjects`), `SubjectPageClient.tsx` (`getSubject`), plus quiz/flashcards/study/diagnostics/mixed-review via `src/lib/*` | `grep -rln "content/registry"`, cross-checked for `'use client'` |
| `src/lib/courses.ts` alone has **12 importers, 4 of them client components** (`PaperRunnerClient`, `ExamRunnerClient`, `LadderRunnerClient`, `LadderOverviewClient`) | `grep -rl "@/lib/courses"` |
| **Already enforced server-side:** AI-mark quota, subscription tier, progress identity, session resolution | `src/lib/{entitlements,subscriptions,progress}/` |
| **`LockedFeature` is honest about being cosmetic** | `docs/entitlement-policy.md` "Enforcement constraint"; `src/components/LockedFeature.tsx` |
| The SW already refuses to cache anything under `/api/` | `public/sw.js` → `if (url.pathname.startsWith('/api/')) return;` |

**Conclusion.** Today a premium subscription buys convenience and freshness, not exclusivity. A
single public URL that the homepage itself loads contains every premium mark scheme, and the same
content is separately readable from each premium page with no session.

---

## 3. Why not full SSR (Option B, rejected)

True per-request rendering of premium routes is the strongest *structural* answer, but:

- **The ceiling is identical** (§8). A subscriber receives the content either way; SSR changes the
  delivery mechanism, not what an entitled browser can copy.
- **The cost is the hosting model.** `output: 'export'` is load-bearing across `build-static.sh`
  (which stashes `src/app/api/`), the S3 + CloudFront + URL-rewrite-Function topology,
  `scripts/serve-static.ts`, `test:e2e:static`, `verify:sitemaps --verify` and the hand-rolled SW.

Option B remains the documented later migration (see `docs/future-tech-stack-evolution.md` §2.2 and
its 2026-08-14 decision to stay static). Revisit it only if the residual exposure in §8 turns out to
matter commercially — that is a data question, not a code question.

**Hybrid (static public + Lambda-SSR for `/papers/*` and `/exams/*`) was also rejected**: two origins
and a permanently split routing story, for the same ceiling.

---

## 4. Target design

```
  /, /subjects,       ───▶  S3 static export
  study pages                indexable content: notes page bodies ONLY (the SEO funnel)
                             everything else: shell + metadata

  quiz / flashcards /
  diagnostics /
  ladder 1–2 /
  paper set 1         ───▶  /api/content/public/*    edge-cached
                             questions, flashcards, composed sets
                             per-IP budget applied on ORIGIN MISSES

  paper sets 2+ /
  mock exams /
  ladder 3–5          ───▶  /api/content/premium/*   private, no-store
                             SEPARATE behaviour + SEPARATE cache policy
                             session + exam-sets-full check → not_entitled otherwise

                             ▲
                        content Lambda — topic/paper JSON bundled at build time
```

### 4.1 The forcing change: split the generated registry

`src/content/registry.ts` is one eager module, so *any* client import drags in all 233 topics and
every paper. That single fact is the 5.1 MB chunk. `scripts/generate-registry.ts` therefore emits
two modules:

- **`registry.meta.ts`** — **client-safe.** Subjects (`id/name/icon/accentColor`) and, per topic:
  `id, subjectId, title, description, stage, year?, course?, level?, strand?`. Plus paper metadata:
  `id, courseId, title, durationMinutes, questionCount, totalMarks`.
- **`registry.content.ts`** — **server-only.** All 233 JSON imports (notes, flashcards, questions,
  templates) and paper questions + mark schemes. Imported by server page components and by the
  content Lambda; **never** by a client component.

Four fields beyond the obvious metadata are **forced by existing consumers** — do not drop them:

| Field | Forced by |
|---|---|
| `flashcardIds[]` | `getCardStats` iterates `topic.flashcards` for ids only, feeding the homepage "due today" card and `/progress`. 2,796 ids ≈ 78 KB — cheap, and cheaper than inferring ids from the `<topicId>-f<n>` convention (which no validator enforces) |
| `questionCount` + `totalMarks` | `metaForPaperSet` builds its description from `paper.questions.length` + summed marks |
| `stage` / `year` / `course` / `level` / `strand` | `filterTopics` and `COURSES.matches` filter on taxonomy, not content |

`src/lib/courses.ts` moves to metadata types (its `matches` predicates only read taxonomy).

### 4.2 Premium page flow

1. The page component reads **paper metadata only** and renders a shell.
2. While entitlements are unresolved → a **neutral skeleton**, never the lock (the `LockedFeature`
   no-flash rule: a gate must not flash over content the user may be entitled to).
3. `has('exam-sets-full')` false → the tease, **no request made**.
4. true → `GET /api/content/premium/papers/<courseId>/<setId>`; 401 → login prompt + tease.

### 4.3 Service worker

Public content responses are cached (stale-while-revalidate) so offline quizzes keep working; the
premium prefix stays excluded. Cache keyed by the existing build identity (`NEXT_PUBLIC_BUILD_ID` /
`out/version.json`) so a content fix is not pinned in a user's Cache Storage. Cache *strategy*
changes here → `CACHE_VERSION` bump (per `AGENTS.md`, exactly what that constant is for).

---

## 5. Phases

### Phase 1 — kill the bulk artifact, close the anonymous leak

- [ ] Split the registry (§4.1); `scripts/generate-registry.ts` emits both modules; update
      `tests/unit/content-registry.test.ts` and `content-schema.test.ts`, which assert the current
      single-module shape.
- [ ] Thread `TopicMeta`/`SubjectMeta` through the client surfaces; content-typed modules become
      server-only. This is the bulk of the phase (§6.7).
- [ ] Free pages receive content as **props from their server page component** — HTML unchanged, no
      API yet, but the 5.1 MB chunk disappears.
- [ ] Premium sets: metadata shell (§4.2) + `GET /api/content/premium/papers/<courseId>/<setId>`
      gated on session + `exam-sets-full`.
- [ ] New surface, following the contact/leaderboard template end to end:
      `src/lib/content/{http-handler,deps,dummy}.ts`, the dev/e2e Next route, `lambda/content/`,
      `terraform/modules/content_api`, both CloudFront behaviours, `scripts/serve-static.ts`'s path
      map, and the `build-lambdas.sh` list (9 → 10).
- [ ] `GET /api/content/_health` asserts `topicCount > 0` — catches an esbuild that silently dropped
      the JSON, which a DynamoDB-style probe would not.

### Phase 2 — throttling and attribution

- [ ] Per-account fixed-window budget on the premium endpoint (the `octav-rate-limits` pattern);
      per-IP on misses.
- [ ] Anomaly logging when one session pulls many sets; this is what makes decision 1(b) real.
- [ ] Optional per-session marker in premium payloads for attribution — **requires a privacy-note
      change** (account-linked marker; cf. `docs/privacy-notice-draft.md` §6.3).

### Phase 3 — the bank leaves the HTML too

- [ ] `/api/content/public/*` for questions, flashcards and composed sets.
- [ ] Move composition server-side: `buildQuestionSet` + `materializeTemplates` behind the Lambda.
      The seeds are already explicit and stable (`exam:<course>:<paperId>`,
      `ladder:<course>:<level>`), so in-flight assessments do not shift; the client "New Question
      Set" reseed must pass its seed to the server.
- [ ] Quiz / flashcards / diagnostics / ladder 1–2 / paper set 1 become shells (decision 3).
- [ ] SW caches the public prefix only; `CACHE_VERSION` bump.

Phase 3 is what makes mock exams and upper ladder levels genuinely non-derivable. Until it lands,
they are recomputable from public data: `src/lib/exams.ts` and `src/lib/ladder.ts` both call
`buildQuestionSet` on the same free topic bank the quizzes use, with published seeds.

---

## 6. Gotchas, highest severity first

1. **Cache-policy collision — the one that would leak paid content site-wide.** Public content is
   edge-cached; if a premium response ever shares that policy, CloudFront serves mark schemes to
   anonymous users *from cache*, i.e. the exact bug this work exists to fix. Separate path prefixes,
   separate behaviours, separate cache policies; premium always `private, no-store`. Pin it with a
   test (the `tests/unit/subscriptions-iam.test.ts` precedent).
2. **RSC twin serialisation.** Passing a whole `paper` object to a client component re-serialises the
   mark schemes into **both** the HTML and the `.txt` payload. Shells pass metadata only.
3. **SW cache staleness.** Caching public content changes the strategy (`CACHE_VERSION` bump) and
   needs build-id keying, or a content correction never reaches returning users.
4. **Four sync points** must agree, and nothing currently forces them to:
   `build-static.sh`'s `src/app/api/` stash, `serve-static.ts`'s path→route map,
   `build-lambdas.sh`'s function list, and the terraform behaviours/behaviour ordering.
5. **`generate:registry` becomes a two-module generator**, and the registry/schema unit tests assert
   today's shape.
6. **Measurement trap: backslash escaping.** A naive `grep` for a LaTeX-bearing string from the
   parsed JSON misses, because the bundle stores `\\dfrac` where Python's `json.load` gives
   `\dfrac`. Two probes in the first revision of this note returned a false "clean". **Strip
   backslashes from both sides, or search an ASCII-only phrase**, before concluding anything about
   what is or is not in `out/`.
7. **The type-threading cost is the real bulk of Phase 1.** `Topic` (content-bearing) is the type
   threaded through client UI, including four client components that reach the bank through
   `src/lib/courses.ts`. Wide and mechanical, not deep — but not a small diff.
8. **Bundled content means content fixes ride a Lambda rebuild.** CI already rebuilds every Lambda on
   every deploy, so this is accepted; note it so nobody is surprised later.

---

## 7. Gates

**The invariant worth having** (cheap, and it covers chunks, HTML and `.txt` twins at once): for
every **premium** paper JSON, assert that none of its `markscheme`/`modelAnswer` strings appears
anywhere under `out/`. It fails the moment anyone re-serialises content, whatever the cause. Add a
companion assertion that no chunk contains a topic question stem.

Plus:

- The content Lambda's `_health` probe (which all other Lambdas already have).
- A pinned terraform/IAM test for the content module and its behaviour ordering.
- A SW guard test: the premium prefix is never cached.
- Existing gates stay green and unchanged: `generate:registry`, `validate:content`,
  `validate:illustrations*`, `audit:content`, `npm test`, `test:e2e`, `test:e2e:static`,
  `verify:sitemaps --verify`.

---

## 8. The honest ceiling (unchanged from the 2026-09-14 note)

**Nothing a browser renders can be made un-copyable.** Any scheme here is a cost multiplier, not a
lock. Realistic goals, in value order:

1. Stop the anonymous URL-guessing leak — the actual hole today.
2. Make bulk extraction rate-limited, detectable and attributable.
3. Make leaks traceable and actionable legally.
4. Never let scraping break the site for real users.

Chasing (3)-level DRM on an educational site is a bad trade; effort has a better home in content
depth. **Accepted residual exposure: an entitled subscriber can copy what they receive.** Decision 2
was taken with that accepted.

---

## 9. What this does not do

- It does not change any code yet — §5 is the queue.
- It does not drop `output: 'export'`, split the codebase across origins, or move to a serverful
  deployment (§3).
- It does not lock down free content as a secrecy measure: free content stays public by design
  (decision 5 is a throttling measure, not a paywall).
- It does not propose DRM, obfuscation, canvas rendering, screenshot blocking or per-page
  watermarks — all of which harm legitimate users more than they harm scrapers.