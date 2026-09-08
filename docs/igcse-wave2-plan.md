# IGCSE Wave 2 — Maths 0580 deepening (implementation plan)

Status: **plan only, nothing landed.** Follows the shipped S6 pilot
(`docs/igcse-pilot-plan.md`, live in prod since 2026-09-07: 10 topics, `/igcse` hubs,
`math-igcse` course, 2 paper sets). Wave 2 inherits every mechanism the pilot built —
no route, schema, sitemap, hubs, or courses.ts changes are needed.

---

## 0. Locked decisions (user questionnaire, this session)

| # | Decision | Value |
|---|----------|-------|
| 1 | Scope | **Maths 0580 only.** Other IGCSE subjects (0610/0620/0625/0500) stay out of scope — wave 3 candidates. |
| 2 | Topics | **The 5 named strands** from the PROGRESS queue: circle theorems, trigonometry, vectors, functions, histograms. |
| 3 | Trig split | **Two topics** — `math-igcse-trigonometry` (right-angled, level omitted) + `math-igcse-trig-advanced` (sine/cosine rules, 3D, `extended`). A mixed Core/Extended topic can't carry one honest `level` tag (pilot decision #3). |
| 4 | Extras | **Paper set 3** (`math-igcse-set-3`, auto-premium via `isFreePaperSet`). Illustrations NOT included — wave-2 topics join the standing backlog (100 → 106). |

Net deliverable: **6 new topic JSONs + 1 new paper set** (227 → 233 topics, 28 → 29
papers, 328 → 334 indexable URLs).

## 1. Verified facts (this session — do not re-derive)

- **Syllabus tagging** (Cambridge 0580 syllabus 2025–2027, `662466-2025-2027-syllabus.pdf`):
  functions/inverse (E2.13), non-right-angled trig incl. sine & cosine rules (E6.4/E6.5),
  circle theorems, vectors, and histograms are all **Extended supplement** content.
  Right-angled trig (SOHCAHTOA, elevation/depression) and Pythagoras are **Core**.
- **`math-igcse` matcher already covers wave 2**: `courses.ts:36` matches on
  `subjectId==='math' && stage==='igcse' && course==='0580'` — new topics flow into
  diagnostics/exams/ladder/mocks automatically. **No courses.ts change.**
- **Hub meta descriptions are dynamic** (`hubs.ts:79` computes the topic count) — the
  `/igcse` copy updates itself; the regression tests only assert "IGCSE" ∈ description.
- **Mock sampling is safe**: `STANDARD_MIX {easy:5, medium:9, hard:6}` /
  `HARD_MIX {3,8,9}` per paper (`exams.ts:17-18`); 16 topics × 15 questions = 240 in
  the pool — no shortfall risk.
- **LATENT DEFECT FOUND**: `math-igcse-set-2.json` totals **21 marks** (2+2+2+2+2+3+4+4),
  violating CONTENT_STYLE.md:101 "exactly 20 marks". All 27 other sets total 20.
  `scripts/validate-content.ts` has **no total-marks rule** — that's why the pilot gate
  passed it. Fixed in Phase 0 below.
- **Count-churn sites** (exact lines enumerated in §7). `tests/e2e/diagnostics.spec.ts`
  does NOT change (still 14 courses).

## 2. What changes / what does NOT

**Changes:**
1. 6 topic JSONs in `src/content/data/topics/math/` (swarm-authored).
2. `order.json` — IGCSE block grows 10 → 16, interleaved by strand (§3).
3. `src/content/data/papers/math-igcse/math-igcse-set-3.json`.
4. `scripts/validate-content.ts` — two new hard-error rules (§5, Phase 0 commit).
5. `math-igcse-set-2.json` — 21 → 20 marks (Phase 0 commit).
6. Test counts (§7).
7. `src/content/registry.ts` — regenerated, never hand-edited.

**No changes:** routes, schema, `courses.ts`, sitemap generator, `hubs.ts`,
`curriculum.ts`, entitlements, robots, hreflang, JSON-LD, illustrations.

## 3. Content spec — the 6 topics

Per-topic standard (unchanged): **7 notes / 12 flashcards / 15 questions**, every
question difficulty-tagged, fullwidth `＄` for money, `\pounds` inside KaTeX, KaTeX
`$$` blocks one per line, no singleton `variantOf` groups, seeded per-question choice
shuffle (never all `correctIndex=0`), no control characters in any string.

| id | strand | level | scope | overlap guards |
|----|--------|-------|-------|----------------|
| `math-igcse-functions` | Algebra | **extended** | f(x) notation, domain/range, composite fg(x), inverse f⁻¹(x), mapping diagrams | NOT differentiation (0580 has it but wave 2 excludes); distinct from `math-dp-ai-functions` — descriptions must say IGCSE, never IB |
| `math-igcse-circle-theorems` | Geometry & Measure | **extended** | angle at centre = 2× circumference, same segment, angle in semicircle, cyclic quadrilaterals, tangent⊥radius, two tangents from a point, alternate segment | — |
| `math-igcse-trigonometry` | Geometry & Measure | omit (Core) | SOHCAHTOA right-angled, angles of elevation/depression, exact values (sin/cos 0,30,45,60,90; tan 0,30,45,60) | Pythagoras is a prerequisite reference only (`math-pythagoras-myp` exists); bearings stay out (`math-yr7-bearings-scale`) |
| `math-igcse-trig-advanced` | Geometry & Measure | **extended** | sine rule, cosine rule, area = ½ab·sin C, 3D trigonometry | requires right-angled trig; cross-link, don't re-teach |
| `math-igcse-vectors` | Geometry & Measure | **extended** | column vectors, add/subtract, scalar multiples, magnitude, position vectors, velocity, vector geometry (collinearity, ratio proofs) | distinct from `math-dp-ai-vectors` (no vector equations of lines / dot product) |
| `math-igcse-histograms` | Statistics | **extended** | frequency density, unequal class widths, area = frequency, drawing + interpreting, estimating from histograms | grouped mean/median stays in `math-igcse-statistics-averages` |

Author children must verify their scope bullets against the official syllabus PDF
(link in §1) and report any Core/Extended ambiguity to the parent instead of guessing.

**`order.json`** — replace the current 10-id IGCSE block with this 16-id sequence
(strand-neighbourhood interleaving; display grouping is re-derived by
`groupTopicsByStage`, this only fixes sequence):

```
math-igcse-fractions-decimals, math-igcse-percentages, math-igcse-bounds,
math-igcse-algebraic-manipulation, math-igcse-equations-simultaneous,
math-igcse-quadratics, math-igcse-functions,
math-igcse-angles-polygons, math-igcse-circle-theorems, math-igcse-area-volume,
math-igcse-trigonometry, math-igcse-trig-advanced, math-igcse-vectors,
math-igcse-statistics-averages, math-igcse-histograms, math-igcse-probability
```

## 4. Paper set 3

`math-igcse-set-3.json`: 8 questions, **exactly 20 marks**, `marks === markscheme.length`,
≥5 distinct topics (draw from the FULL 16-topic pool, weighted toward wave-2 topics),
difficulty ramp 3 easy / 3 medium / 2 hard, question ids `math-igcse-set-3-q<i>`,
fully-worked model answers (≥40 chars, re-derived for correctness before merge),
prose stems (InlineMath-rendered — no markdown tables), fullwidth `＄` for money.
Premium automatically: `isFreePaperSet` frees only set 1. Title `Practice Set 3`,
`durationMinutes: 30` (match sets 1–2).

## 5. Phase 0 — validator hardening + defect fix (separate FIRST commit)

Two hard-error rules in `scripts/validate-content.ts` (structural → validate, not
audit), each with a re-run as its check:

1. **Paper total marks**: every paper's `questions[].marks` sums to exactly 20.
2. **Control-char scan**: every string anywhere in topic/paper JSON is free of
   code points < 32 except `\n` (the pilot's tab-mangled `\text` defect class —
   strict-KaTeX self-checks pass it silently; PROGRESS 2026-09-06 note (1)).

Then fix `math-igcse-set-2.json` 21 → 20: drop 1 mark from the final 4-mark question
(marks 4→3, remove one markscheme point, adjust its modelAnswer) and re-run
`validate:content` to prove both rules fire correctly (deliberately break → red,
restore → green). This commit is independent of wave-2 content — it lands first and
the swarm's output is validated by the new rules from the start.

## 6. Phases

**Phase 0 — validator + set-2 fix (parent, ~30 min).** Commit 1 on `develop`.
Green gate: `validate:content` + `audit:content` + `npm test` (no count churn —
paper marks aren't asserted in tests; verify before assuming).

**Phase A — swarm authoring (children, parallel).** 3 children × 2 topics, paired
pedagogically: (trigonometry, trig-advanced), (circle-theorems, vectors),
(functions, histograms). Each child writes ONLY its two
`src/content/data/topics/math/math-igcse-*.json` files — no shared files (order.json /
registry / specs / courses.ts / papers are parent-owned). Child prompt carries: the
CONTENT_STYLE standard, its §3 table rows (scope + level + overlap guards), the
pilot's defect-guard checklist (§3 preamble), the syllabus-verification instruction,
and a per-topic return summary (strand, level, difficulty mix, worked-answer
re-derivations). **Model choice**: the pilot's flash:low children produced
structurally-perfect but defect-laden files (all-zero correctIndex, JSON-escape
corruption); use the session model or require the parent spot-check pass as
mandatory, not ceremony.

**Phase B — integration (parent).** Review drafts against §3 scope; sweep
worked answers by hand-recomputation (pilot found wrong answers the gates passed);
`order.json` block replacement (§3); `npm run generate:registry`; author set 3 (§4);
test counts (§7).

**Phase C — gates (parent).** In order:
`generate:registry` → `validate:content` (new Phase-0 rules active) →
`audit:content` (0 warnings) → `validate:illustrations` +
`validate:illustration-layout` (no new SVGs) → `npm test` → `tsc --noEmit` →
`eslint` on touched files → e2e per-project `--workers=1` Desktop Chrome + iPhone SE
(combined two-project runs trip the known shared-dummy per-IP OTP budget) →
`build:static` + `verify:sitemaps` — expect **334 indexable** (328 + 6 study leaves;
set 3 is premium → noindex, not in sitemap).

**UX pass**: the standing rule targets `src/app/**` / `src/components/**` chrome —
wave 2 adds content JSON only and no template changes, so a full 28-shot subagent
pass is **waived with that reason recorded in PROGRESS.md**; parent takes 4 spot
screenshots (one new study page × 375px/desktop × light/dark) as the artefact.

**Phase D — ship.** Commit 2 on `develop` (single commit: topics + order.json +
set 3 + counts — content and registry must move together) → push → CI `deploy-dev` →
`verify:seo:live --env=dev` spot-check (new leaves indexable, set-3 page noindex) →
develop→main ff-promotion → prod `verify:seo:live --all` (**334 URLs**).
Rollback: revert commit 2; the tier keeps 10 topics, no route/sitemap surgery needed.

## 7. Count-churn checklist (verify each at integration time — lines drift)

| file | current | wave 2 |
|------|---------|--------|
| `tests/unit/content-registry.test.ts:6` | `math: 86` | `math: 92` |
| `tests/e2e/papers.spec.ts:14` | 28 set rows | **29** |
| `tests/e2e/papers.spec.ts:20` | 14 `-set-2` links | unchanged (14) |
| `tests/e2e/papers.spec.ts:22-23` | 1 "See Premium plans", 14 premium lock rows | **check component**: if lock rows render per premium SET, 14 → 15; if per course, unchanged — compute, don't guess |
| `tests/e2e/exams.spec.ts:52` | 28 free-response links | **29** |
| `tests/e2e/app.spec.ts` math subject-page tests | — | check for IGCSE-group counts; add/adjust if asserted |
| `tests/e2e/diagnostics.spec.ts` | 14 courses | **unchanged** |
| sitemap expectations | 328 | 334 (dynamic — nothing asserts it in tests; record in PROGRESS) |

## 8. Out of scope (deliberate)

- Other IGCSE subjects — wave 3 decision after this ships green.
- Remaining 0580 gaps (ratio/proportion, indices/surds, sequences, transformations,
  scatter diagrams, differentiation, algebraic fractions, cumulative frequency,
  sets/Venn) — future waves.
- Illustrations for wave-2 topics — standing backlog (100 → 106 after this).
- Bearings/Pythagoras IGCSE topics — covered adequately by existing MYP topics.
- New hub/route/schema/entitlement work — none needed, pilot built it all.

## 9. Risks / known traps (pilot lessons carried forward)

1. **Swarm defect classes** (all seen in the pilot, all silently pass naive checks):
   single-backslash `\text` → JSON-parsed as TAB (Phase-0 control-char rule now
   catches it), all-zero `correctIndex` (seeded shuffle requirement), `£` inside
   inline math (→ `\pounds`), literal `$` as text (→ fullwidth `＄`), singleton
   `variantOf` groups (audit warns).
2. **Worked-answer correctness is a parent duty** — gates validate shape, not maths.
   Recompute every flagged numeric answer in Phase B (pilot spot-checked ~12).
3. **`String.replaceAll` with `$$` in the replacement corrupts content** — any parent
   fix-up script uses function replacers.
4. **Level-tag honesty** — only `trigonometry` omits `level`; the other five are
   genuinely Extended-only. Don't tag a mixed topic.
5. **Extended-topic descriptions** must not claim Core coverage (the pilot's
   "IB Diploma" copy bug class): every new description names IGCSE/Cambridge.
6. **e2e topology**: per-project runs only (`--workers=1`); combined runs trip the
   shared-dummy per-IP OTP budget and show phantom admin failures.
7. **Set-2 fix (Phase 0) changes a premium surface** — no indexability impact
   (already noindex), but re-run `verify:sitemaps` anyway; it's free.

## 10. Verification evidence to record in PROGRESS.md

Phase 0 rule-fires-red/green proof; Phase C gate outputs verbatim (topics 233,
papers 29, indexable 334, unit/e2e counts); UX waiver reason + spot shots;
dev + prod `verify:seo:live` results; swarm model used and defect count found.
