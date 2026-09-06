# S6 — IGCSE Pilot: Cambridge Maths 0580 (implementation plan)

Status: **plan only, nothing landed.** Owner queue item 8 (PROGRESS.md standing queue).
Decisions locked 2026-09-06 with the user (see §0). Supersedes the one-line "pilot IGCSE
Maths 0580" note in `docs/seo-technical-plan.md` §5 (S6 row).

---

## 0. Locked decisions

| # | Decision | Value |
|---|----------|-------|
| 1 | Surface | **Full course parity** — study layer + `math-igcse` in `courses.ts` (diagnostics, mock exams, ladder derive automatically) + 2 authored free-response paper sets |
| 2 | Size | **~10 topics** spanning all five 0580 strands (Number, Algebra, Geometry & Measure, Statistics, Probability) |
| 3 | `level` tagging | **Omit unless tier-specific** — schema permits omitting `level` for igcse (`validate:content` only enforces `core/extended ⇒ igcse`); tag `extended` only on genuinely Extended-only topics |
| 4 | Authoring | **Original content, subagent swarm** (the 5-course papers rollout pattern): parallel authors, parent owns registry/order/specs/gates |
| 5 | Subject | Maths only, course code `0580` (Cambridge). Other IGCSE subjects are out of scope (§8) |

Everything else inherits existing policy — do **not** re-litigate: entitlements split
(free study; first paper set free, sets 2+ premium; ladder 1–2 free, 3–5 premium) comes
from `src/lib/entitlements/exam-access.ts` automatically once the course exists; SEO
indexability (study leaves index, quiz/flashcards noindex+follow) comes from
`src/lib/seo/meta.ts`; JSON-LD course nodes come from `courseCodeFor`.

---

## 1. What already exists (do not rebuild)

- **Schema**: `stage: 'igcse'`, `course: '0580'`, `level: 'core'|'extended'` (optional for
  igcse) — `src/content/schema.ts:16,32-34`; `validate:content` enforces
  `course` required for igcse and `core/extended ⇒ igcse`.
- **ID convention**: `<subject>-igcse-<slug>` (e.g. `bio-igcse-enzymes`) — `docs/CONTENT_STYLE.md:44`.
- **SEO tier**: `src/lib/seo/curriculum.ts` — label `IGCSE`, hubTitle `International GCSE`,
  credential `Cambridge International GCSE (9–1)`, `courseCodeFor` → `MATH-IGCSE-0580-<SLUG>`.
- **Sitemap**: `scripts/generate-sitemaps.ts` auto-promotes a tier to "live" the moment it
  has ≥1 topic (`liveTiers`); empty tiers get no hub/sitemap/index entry. **No generator change.**
- **Hub helpers**: `src/lib/seo/hubs.ts` is fully tier-parameterised (`tierSubjects('igcse')`
  works today, returns `[]`).
- **Subject page**: `groupTopicsByStage` already emits an `IGCSE` group between KS3 and DP.
- **Exams/diagnostics/ladder**: all derive from `COURSES` + the topic question pool
  (`src/lib/{exams,diagnostics,ladder}.ts`). `papersFor()` gives math courses 2 mock papers
  automatically (30 min each).

## 2. What is missing (the actual work)

1. **Content**: 0 igcse topics. 10 topic JSONs + `order.json` entries.
2. **Hub routes**: `src/app/igcse/page.tsx` + `src/app/igcse/[subjectId]/page.tsx` do not
   exist (ks3/ibdp do). **Ordering trap:** these and the content must land in the SAME
   commit — topics without routes make `verify:sitemaps` fail on 404 hub URLs; routes
   without topics make it fail on "indexable page not in any sitemap" (the empty hub is
   indexable but the tier is skipped). There is no green intermediate state.
3. **Course entry**: `math-igcse` in `src/lib/courses.ts` (comment there already says
   "Add IGCSE entries here when content lands").
4. **Practice papers**: `src/content/data/papers/math-igcse/math-igcse-set-{1,2}.json`
   (8 questions, exactly 20 marks, `marks === markscheme.length`, ≥5 distinct topics,
   3 easy/3 medium/2 hard ramp — `docs/CONTENT_STYLE.md` "Practice papers").
5. **Hardcoded counts** in tests (see §6).

---

## 3. Content spec — the 10 pilot topics

Per-topic standard (unchanged): **7 notes / 12 flashcards / 15 questions**, every question
difficulty-tagged, no literal `$` outside KaTeX delimiters (math content: fullwidth `＄`
for money), KaTeX `$$` blocks one per line (the `multi_display_math` audit rule).

Proposed list (strand coverage 3/3/2/1/1; parent may swap a topic during Phase B if a
swarm draft fails review — strand balance must survive):

| id | strand focus | level | scope notes |
|----|--------------|-------|-------------|
| `math-igcse-fractions-decimals` | Number | omit | operations, mixed numbers, recurring↔fraction |
| `math-igcse-percentages` | Number | omit | % of, increase/decrease, simple reverse-free change |
| `math-igcse-bounds` | Number | **extended** | upper/lower bounds, operations with bounds (Extended-only in 0580) |
| `math-igcse-algebraic-manipulation` | Algebra | omit | expand, factorise (linear + simple quadratic), simplify |
| `math-igcse-equations-simultaneous` | Algebra | omit | linear, simultaneous (elimination/substitution) |
| `math-igcse-quadratics` | Algebra | **extended** | formula + completing the square (Extended-only methods) |
| `math-igcse-angles-polygons` | Geometry & Measure | omit | angle rules, interior/exterior sums |
| `math-igcse-area-volume` | Geometry & Measure | omit | compound areas, prism/cylinder volume, surface area |
| `math-igcse-statistics-averages` | Statistics | omit | mean/median/mode/range incl. frequency tables |
| `math-igcse-probability` | Probability | omit | single events, complementary, possibility spaces |

`order.json`: insert the 10 ids as one contiguous block **after the KS3 block and before
the DP topics** in `src/content/data/topics/math/order.json`, in the table's order
(Number → Algebra → Geometry → Statistics → Probability). Display grouping is re-derived
by `groupTopicsByStage`; order.json only fixes sequence within the IGCSE group.

## 4. Code changes (parent-owned, Phase B)

1. `src/app/igcse/page.tsx` — copy `src/app/ks3/page.tsx`, tier `'igcse'`, copy:
   h1 `IGCSE revision`, intro naming International GCSE illustrated notes/flashcards/quizzes.
2. `src/app/igcse/[subjectId]/page.tsx` — copy the ks3 twin, tier `'igcse'`
   (`generateStaticParams`/`generateMetadata`/`tierSubject` all take the tier arg already).
3. `src/lib/courses.ts` — append
   `{ id: 'math-igcse', title: 'Math — IGCSE 0580', matches: (t) => t.subjectId === 'math' && t.stage === 'igcse' && t.course === '0580' }`.
4. Papers JSONs (§2.4).
5. Test count updates (§6).
6. **No** changes to: sitemap generator, hubs.ts, curriculum.ts, entitlements, schema,
   robots.ts, hreflang (H0 stays), JSON-LD renderer.

## 5. Phases

**Phase A — swarm authoring (children, parallel).** 5 children × 2 topics each. Each child
writes ONLY its `src/content/data/topics/math/math-igcse-*.json` files (disjoint filenames,
no shared-file races). Child prompt carries: CONTENT_STYLE.md standard, the table row for
its topics (scope + level), the KaTeX `$$`-one-per-line rule, fullwidth `＄` rule,
difficulty tags on all 15 questions, "do not touch order.json / registry / specs /
courses.ts / papers". Children return a per-topic summary (strand, level, question
difficulty mix) for parent review.

**Phase B — integration (parent).** Review drafts against scope; `order.json` block;
`npm run generate:registry`; papers sets; `courses.ts`; the two route files; test counts.

**Phase C — gates (parent).** In order:
`generate:registry` → `validate:content` → `audit:content` (fails on warnings) →
`validate:illustrations` + `validate:illustration-layout` (no new SVGs required —
illustrations stay a separate backlog item, 90/217) → `npm test` → `tsc --noEmit` →
`eslint` on touched files → e2e `--workers=1` Desktop Chrome + iPhone SE (full suite;
counts moved) → `npm run build:static` (includes `verify:sitemaps`; expect **323**
indexable = 311 + 10 study leaves + `/igcse` + `/igcse/math`) → **standing UX-review pass**
on the two new hub pages (375px + desktop, light + dark; fresh-context subagent per
AGENTS.md — record waiver with reason only on infra failure).

**Phase D — ship.** Commit on `develop` (single commit: content + code + counts, because
of the §2.2 ordering trap) → push → CI `deploy-dev` (live SEO verification dev adapts
automatically) → `verify:seo:live --env=dev` spot-check the two hubs → normal
develop→main promotion cadence → prod `verify:seo:live --all` (now 323 URLs).

**Rollback:** revert the single commit; tier returns to empty and the sitemap leg
disappears on the next deploy (generator skips empty tiers).

## 6. Test/count churn checklist (exact numbers computed in Phase B)

- `tests/unit/content-registry.test.ts` — total topics 217 → 227; math subject count +10.
- `tests/unit/content-schema.test.ts` — topic/subject counts.
- `tests/e2e/app.spec.ts` — subject-page topic counts / any total-topic assertion.
- `tests/e2e/diagnostics.spec.ts` — courses 13 → 14.
- `tests/e2e/exams.spec.ts` — mock papers 17 → 19 (`papersFor` gives math courses 2);
  paper-set rows 26 → 28; premium/lock rows +1 course.
- `tests/e2e/papers.spec.ts` — set rows 26 → 28, set-2 previews 13 → 14, teases 13 → 14.
- `tests/unit/seo.test.ts` — `courseCodeFor` uniqueness sweep covers the new codes
  automatically; hub-related expectations if any enumerate tiers.
- Sitemap expectations anywhere they are asserted (311 → 323).

## 7. Verification evidence to record in PROGRESS.md

Gate outputs from Phase C verbatim counts; UX pass result or waiver reason; dev + prod
`verify:seo:live` results; the new indexable total (323).

## 8. Out of scope (deliberate)

- Other IGCSE subjects (biology 0610, chemistry 0620, physics 0625, english 0500) — the
  pipeline proof is the pilot; subjects follow once this ships green.
- BBC GCSE Bitesize scraper extension — reference-only value, tooling cost now.
- IGCSE illustrations — joins the standing illustrations backlog (90/217).
- Extended-only deep topics beyond the two tagged above.
- hreflang/robots/JSON-LD changes — none needed.

## 9. Risks / known traps

1. **The §2.2 ordering trap** (routes vs content same commit) — the only way
   `verify:sitemaps` stays green.
2. **KaTeX `$$`-on-one-line** — the `multi_display_math` audit rule catches it; swarm
   prompts must carry the rule or Phase B eats rework.
3. **`String.replaceAll` with `$$` in the replacement** corrupts content (2026-09-05
   incident) — parent scripts use function replacers.
4. **Difficulty mix** — mocks sample `{easy:5, medium:9, hard:6}` per math paper from the
   course pool; 10 topics × 15 questions must supply enough of each band or exam sampling
   under-fills (sampler behaviour: check `buildQuestionSet` shortfall handling in Phase C).
5. **Title width budget** — leaf titles are brand-free absolutes; hub/subject metadata
   goes through `pageMeta` + display-cell budget (CJK n/a here). Audit catches overflow.
6. **Swarm races** — children forbidden from shared files (the papers-rollout precedent);
   parent regenerates registry + edits counts exactly once.
