# Phase 2 — Question Bank & Difficulty + Diagnostics: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 2.
> Goal: every question carries `difficulty` (+ `calculator` for math) tags; quiz UI surfaces them (badges, easy→hard order, difficulty filter); mixed review samples with difficulty weighting; one cross-topic diagnostic per course seeds the weak-areas system immediately.
> Sized for: **4 focused sessions** (breakdown in §5). Bulk tagging (Session 1–2) is the long pole.

---

## 1. Scope

**In:**
- Schema: optional `difficulty: 'easy'|'medium'|'hard'` on every question; optional `calculator: boolean` (math only).
- Bulk tagging of all ~1,970 existing questions (LLM-assisted swarm pass + spot review, same model as the Phase 1.5 authoring pass).
- Audit rules: difficulty presence + per-topic distribution; calculator only on math topics.
- Quiz UI: difficulty/calculator badges on the question card; easy→hard ordering; pre-quiz difficulty filter.
- Mixed review: difficulty-weighted sampling (stratified) replacing uniform random.
- Diagnostics: one short cross-topic diagnostic per course grouping; results recorded as per-topic attempts so `getWeakTopics()` picks them up immediately — no storage migration.
- Docs: CONTENT_STYLE.md (tagging rules), AGENTS.md if conventions change.

**Out (deliberately):**
- **No per-question result history.** Progress stays attempt-aggregate (`QuizAttempt { date, correctCount, totalCount }`). Question-granularity history is Phase 6 analytics work; diagnostics don't need it (they seed topic-level attempts).
- **No new content/topics.** Tagging touches question metadata only, never stems/explanations.
- **No practice exams** (Phase 3 — but the `calculator` tag added here is what Phase 3's P1-non-calc/P2-calc sampler will need).
- **No RV-style course cards / design refresh** (§6 of parent plan — still premature, zero IGCSE topics exist).

---

## 2. Current state (verified 2026-07-24)

- Schema: `src/content/schema.ts:31-37` — question = `{ id, stem, choices(4), correctIndex, explanation }`. No `difficulty`/`calculator` anywhere; no question-type discriminator. Zod strips unknown keys, so tags must be declared in the schema before tagging JSON (else `registry.ts` silently drops them).
- Data: 129 topics, **1,970 questions** (min 15 / max 20 / avg 15.3 per topic — all at the 15 standard).
- Quiz UI: single component `src/components/QuizGame.tsx` (289 lines), used by `quiz/QuizPageClient.tsx` (topic quiz, 60s timer, `shuffleSeed=topicId`) and `mixed-review/MixedReviewClient.tsx` (no timer). Order = deterministic seeded shuffle (`QuizGame.tsx:59-61`). Badge slot: the empty right side of the `justify-between` header row at `QuizGame.tsx:199-201`. Badge template: the stage chip at `SubjectPageClient.tsx:87-89`.
- Progress: `src/lib/progress-store.ts` — localStorage `iblearn_progress`, attempts per topic only. Weak areas: `src/lib/weak-point-analyzer.ts:4-9` — topics with recent-5-attempt average < 0.7, top 5.
- Mixed review: `src/lib/mixed-review.ts` — `MIXED_REVIEW_COUNT = 10`, pool = all questions in registry, sampling is uniform `Math.random` (line 49), modes `weak|random`, attempts recorded under synthetic topic `math:mixed-review`.
- Course groupings in data (the diagnostic set): math-Y7 (26), math-Y8 (15), math-Y9 (13), math-dp-ai SL (16) + HL (4), eng-ks3 (17), bio-ks3 (13), chem-ks3 (12), phys-ks3 (13) → **8 diagnostics**. No IGCSE/AA/DP-science topics exist yet.
- Tests: unit `quiz-game.test.tsx`, `mixed-review.test.ts`, `weak-point-analyzer.test.ts`, `progress-store.test.ts`, `content-schema/registry.test.ts`; e2e `mixed-review.spec.ts`, `app.spec.ts` (quiz flow), `topic-journeys.spec.ts`.

---

## 3. Design decisions

### 3.1 Question tags (additive, backward compatible)

```ts
// questionSchema additions (both optional at the zod level)
difficulty: z.enum(['easy', 'medium', 'hard']).optional()
calculator: z.boolean().optional()   // math only; true = calculator expected/allowed
```

- Optional in zod (registry won't reject untagged legacy JSON mid-migration), but **audit enforces presence** after the tagging pass: `audit-content.ts` gains a warning for any question missing `difficulty` (audit fails on any warning, so the gates force completion).
- `calculator` boolean, not enum: Phase 3 needs two pools (non-calc / calc). `true` → calc pool; absent → non-calc. KS3 questions default to absent (KS3 is largely non-calculator); DP-AI gets explicit tags (P1 non-calc / P2 calc split).
- Validator rule (`validate-content.ts` `checkStageConsistency` pattern): `calculator` present ⇒ subject is math.

**Distribution target per topic** (audit-enforced, tuned to the 15-question standard):
- ≥ 3 easy, ≥ 3 hard, remainder medium (≈ 30/40/30).
- Rationale: enough of each band for the filter to be meaningful and for stratified mixed-review sampling; not so rigid that naturally-easy topics (e.g. eng-spelling-1) fight the rule. If a topic legitimately can't hit ≥3 hard, the rule is revisited with data — not waived silently.

**Tagging method** — LLM swarm, mirroring the Phase 1.5 authoring pass:
- One subagent per subject batch (math split by year), instructed to tag `difficulty` per question by cognitive demand (recall = easy, single-step application = medium, multi-step/unfamiliar context = hard) and `calculator` for math questions where a calculator is realistically expected (DP: check against P1/P2 conventions).
- Tags only — subagents must not touch stems/choices/explanations (diff-check: only `difficulty`/`calculator` keys added).
- Human/agent spot-check of a random sample per batch (same as the 8-topic answer spot-check last session).

**Difficulty rubric** (fixed by the Session 1 pilot — quote verbatim in swarm prompts):
- Judge difficulty **relative to the topic's target level** (year/course), not on an absolute scale.
- **easy** = single-fact recall or a direct definition; a student who read the notes once should get it right.
- **medium** = apply one rule or procedure, discriminate between close options, or a short single-step calculation.
- **hard** = multi-step procedure, prediction/application in an unfamiliar context, or fine discrimination across several options — the questions a typical student at this level is most likely to miss. (For recall-heavy subjects like science, scenario-based prediction *is* the hard band.)
- **calculator** (math only) = a calculator is genuinely expected for the computation; exact-form topics (e.g. surds) and mental-math questions stay untagged. KS3 is mostly untagged; DP-AI allows a GDC on **all** papers (the P1-non-calc convention applies to AA, not AI), so tag where a GDC is genuinely expected (regression, distribution probabilities, hypothesis tests, matrices, graph algorithms, numerical solving).
- Target ≈ 30/40/30 easy/medium/hard per topic; audit requires ≥3 easy and ≥3 hard.

Pilot results (Session 1, tagged by hand): math-yr9-surds 4/8/3, bio-cell-1 9/3/3, eng-spelling-1 11/1/3 — all satisfy ≥3/≥3 without forcing unnatural questions, including the recall-heavy spelling topic (its "hard" band = multi-option discrimination + applied reasoning: homophones in full sentences, irregular plurals in context, spell-checker limits).

### 3.2 Quiz UI (badges, ordering, filter)

- **Badges**: chips in the header row (`QuizGame.tsx:199-201`), styled on the stage-chip template. Difficulty colors: easy = green, medium = amber, hard = red (soft-chip pattern, dark-mode variants). Calculator badge (calc icon from lucide) shown when `calculator: true`.
- **Ordering**: easy→hard becomes the default for topic quizzes. Implementation: sort by difficulty band first, then seeded shuffle **within** each band (keeps SSR-stable determinism, avoids identical question order every attempt). Questions without a tag sort as medium (transitional; post-tagging there are none).
- **Filter**: pre-quiz selector in `QuizPageClient` (All / Easy / Medium / Hard) — mirrors the mode-toggle pattern in `MixedReviewClient.tsx:44-64`. Selecting a band passes the filtered subset to `QuizGame`. URL param (`?difficulty=hard`) so it's linkable, matching the `?mode=weak` precedent. Filter hidden when a topic's questions are untagged (transitional).
- `QuizGame` itself stays dumb: it receives the final ordered/filtered question array + an optional `onComplete` unchanged. New props: none required if sorting/filtering happens in the callers — **preferred**, keeps the component's test surface small.

### 3.3 Mixed review — stratified difficulty sampling

Replace uniform random (line 49) with stratified sampling over the pool: target 3 easy / 4 medium / 3 hard in each 10-question set; fall back to filling from other bands when a band is short (weak-mode pools may be small). Uniform-random within each band, same `Math.random` stubbing pattern the existing tests use. Applies to both `weak` and `random` modes.

No change to weak-area computation itself (< 0.7 recent average, top 5) — "reuse difficulty weighting" per the parent plan is satisfied by the sampling change above. Per-difficulty weak-area breakdown is Phase 6 (needs per-question history).

### 3.4 Diagnostics

- **Route**: `/diagnostics` (index of the 8 course diagnostics, card per course) + `/diagnostics/[courseId]` runner. `courseId` values: `math-y7`, `math-y8`, `math-y9`, `math-dp-ai`, `eng-ks3`, `bio-ks3`, `chem-ks3`, `phys-ks3`.
- **Pool builder**: new `src/lib/diagnostics.ts`, same shape as `mixed-review.ts` — filter registry topics by (stage, year) or (subject, stage) or (stage, course), flatten questions, sample **1 question per topic, stratified by difficulty across the set** (e.g. math-Y7: 26 topics → cap at ~15 questions, ≥3 per band, spread across topics). No timer. Reuses `QuizGame` with seed = courseId (retake gives same set — acceptable for a diagnostic; reshuffle-on-retake is a later nicety).
- **Result handling**: after completion, group per-question outcomes by source topic and record one attempt per touched topic via `recordQuizAttempt(subjectId, topicId, correct, total)` — exactly the shape weak-point-analyzer already consumes, so a weak diagnostic score immediately surfaces the topic in "Needs Practice" and weak-mode mixed review. This is the deliberate substitute for per-question history (see Out of scope).
- Diagnostic sets are built from the same tagged pool — **diagnostics depend on the tagging pass being done** (untagged questions can't be stratified). Session ordering in §5 reflects this.
- Entry points: homepage "Needs Practice" card area + progress page ("Take a diagnostic" CTA when a course has no quiz history yet — the cold-start case diagnostics exist for).
- localStorage: no shape change. (Adding the Phase-7 `version` field to the progress payload is a 5-line forward-compat tweak — folded in here while the store is open, but optional.)

### 3.5 Tests & gates

- Unit: schema (new fields optional, enum enforced), audit rules (missing difficulty, bad distribution, calculator-on-non-math), stratified sampler (band counts, fallback), diagnostics pool builder (topic spread, band spread, per-course grouping), QuizPageClient filter/ordering.
- E2E: badges visible in a quiz; `?difficulty=` filter; one full diagnostic run → topic appears in weak areas (mirrors `mixed-review.spec.ts:38-49` completion loop).
- Gates unchanged; `audit:content` now fails until tagging is 100% — **run tagging before expecting green gates**.

---

## 4. Task breakdown (ordered)

**Part A — schema + tagging (Sessions 1–2)**

1. Schema + types: add `difficulty`/`calculator` to `questionSchema` + `Question` interface.
2. Validators: calculator⇒math rule in `validate-content.ts`; audit rules (missing difficulty, per-topic distribution ≥3 easy/≥3 hard) in `audit-content.ts`. Expect audit red until tagging completes.
3. Tagging pilot: 2–3 topics by hand to nail the difficulty rubric wording.
4. Swarm tagging pass: all 129 topics in per-subject batches; diff-check that only tag keys changed; random-sample spot-check per batch.
5. `generate:registry`; gates: validate:content, audit:content green again; unit tests for steps 1–2.

**Part B — quiz UI (Session 3)**

6. Badges in `QuizGame` header row (difficulty chip + calc icon).
7. Ordering helper `orderQuestions(questions, seed)` (band sort + intra-band seeded shuffle) in a lib file; wire into `QuizPageClient`.
8. Difficulty filter in `QuizPageClient` with `?difficulty=` param.
9. Unit tests (ordering, filter) + e2e (badges, filter).

**Part C — mixed review + diagnostics (Session 4)**

10. Stratified sampler in `mixed-review.ts`; update `mixed-review.test.ts` (band counts, short-band fallback).
11. `src/lib/diagnostics.ts` pool builder + course-grouping map (the 8 IDs).
12. `/diagnostics` index + `/diagnostics/[courseId]` runner (reuse QuizGame); result fan-out to per-topic `recordQuizAttempt`.
13. Entry points: homepage + progress page CTAs (cold-start case).
14. Tests: diagnostics unit tests; e2e diagnostic→weak-areas flow; full gate suite incl. e2e.
15. Docs: CONTENT_STYLE.md (tag rubric + distribution rule), PROGRESS.md entries per session.

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Part A steps 1–3: schema, validators, tagging rubric + pilot | 1–2 h | Pilot topics tagged; audit red only on untagged topics; unit tests green |
| **2** | Part A steps 4–5: swarm tagging all 129 topics | 2–3 h | All 1,970 questions tagged; audit + validate green; spot-checks pass |
| **3** | Part B: badges, easy→hard ordering, difficulty filter | 2–3 h | Unit + e2e green; badges/filter visible on any topic quiz |
| **4** | Part C: stratified mixed review + diagnostics + CTAs + docs | 3–4 h | Full gate suite green; diagnostic run seeds weak areas e2e |

Dependencies: Sessions 3–4 both depend on Session 2 (tags must exist before UI/samplers consume them). Sessions 3 and 4 are independent of each other and could be swapped or run in either order.

## 6. Open questions

1. ~~**Difficulty rubric wording**~~ — **resolved in Session 1**: rubric fixed in §3.1 (relative to topic level; scenario prediction = hard for recall subjects).
2. ~~**Distribution rule strictness**~~ — **resolved in Session 1**: pilot confirmed ≥3 easy/≥3 hard is reachable even for a recall-heavy spelling topic (its hard band = multi-option discrimination + applied reasoning), so the rule stands unchanged.
3. **Diagnostic length** (resolve in Session 4) — 15 questions default; math-Y7 has 26 topics so 1-per-topic needs a cap. Cap at 15 with topic spread maximized, or let length = topic count? Default: cap 15.
