# Question Variations & Parameterized Templates — Implementation Plan

Status: **agreed direction, pre-implementation** (decisions below confirmed with user 2026-08-10).

## Goal

Turn the fixed 15-question-per-topic bank into a practice system where retaking a quiz
surfaces *fresh variants of the same skills*, so students can drill to mastery instead of
memorizing a seen set.

## Current state (surveyed 2026-08-10)

- 117 KS3 topics (bio 13, chem 12, phys 13, eng 25, math 54), each with exactly **15 MC questions** — 1,755 total. No free-response in topics (papers/ only).
- No variant mechanism. Topic quiz (`QuizPageClient.tsx`) shows **all 15 every session**, easy→hard.
- Seeded sampling infrastructure already exists (`src/lib/quiz-utils.ts`: `seededShuffle`, `stratifiedSample`; `src/lib/question-sets.ts`: `buildQuestionSet`) and powers mixed review / diagnostics / ladder.
- Subject fit for parameterized templates (from sampling actual stems):
  - **Physics**: strong — ~30% of stems already numeric (V=IR, P=VI, KE, efficiency, series/parallel, kWh, Q=It).
  - **Chemistry**: moderate — numeric (isotope mass, half-life, neutrons) + **combinatorial** (electron config, ion formation, naming).
  - **Biology**: weak — mostly recall/scenario; only genetics crosses, magnification, quadrat estimates parameterize.
  - **Math**: strong (the original use case).

## Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Sequencing | **Both tracks in parallel**: variant groups + sampling AND the template engine |
| D2 | Session UX | **~10 questions sampled per session, fresh seed on retake** (difficulty-ramped, one per variant group) |
| D3 | Pilot | **Math + physics pilot** (3–4 topics each), then rollout |
| D4 | Authoring | **Agent drafts variants in per-subject batches, user reviews each batch** |
| D5 | Template format | **TS generator modules + JSON param tables** (generators in `src/content/generators/`, params in topic JSON) |
| D6 | Progress | **Per-group mastery** aggregated over the raw per-question attempt log |
| D7 | Difficulty | **Fixed per template/group**, authored per the rubric; params chosen to stay in-band |
| D8 | Drill volume | **One instance per template/group per session**; no separate drill mode for now |

## Design

### 1. Variant groups (authored content)

- Schema: optional `variantOf: string` on `questionSchema` (`src/content/schema.ts`). Questions sharing a `variantOf` value are isomorphic: same skill, same difficulty band, different numbers/contexts/wording.
- **Pool shape per topic**: ~10 groups, each with 2–3 variants → pool of 20–30 questions. Ungrouped questions are treated as singleton groups (no content rewrite forced).
- Validator rules (`validate:content` / `audit:content`):
  - Group members must share the same `difficulty` (sampler draws one per group for the ramp).
  - Group `variantOf` values unique per topic (no cross-topic references).
  - Per-topic totals still satisfy ≥3 easy / ≥3 hard **counted per group**, so every session of ~10 keeps a valid ramp. (Concretely: ≥3 easy groups, ≥3 hard groups.)
  - Existing rules unchanged (4 choices, unique IDs, ≥20-char explanations).

### 2. Session sampling

- `QuizPageClient.tsx`: build the session set client-side on start (and on "Try new set"):
  1. Draw a session seed (crypto-random, client-only — SSR-safe since the quiz is interactive).
  2. One question per group via `seededShuffle(group, seed)`.
  3. Order easy→hard with intra-band shuffle (`orderQuestionsByDifficulty` with the session seed).
  4. If a topic still has ≤15 ungrouped questions (not yet expanded), current behavior is preserved (all questions shown) — rollout is incremental per topic.
- `?difficulty=` filter chips stay: they filter groups by band before sampling.
- Retake UX: "Try new set" button on the results screen reseeds without leaving the page.

### 3. Parameterized templates

- **Generator modules**: `src/content/generators/<name>.ts`, each exporting:
  ```ts
  interface Generator<P> {
    id: string;                    // e.g. "phys-v-ir"
    difficulty: Difficulty;        // fixed per template (D7)
    paramsSchema: ZodType<P>;      // validates the JSON param table
    generate(params: P, rng: Rng): GeneratedQuestion;
    // GeneratedQuestion = { stem, choices[4], correctIndex, explanation }
  }
  ```
  `rng` is a seeded PRNG (mulberry32 or similar — deterministic per session seed for testability).
- **Param tables in topic JSON**: optional `templates` array on the topic schema:
  ```json
  { "generator": "phys-v-ir", "variantOf": "ohm-law-v", "params": { "r": [2,4,5,10,20], "i": [0.5,1,2,3] } }
  ```
  `variantOf` lets a template occupy a group slot alongside authored variants (a group may mix authored + generated members).
- **Distractors are computed per template** from common-error rules (e.g. V=IR → I/R, R+I, R−I; isotope mass → unweighted mean). This is where authoring effort goes; each generator's distractors are unit-tested.
- **Materialization**: at session build, each template produces one instance (D8) via the seeded rng → the instance flows through the same group sampler as authored questions. Generated question IDs: `<topic>-<generator>-<sessionSeed>` (not persisted; progress aggregates per group, D6).
- **Validation**: `validate:content` checks `generator` exists in the registry, params pass `paramsSchema`, and for N fixed test seeds the generated instances satisfy the question invariants (4 choices, correctIndex in range, explanation ≥20 chars, no duplicate choices). Unit tests cover each generator across its param space.

### 4. Progress tracking (per-group mastery)

- Keep the existing raw attempt log per question ID (unchanged write path in `ProgressContext.recordAttempt`).
- Add a derived view: topic mastery = mastered groups / total groups. A group is **mastered** when the student answers its variants correctly in **2 consecutive attempts** (most recent two, any variant of the group).
- Topic completion % on subject/progress pages switches from per-question to per-group basis. Ungrouped (legacy) topics compute mastery per question as today — same number for unexpanded topics.
- Implementation step: inspect `ProgressContext` mastery computation first; keep the migration additive (no stored-data rewrite — derive groups from content at read time).

## Phases

### Phase 0 — Foundation (code only, no content change)

1. `questionSchema`: add optional `variantOf`; topic schema: add optional `templates` (accepted, not yet consumed).
2. Validator + audit rules for groups (shared difficulty, ≥3 easy/hard per-group basis) — with escape hatch so ungrouped topics validate exactly as today.
3. Session sampler in `QuizPageClient.tsx` + "Try new set" reseed button.
4. ProgressContext: per-group mastery derivation + completion % switch.
5. Unit tests for sampler (deterministic per seed, one-per-group, ramp preserved, ≤15-question topics unchanged) and mastery derivation.
6. Gates: validate:content, audit:content, vitest, lint, quiz e2e.

### Phase 1 — Pilot content: authored variants (math + physics, 3–4 topics each)

1. Pick pilot topics (math: e.g. `math-yr7-fractions`, one yr8 algebra, one yr9; physics: `phys-electricity-1`, `phys-energy-1`, `phys-forces-1`).
2. Agent drafts: reorganize existing 15 into ~10 groups; author variants to 2–3 per group (pool 20–30/topic). Batch reviewed by user before merge (D4).
3. Manual QA: retake flow shows fresh variants; mastery moves per group.
4. Gates as Phase 0 + e2e matrix in CI.

### Phase 2 — Template engine + pilot generators (parallel with Phase 1)

1. Generator registry (`src/content/generators/`), seeded rng, `templates` consumption in session build.
2. Validator support (registry/param checks + fixed-seed invariant tests).
3. Pilot generators:
   - Math: linear equations (`ax+b=c`), fraction arithmetic, percentages.
   - Physics: V=IR (+I,V variants), P=VI / fuse rating, KE=½mv², efficiency %, series/parallel resistance, Q=It, E=Pt (kWh).
4. Unit tests per generator across full param space (answer correctness, distractor plausibility/uniqueness, in-band difficulty).
5. Wire pilot templates into the Phase 1 pilot topics' groups.

### Phase 3 — Chemistry combinatorial generators (item 1 DONE 2026-08-12; item 2 in progress: 3 of 12 chem topics)

1. ✅ Table-driven generators (all six live in `src/content/generators/`, unit-tested): electron configuration (Z=1–20), ion formation by group, isotope relative atomic mass, half-life decay, pH ratio, compound naming.
2. Variant-group expansion of chem topics (agent-authored batches, user review per D4). Done: `chem-atomic-1` (11 groups, 24 q, 4 templates), `chem-bonding-1` (13 groups, 29 q, 1 template), `chem-acids-1` (13 groups, 27 q, 1 template). Remaining 9 chem topics move to Phase 4's batch queue.
3. Gates per phase.

### Phase 4 — Full KS3 rollout

1. Remaining 9 chem topics (group expansion only — generators already exist), then remaining math + physics topics, then biology + english (authored variant groups only — bio gets at most genetics/magnification/quadrat generators, english none).
2. Per-subject batches with user review (D4).
3. Revisit paper-set count per course (currently 1 set each) once drilling is live — separate decision.

### Phase 5 — Polish & docs

1. Update `docs/CONTENT_STYLE.md` (variant group rules, template conventions), `AGENTS.md` (new validators/conventions).
2. Progress page copy for group mastery.
3. Optional follow-ups (explicitly deferred): multiple instances per session, separate drill mode, computed difficulty, biology generators beyond the three niches.

## Open details (to confirm during implementation, not blockers)

- Exact group count per expanded topic: targeting ~10 groups (matches the ~10-question session), flexible 8–12.
- Mastery rule: 2 consecutive correct — tune after pilot usage data.
- Whether `stratifiedSample` needs a group-aware variant or the group draw + ramp is sufficient (implementation detail in Phase 0).
- Naming: `variantOf` vs `group` — decide at schema edit; `variantOf` used throughout this doc.

## Risks

- **Distractor quality** in generators — mitigated by per-template error rules + full-param-space unit tests + pilot review.
- **Content volume** (~1,000+ authored variants) — mitigated by batch review and incremental rollout (topics work unchanged until expanded).
- **Completion % regression optics** — per-group mastery can *drop* displayed completion when a topic expands; communicate in the batch review, or grandfather display until first new attempt (decide in Phase 0 implementation).
