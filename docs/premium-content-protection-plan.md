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
> **Second decision round 2026-09-16** (owner answers, recorded in §1.1): free surfaces stay exactly as
> they are, mixed review gets the only public content endpoint, Phase 1b covers paper sets 2+ only,
> and the free bank does **not** leave the HTML (Phase 3 withdrawn). §4.4 is the module-by-module
> split decision that Phase 1a executes.
>
> **Decisions: §1 · Measurements: §2 · Why not full SSR: §3 · Target design: §4 (split decisions §4.4) ·
> Phases: §5 · Gotchas: §6 · Gates: §7 · Ceiling: §8 · Not doing: §9**

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

### 1.1 Follow-up decisions (2026-09-16, second round)

| # | Question | Decision |
|---|---|---|
| 7 | **What stays free** | **Everything that is free today, unchanged and prerendered**: notes, flashcards, each topic's **full** question bank (15–29 questions; **no topic has 10** — 207 of 233 have exactly 15, and the quiz serves all of them with difficulty filters), diagnostics, ladder levels 1–2 and paper set 1. No free surface is gated, throttled or re-shaped. |
| 8 | **Mixed review's data** | **One public read endpoint** (`/api/content/public/…`, edge-cached, free topics only) is the *only* runtime API for free content. Its justification is **functionality, not throttling**: mixed review composes across every topic the user has studied, so its input cannot be known at build time. Every other free surface keeps content passed at build time. |
| 9 | **Phase 1b scope** | **Paper sets 2+ only (15 sets).** Mock exams (17) and ladder 3–5 (39) stay UX-gated. They are *sampled from the free bank with published seeds*, so they remain recomputable from public data however they are delivered — that is a **content** problem (premium needs its own question pool), not a delivery one, and it is accepted here. |
| 10 | **Phase 3** | **Withdrawn.** The free bank does **not** leave the HTML: goal 1(c) is dropped, so nothing is shelled and no public content API exists for quizzes, flashcards, diagnostics, ladder 1–2 or paper set 1. Free pages keep delivered-by-build content, which is also the SEO position (decision 3's "only study pages" line is thereby narrowed to *premium only*). |
| 11 | **Re-opening prod billing** | **Not gated on this work.** The off-sale switch is an independent toggle that is testable in DEV; no phase→re-open mapping is needed while the target is a PROD-ready state (security · content richness · performance). |
| 12 | **Boundary enforcement** | The leak gate (§7) is the enforcement mechanism, **not** the `server-only` package (a new dependency for a boundary the output check already proves). Naming convention for content-bearing server modules: `*.server.ts` / `registry.content.ts`; the gate fails if any of them reaches a shipped chunk. |

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
three modules (the module-by-module reasoning is §4.4):

- **`registry.meta.ts`** — **client-safe.** Subjects (`id/name/icon/accentColor`) and, per topic:
  `id, subjectId, title, description, stage, year?, course?, level?, strand?`. Plus paper metadata:
  `id, courseId, title, durationMinutes, questionCount, totalMarks`.
- **`registry.content.ts`** — **server-only.** All 233 topic JSON imports (notes, flashcards,
  questions, templates). Imported by server page components (and, from Phase 1b, by the content
  Lambda); **never** by a client component except through the one lazy, temporary mixed-review chunk.
- **`registry.papers.ts`** — **server-only, premium.** Paper questions + mark schemes. Its only
  legitimate importer is the premium API handler in the content Lambda.

Four fields beyond the obvious metadata are **forced by existing consumers** — do not drop them:

| Field | Forced by |
|---|---|
| `flashcardIds[]` | `getCardStats` iterates `topic.flashcards` for ids only, feeding the homepage "due today" card and `/progress`. 2,796 ids ≈ 78 KB — cheap, and cheaper than inferring ids from the `<topicId>-f<n>` convention (which no validator enforces) |
| `questionCount` + `totalMarks` | `metaForPaperSet` builds its description from `paper.questions.length` + summed marks |
| `stage` / `year` / `course` / `level` / `strand` | `filterTopics` and `COURSES.matches` filter on taxonomy, not content |

`src/lib/courses.ts` stays client-safe and its `matches` predicates keep reading taxonomy only; what
changes is that `getCourseTopics` takes the topic list instead of fetching it (§4.4).

### 4.4 Module split decisions (Phase 1a's work list)

Measured from the code, not from the type names. "Client-safe" means the module may be imported by a
`'use client'` file; "server" means it may not, and the gate in §7 proves it stayed out of the bundle.

| Module | Today | Decision | Client transport after the split |
|---|---|---|---|
| `src/content/registry.ts` | one eager module, 233 static JSON imports, 266 imports total | **Split three ways** by the generator: `registry.meta.ts` (subjects + topic metadata + `flashcardIds` + paper metadata) · `registry.content.ts` (topic notes/flashcards/questions/templates) · `registry.papers.ts` (paper questions + markschemes) | meta imported directly by clients; content arrives as props (§4.1) |
| `src/lib/courses.ts` (12 importers, 4 client) | `COURSES`/`getCourse` are pure metadata, but `getCourseTopics(course)` calls `getSubjects()` internally | **Stays client-safe; make it pure**: `getCourseTopics(topics, course)` | callers pass the topic list they already hold (metadata callers pass meta topics, composers pass content topics) — **no new module** |
| `src/lib/question-sets.ts` (`buildQuestionSet`) | imports `courses` → registry | **server-only** (`question-sets.server.ts`); it is composition, and every consumer is a composer (below) | n/a — never imported by a client |
| `src/lib/exams.ts` | definitions + `buildExamQuestions` mixed in one file | **Split**: `ExamPaper` definitions, `getExamPapers`, `getExamCourses`, `examId` stay client-safe; `buildExamQuestions` moves to `exams.server.ts` | `papers/[courseId]/[paperId]/page.tsx` composes at build time and passes the question array to `ExamRunnerClient` (seed `exam:<course>:<paperId>` is deterministic, so the built page is stable) |
| `src/lib/ladder.ts` | same shape | **Split**: `LADDER_LEVELS`, `getLadderLevel`, `isLevelUnlocked` (pure over a progress record) stay; `buildLadderQuestions` → `ladder.server.ts` | `ladder/[level]/page.tsx` composes → props to `LadderRunnerClient`. Levels 1–2 are free **and indexable**, so their content legitimately lands in HTML |
| `src/lib/diagnostics.ts` | same shape | **Split**: `DIAGNOSTIC_*`, `getDiagnosticCourse(s)` stay; `buildDiagnosticQuestions` → `diagnostics.server.ts` | `diagnostics/[courseId]/page.tsx` composes → props to `DiagnosticRunnerClient` (free + indexable, same as ladder 1–2) |
| `src/lib/mixed-review.ts` | types + `buildMixedReviewQuestions` (calls `getSubjects` + weak-topic analysis) | **Split**: `MixedReviewQuestion` type and the band/count constants stay client-safe (they are imported as *types* by exam/ladder/diagnostic clients, which is erased anyway); the builder moves behind the **public endpoint** (decision 8) | `MixedReviewClient` → `GET /api/content/public/mixed-review?topicIds=…`; until that endpoint exists (Phase 1b) the client keeps a **lazy code-split** import of the free-topic content module so the other 885 pages stay light |
| `src/lib/flashcard-scheduler.ts` (`getCardStats`, `getDueTopics`) | already argument-driven, but takes a whole `Topic` | **No module split**: it reads only `flashcards[].id`/`id`/`title`/`subjectId`/`length` | feed it `TopicMeta` (registry.meta carries `flashcardIds` and `flashcardCount`) — the caller adapts, not the signature |
| `src/lib/generators.ts` (`materializeTemplates`) | needs `topic.templates` + `@/content/generators` code | **Unchanged**: the generator *definitions* are code (a few KB), not content | templates arrive with the topic props; the quiz's "New Question Set" reseed stays client-side over its own topic |
| `src/lib/seo/{assessments,hubs}.ts` | call `getCourseTopics` for `topicCount` / first-topic copy | **Unchanged** once `getCourseTopics` is pure | pass metadata topics (counts and titles only) |

Two consequences worth stating before anyone starts:

- **Phase 1a needs no Lambda and no API.** Composition moves to build time for every free surface; mixed
  review is the one exception and it is handled by a temporary lazy chunk until Phase 1b's public route.
- **The paper content module (`registry.papers.ts`) must have exactly two importers**: the premium API
  handler in the content Lambda, and nothing under `src/app/**` that renders a client component. The
  premium shell page reads *metadata only*. This is what the §7 gate asserts.

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

### Phase 1a — LANDED 2026-09-16 (`5a7bbab` + `f7ab115`) — the split and the props

The whole of §4.4, in one independently testable commit. Ships the performance win and closes the
anonymous premium leak in HTML and `.txt`; it changes nothing a user can see.

- [x] `scripts/generate-registry.ts` emits three modules (§4.4): `registry.meta.ts`,
      `registry.content.ts`, `registry.papers.ts`. Update `tests/unit/content-registry.test.ts` and
      `content-schema.test.ts`, which assert today's single-module shape.
- [x] Make `getCourseTopics(topics, course)` pure; `courses.ts` stays client-safe.
- [x] Split `exams/ladder/diagnostics/mixed-review` per §4.4; `question-sets.ts` becomes server-only.
- [x] Move composition into the three runner pages (`exams/[courseId]/[paperId]`,
      `exams/[courseId]/ladder/[level]`, `diagnostics/[courseId]`) and pass the composed array as props.
- [x] Free pages receive content as props from their server page component
      (`study`, `quiz`, `flashcards`, `papers/<set>`). Note the two HTML outcomes, both acceptable:
      pages whose client component calls `useSearchParams` (quiz, mixed review) still prerender the
      Suspense fallback, while the others (study, papers, diagnostics, ladder) render the content into
      HTML — free content is public, and for the indexable ones (diagnostics, ladder 1–2, set 1) more
      crawlable text is a gain, not a loss.
- [x] Mixed review: lazy code-split import of the free-topic content module as the interim transport
      (Phase 1b replaces it with the public route).
- [x] Premium sets stayed on their existing delivery in 1a **on purpose**: a metadata-only premium
      page with no API would show a tease or a dead skeleton to an *entitled* subscriber, so the shell
      and its endpoint landed together in 1b (`PremiumPaperShell`).
- [x] `npm run audit:leaks` (§7) written, green, and wired into CI.

### Phase 1b — LANDED 2026-09-16 (`src/lib/content/*`, `lambda/content`, `modules/content_api`)

- [x] New surface, following the contact/leaderboard template end to end:
      `src/lib/content/{types,http-handler,deps,dummy,dynamodb-storage}.ts`, the dev/e2e Next
      catch-all route, `lambda/content/`, `terraform/modules/content_api` (10th Lambda; content
      BUNDLED, so no content table and the smallest IAM in the repo), **three** CloudFront behaviours
      (`premium/*` caching disabled, `public/*` edge-cached, `content/*` catch-all) with **separate**
      cache policies (gotcha 1), `scripts/serve-static.ts` prefix branch, `build-lambdas.sh` 9 → 10.
- [x] `GET /api/content/premium/papers/<courseId>/<setId>` — session + `exam-sets-full`, `private,
      no-store`; 401 anonymous, 403 free tier, 404 unknown set.
- [x] `GET /api/content/public/mixed-review/<seed>[/<topicIds>]` — free topics only, edge-cached,
      per-IP budget on **origin misses** (decision 5); seed AND ids ride the PATH, because the managed
      CachingOptimized policy ignores query strings (a query-string contract would serve one user's
      draw to the next). `MixedReviewClient` is wired to it and the lazy chunk is gone.
- [x] `GET /api/content/_health` asserts `topicCount > 0` and returns `"ok":true` (the body field is
      what keeps the probe path-discriminating).
- [x] **Measured outcome:** `audit:leaks` HARD went 60 files → **0** and TIGHTENED is green; the
      chunks loaded by `index.html` are 1.20 MB across 12 chunks, and the whole chunks directory fell
      from 6.49 MB to **1.85 MB** (the mixed-review lazy chunk is gone too). `audit:leaks` now runs
      inside `build:static`, so both deploys carry the gate.

### Phase 2 — throttling and attribution — LANDED 2026-09-18

- [x] Per-account fixed-window budget on the premium endpoint (the `octav-rate-limits` pattern).
      Keyed by ACCOUNT, not IP — a paid puller is authenticated, so the IP is the one thing they can
      rotate. `incrementContentRequestCount` now takes a scope (`content:ip:<ip>` / `content:acct:<id>`)
      and returns the window count, so no new IAM grant was needed. The budget is charged only after
      the paper lookup, so a repeated 404 cannot spend a student's window; the 429 carries
      `quota_exceeded` + `resetAt` and still slides the session cookie (the AI-mark quota precedent).
      The public route's per-IP-on-origin-misses budget (already live since 1b) is untouched.
- [x] Anomaly logging when one account pulls many sets: ONE attributable warning per account per
      window at `CONTENT_PREMIUM_ANOMALY_THRESHOLD` = 10, below the 30/hour budget, so a sweep is
      visible while it is happening rather than only once refused. **Honest ceiling:** it counts
      requests, not distinct sets — the premium corpus is 15 sets, so a full sweep is 15 requests.
      Read the line as "crossed N deliveries this hour". Storing the set ids per window is the upgrade
      if an incident ever needs the stronger claim.
- [x] **Per-session marker in premium payloads for attribution — LANDED 2026-09-18**, i.e. the
      leak-tracing half of decision 1(b)+(3). The premium payload carries
      `attribution: { issuedTo, ref, issuedAt }` and the runner shows `Issued to m***@example.com ·
      18 Sep 2026 · ref 7f3k9q2ab1` in the question flow and on the results screen. Design points
      worth keeping: `issuedTo` is masked because a screenshot must not carry a student's full
      address; `ref` is a truncated `sha256(userId)` so tracing means hashing `octav-users` — no new
      table, no new IAM, no retention row to disclose; free set 1 is unmarked. The privacy notice
      moved WITH the code (§6.5 describes the marker, §9 states nothing is stored, checklist item 15
      is the re-check) — edit them together. **The ceiling, stated in both places:** a determined
      leaker can crop the line, so this buys attribution for an unscrubbed copy and the deterrence of
      being visible. It is not DRM and must not be sold as one (§8).

### Phase 3 — WITHDRAWN (decision 10)

Goal 1(c) is dropped: the free bank stays in the HTML, so there is no public content API for
questions, flashcards, diagnostics, ladder 1–2 or paper set 1, no shell conversion and no SW cache
strategy change for them. Only phases 1–2 remain.

What this leaves undone, stated plainly so it is a decision rather than an oversight: mock exams and
ladder 3–5 are recomputable from public data (`exams.ts`/`ladder.ts` call `buildQuestionSet` over the
free topic bank with published seeds). Their delivery is now uniform — premium paper sets are the
gated surface — but secrecy is not. The fix, if it is ever wanted, is **content**: a premium-only
question pool those surfaces sample instead of the free bank. That is authoring work, not
architecture, and it is out of scope here (see §8's ceiling).

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
7. **The type-threading cost is the real bulk of Phase 1a.** `Topic` (content-bearing) is the type
   threaded through client UI, including the client components that reach the bank through
   `src/lib/courses.ts` and the four composers (§4.4). Wide and mechanical, not deep — but not a
   small diff; it is why 1a and 1b are separate commits.
8. **Bundled content means content fixes ride a Lambda rebuild.** CI already rebuilds every Lambda on
   every deploy, so this is accepted; note it so nobody is surprised later.

---

## 7. Gates

**The invariant worth having** (cheap, and it covers chunks, HTML and `.txt` twins at once): for
every **premium** paper JSON, assert that none of its `stem`/`markscheme`/`modelAnswer` strings
appears anywhere under `out/`. It fails the moment anyone re-serialises content, whatever the cause.

Implementation notes that are not optional:

- **Escape-insensitive comparison** (gotcha 6): strip backslashes from *both* sides. A plain grep for
  a LaTeX-bearing string measured **0 of 28** hits where the real figure was **21 of 28** — two probes
  in the first revision of this note returned a false "clean" that way.
- **Sample windows across each line, not just at its start**, and subtract the free corpus by
  *substring occurrence*. Both errors were found by running the gate on a real build: line-start-only
  windows made a sentence shared mid-paragraph between a free topic and a premium paper read as a
  premium-only leak (the topic's line begins elsewhere), and subtracting windows rather than
  occurrences kept that false positive alive. `scripts/audit-leaks.ts` now does both correctly, and
  `tests/unit/audit-leaks.test.ts` pins each one.
- **Two tiers, because the mixed-review lazy chunk legitimately carries free topic stems**: (a) HARD —
  no premium paper string anywhere under `out/`; (b) TIGHTENED — the chunk referenced by
  `out/index.html` (the site-wide one) must contain no topic question stem either **and must stay
  under 1 MB**, which is the tripwire for the 4.8 MB regression returning.
- **Run it as `npm run audit:leaks`, not as a library test**: it needs a built `out/`, so it belongs
  beside `verify:sitemaps` in the deploy path. Wire it into CI **in the Phase 1a commit**, once it is
  green; until then it is a measurement tool that reports the failing baseline.

Plus:

- **Phase 2's own gates:** `tests/unit/content-handler.test.ts` covers the budget (N deliveries then 429
  with `resetAt`, refusals do NOT advance the counter and report the cap — the DynamoDB conditional
  update's exact semantics, so the dummy cannot drift), that 401/403/404 spend nothing, that the budget
  is per ACCOUNT not per IP, and that the anomaly warning fires exactly once per window with the
  account id in it. `tests/unit/content-iam.test.ts` pins the ordering (budget AFTER the paper lookup)
  and that the route uses the account scope. The 429 card is captured by `scripts/capture-content-ux.mjs`
  (`premium-set-429-*`), which is how the UX-review pass can see it at all.

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
- It does not decide when prod billing re-opens (decision 11): the switch is a toggle, testable in DEV.
- It does not protect mock exams or ladder 3–5 from derivation, and it does not gate them server-side
  (decision 9) — they are sampled from the free bank, so secrecy would need a premium-only question
  pool.
- It does not drop `output: 'export'`, split the codebase across origins, or move to a serverful
  deployment (§3).
- It does not lock down free content as a secrecy measure: free content stays public by design
  (decision 5 is a throttling measure, not a paywall).
- It does not propose DRM, obfuscation, canvas rendering, screenshot blocking or per-page
  watermarks — all of which harm legitimate users more than they harm scrapers.