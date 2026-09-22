# Content backlog review

**Measured 2026-09-19** at prod `354858c`, by reading `src/content/data/**` directly.
**Re-measured 2026-09-22** on `develop` (245 topics): §1, §2.B and §2.C carry the current
numbers; the closed sections keep their original audit trail.
Every number here is reproducible from the JSON — none is quoted from an older plan.
This doc supersedes the one-line "Standing queue: illustrations 106, traffic/SEO depth,
content depth" that has been copy-pasted between PROGRESS entries since 2026-08: that
line is an append-only snapshot, it has drifted, and it conflates five different jobs.

Read this with `docs/CONTENT_STYLE.md` (the authoring standard) and
`docs/ILLUSTRATION_GUIDELINES.md` (the drawing standard).

---

## 1. What exists today

| | Count (2026-09-22) | Note |
|---|---|---|
| Topics | **245** | 10 subjects, 3 stages |
| Notes | **1727** | 7 per topic, sometimes 8 (a superset, not a gap) |
| MC questions | **3945** | mean 16.1/topic |
| Paper sets | **31** across 15 courses | 14 courses × 2 + `math-igcse` × 3 |
| Free-response questions | **251** | 620 markscheme points; every set totals exactly 20 marks |
| Illustrations | **430 SVG files**, **449 illustrated notes** | 0 orphans, 0 dangling references, **0 topics with no figure** |
| Question generators | **36** in `src/content/generators/` | **all 36 are wired into content**, in **174 topics / 193 placements** |
| Indexable / noindex pages | **352 / 580** | `verify:sitemaps` on the 2026-09-22 `build:static` (937 prerendered, 352 sitemap URLs all live + indexable, titles unique) |

Per subject (topics / notes illustrated / templated):

| subject | topics | ill. notes | topics w/ 0 | templated |
|---|---|---|---|---|
| math | 92 | 68 (10%) | 24 | 3 |
| english | 34 | 23 (10%) | 11 | 0 |
| chinese | 20 | 0 | 20 | 0 |
| chemistry | 13 | 71 (78%) | 2 | 4 |
| physics | 14 | 78 (80%) | 2 | 2 |
| biology | 14 | 91 (93%) | 1 | 0 |
| german | 13 | 0 | 13 | 0 |
| ict | 12 | 0 | 12 | 0 |
| history | 11 | 0 | 11 | 0 |
| geography | 10 | 0 | 10 | 0 |

**The gates are clean**: `validate:content` and `audit:content` both pass with zero
warnings. So everything below is either a *coverage* gap (content that doesn't exist) or
a defect class the validators provably cannot see — not a broken build.

---

## 2. The five real backlogs, with sizes

### A. DP Math AA — **CLOSED at the committed scope (2026-09-21)**

**Was: zero topics, no `Course` entry.** Now: **12 topics** (the SL core: sequences and series,
  exponents and logarithms, binomial theorem, functions, quadratics, trig identities and equations,
  vectors, descriptive statistics, probability, binomial and normal distributions, differentiation,
  integration), the `math-dp-aa` course wired into `courses.ts`/`exams.ts`, `order.json`, **9 new
  figures** and **2 paper sets** — the corpus is 245 topics / 31 papers / 620 markscheme points.

Scope was verified against the AA guide and two publishers rather than assumed: **SL 5.6 includes the
  chain, product AND quotient rules**, while **volume of revolution is HL** and is deliberately absent.
  Which is why the SL core still leaves real headroom — HL-only content, and depth to reach parity with
  AI's 20 topics (the review's original "~30 topics" estimate). Neither is queued.

Product claim: `/ibdp`'s DP Maths now has both courses, but **only on dev** — prod is ~28 commits
  behind and still advertises AI alone. Promotion is the next step (PROGRESS main entry).

### B. Illustrations — **CLOSED 2026-09-20** (re-verified 2026-09-22)

**No topic renders bare: 0 of 245 topics have zero figures**, and the five subjects that had
never had a figure (chinese, german, ict, history, geography) each own a
`public/images/<subject>/` directory now. Measured: **430 SVG files, all referenced, 449 of
1727 notes illustrated** — biology 92/98, chemistry 73/91, physics 80/98, maths 104/739,
english 34/239, chinese 20/140, german 13/91, ict 12/84, history 11/77, geography 10/70.
The sciences follow the per-note standard; the rest follow "≥1 figure per topic", which was
the 2026-09-19 decision (§5). Density beyond that is not queued.

**What the queue's old "106" referred to (kept for the audit trail).** Coverage was bimodal:

- **34 topics fully illustrated (7/7)** — biology 13, chemistry 10, physics 11. The
  sciences follow a per-note standard.
- **93 topics with exactly one figure** (68 math, 23 english, 1 chem, 1 phys) — and it is
  almost always note 1 (121 of the 331 illustrated notes sit at position 1).
- **106 topics with none**, including **every single topic in five subjects**: chinese
  (20), german (13), ict (12), history (11), geography (10). There is no
  `public/images/{chinese,german,ict,history,geography}/` directory at all — those
  subjects have never had a figure, so the backlog there is not "add more", it is "start".

Two different jobs hide behind one number:

| job | topics | what it needs |
|---|---|---|
| **Start 5 subjects** | 66 | first figure ever for the subject |
| **Fill remaining zeros** | 40 | math 24, english 11, bio/chem/phys 5 |
| **Reach 7/7 density** | 199 | ~1312 notes have no figure (the sciences' standard) |

**Decision needed before any drawing starts:** is the standard "≥1 figure per topic"
(106 figures, matching how math/english look today) or "1 per note" (~1312 figures,
how the sciences look)? The guidelines doc specifies *how* to draw, not *how many*.
At ~30–60 min per reviewed SVG, that is the difference between a two-week job and a
year-long one. Recommending: **≥1 per topic first** (that is what the two subjects with
the most topics already do), revisiting density per subject once nothing is bare.

Also note the language subjects are a genuine exception, not a backlog item: chinese and
german are vocab-table notes plus bilingual flashcards — a picture per note buys less
there than in history/geography/ICT.

### C. Templates — 174 of 245 topics carry a template; the last 71 need more generators

**Measured 2026-09-22, after three sessions of generator work:**

| | value |
|---|---|
| generators | **36**, every one wired |
| topics with a template | **174 of 245** (193 placements) |
| unwired topics | **71** — maths 59, chemistry 8, physics 4 |

**What closed this session:**

1. **`math-quadratic`** — solve by the formula, the discriminant, how many real roots a
   discriminant gives, completing the square, and an equation from its roots. Wired into
   `math-igcse-quadratics`, `math-dp-aa-quadratics`, `math-dp-ai-quadratics`. Irrational roots
   / surd form are deliberately not mechanized (they need surd simplification).
2. **`flashcard-match`** — a term/definition matching drill fed by **the topic's own flashcard
   deck** (`TopicTemplate.source: "flashcards"`, injected as `params.cards` by
   `materializeTemplates` and by `checkTemplates`). This covers **all 114 topics** in the six
   subjects that had no generator (biology 14, english 34, history 11, geography 10, ICT 12,
   chinese 20, german 13 — the "104" this doc carried for two sessions was simply a wrong
   total, caught while wiring). It is a **recall drill over the deck, not a skill generator**:
   essay craft, source analysis and map skills are still not mechanized, and the deck is the
   single source of truth for the vocabulary so a card edit edits the drill.

Design rules the generators share (the reason the answers can be trusted):

- **Answers are constructed, never derived.** A mean's last value is chosen so the total is
  divisible; a quadratic comes from its roots (its discriminant is then a perfect square); a
  physics energy is the product its own question asks for; a frequency-density frequency is an
  integer density times an integer width.
- **Modes a param table cannot answer exactly are dropped, not thrown.** `5.6 / 1.5` does not
  terminate, a triangle's hypotenuse is rarely an integer, and a deck may be too verbose — all
  filtered out of the draw, because a validation-time throw still leaves a live session able to
  break. A mode that would make an answer unreachable is also a bug: the discriminant modes
  draw b and c directly, or "no real roots" could never be the answer.
- **Only the side that becomes a CHOICE is length-capped** in the flashcard drill, which is
  what lets a prose deck (174–210 character definitions, short terms) still drill in the
  definition→term direction.

**What the last 71 topics need** (measured, not estimated — every topic's questions were read):

| missing generator | host topics | topics |
|---|---|---|
| right-triangle trig + Pythagoras (SOH-CAH-TOA, finding a side/angle, hypotenuse) | `math-trig-basic-myp`, `math-igcse-trigonometry`, `math-pythagoras-myp`, `math-yr8-pythagoras`, `math-yr9-3d-geometry` | 5 |
| angle facts (straight line, parallel lines, polygon sums, triangles) | `math-yr7-angles`, `math-yr8-angles-parallel-polygons`, `math-igcse-angles-polygons`, `math-geometry-1`, `math-igcse-circle-theorems` | 5 |
| single/combined probability (and tree diagrams) | `math-yr7-probability`, `math-igcse-probability`, `math-yr8-probability-trees`, `math-dp-ai-probability` | 4 |
| straight-line graphs and inequalities (`y = mx + c`, gradient, midpoint) | `math-linear-myp`, `math-yr8-straight-line-graphs`, `math-inequalities-myp`, `math-yr9-quadratic-graphs` | 4 |
| sine/cosine rule and ½ab sin C | `math-igcse-trig-advanced` | 1 |
| calculus (differentiate / integrate a polynomial term) | `math-dp-aa-differentiation`, `math-dp-ai-differentiation`, `math-dp-aa-integration`, `math-dp-ai-integration` | 4 |
| vectors (column add/subtract/scale, magnitude) | `math-igcse-vectors`, `math-dp-aa-vectors`, `math-dp-ai-vectors` | 3 |
| binomial coefficients and terms | `math-dp-aa-binomial-theorem`, `math-dp-ai-binomial` | 2 |
| matrix arithmetic (add, multiply, determinant) | `math-dp-ai-matrices` | 1 |
| trig identities and equations | `math-dp-aa-trig-identities-equations`, `math-dp-ai-trig` | 2 |
| table-driven chemistry (ion tests, separation methods, homologous series) | `chem-ion-tests-1`, `chem-mixtures-1`, `chem-organic-1`, `chem-metals-1` | 4 |
| physics formulas still missing (refraction, weight, charge in a field) | `phys-light-1`, `phys-magnetism-1`, `phys-space-1`, `phys-energy-resources-1` | 4 |
| nothing mechanizable (DP AI Voronoi/graph theory/Poisson/hypothesis testing, constructions and loci, nets, bearings, Venn, transformations, correlation, kinematics) | the remaining maths topics | ~32 |

So the honest position: **the last ~39 topics can be reached by ~12 more generators** (the same
pattern as this batch — pure arithmetic, exact by construction), while **~32 are not
parameterizable at all** (constructions, nets, diagram reading, hypothesis testing) and are
variant-group authoring work. Nothing in this list is a blocker for promoting `develop`: the
promotion is content, and C's product goal — a retake surfacing fresh variants — is already met
for 174 of 245 topics.

### D. Content defects the gates cannot see — **first pass MEASURED 2026-09-19**

This is the cheapest item here and the only one whose value is *student-facing
correctness* rather than volume. Three named classes, none of them caught by anything.
Tool: `scripts/audit-content-ai.ts` (`npm run audit:ai:markschemes` / `audit:ai:answerkeys`),
model pinned to `jev-1.13.0` and echoed into every report.

1. **Markscheme independence — CHECKED, rule holds.** All 231 multi-point questions /
   **580 markscheme points** were judged for double-counting (today the only enforcement is
   `marks === markscheme.length`). **One candidate**, `ict-ks3-set-1-q7` (a loop-trace
   question), hand-triaged as *adjacency, not a defect*: its three points are output /
   pass-count / stop-reason, which is the standard awarding shape, and the model scored all
   three elevated (0.45/0.57/0.32) — it was reading overlap between the parts, not a
   duplicate. Clean cases score 0.07–0.11 and a deliberately planted duplicate 0.56–0.59.
   The deterministic half is now a gate too: `validate-content.ts` rejects a markscheme
   point without an `M`/`A`/`B` type prefix (all 580 already comply — M 104 / A 132 /
   B 344 — so it guards new content, the same shape as the 20-mark rule).
2. **MC answer keys — MEASURED, and the judgement is NOT fit for computational
   questions.** A 90-question sample produced 13 findings across 9 questions, and **every
   one was a maths question** (9 of the 35 maths questions sampled) while **all 55 sampled
   questions across the other nine subjects were clean** (keys 0.94–0.99, best distractor
   ≤ 0.14). All nine were hand-checked and **every key was correct** — the model fails the
   arithmetic, then calls a distractor right or the key wrong. That is AGENTS.md's standing
   rule (*Jev is not a calculator; it does not count reliably*), now measured on our own
   content. **Consequence: do not gate on this, and do not use it on numeric questions** —
   correctness of a numeric response needs exact recomputation, not a judgement. It remains
   useful for conceptual/verbal questions (where it was clean) and as an authoring-path
   check for new non-computational content. This also qualifies the 2026-09-17 measurement
   in `typesafe-ai-reviewed.md` §8.1: "the correct option won all 21 observations" was
   true of the sample it used, which did not expose the arithmetic failure mode.
3. **Difficulty tags — MEASURED 2026-09-19: the rubric and the gates contradict each other.**
   Corpus-wide (`--mode=difficulty`, verbatim rubric): the shipped tags are **33/42/25 %**
   easy/medium/hard, while the model applying `CONTENT_STYLE.md:88–90` literally calls
   **42/57/1 %** — and **every one of its 28 `hard` calls lands on a shipped-`hard` question**
   (it never calls an easy- or medium-tagged question hard). A blind human pass over 30
   biology questions (15 of them shipped `hard`, none of which I had seen) agrees with the
   model far more than with the tags: **shipped==mine 15/30, shipped==model 13/30,
   mine==model 21/30**. On the 15 shipped-`hard` questions both judgements put only **3** at
   hard (9 → medium, 3 → easy). So ~80 % of `hard` tags do not survive our own written rubric.

   **But neither side is "wrong" — the rubric is internally inconsistent.** Its `hard`
   criterion is *absolute* ("the questions a typical student at this level is most likely to
   miss"), while our machinery *forces a quota*: `audit:content` must pass with zero warnings
   and requires ≥3 hard per 15-question topic (**20 %**), and `STANDARD_MIX` asks for 6 hard in
   a 20-question paper (**30 %**). Ten subjects shipping 22–27 % hard — recall-heavy Chinese
   and History included — is the signature of a quota, not a measurement: for
   vocabulary or fact-recall content there may be *no* question a typical student is likely to
   miss, yet the gate demands three. **A strict retag is therefore not a content edit**: it
   reds out `audit:content` for most topics and starves the mock mixes (which then fall back
   to `leftovers` in `stratifiedSample`, silently softening every paper).

   **Decision needed (see §5):** make the rubric say what the tags do (relative: the topic's
   hardest ~20–30 %), or retag strictly and re-tune both the gate and the mixes, or author
   genuinely harder questions. **Advisory only either way — do not gate on this model:** its
   `Score` is a threshold, never a magnitude, and the tags' real job is shaping the quiz/mock
   ramp, not predicting failure. Its hard set is a strict subset of ours, so it is a
   high-precision, low-recall candidate finder if a retag is ever chosen.

### E. Traffic / SEO depth

Not a content gap and not measurable from the JSON — listed for completeness because the
queue line includes it. What is known: 335 indexable of 887 pages, and PROGRESS has
described the hubs as "thin" with weak internal linking since 2026-08. Nothing in this
review changes that assessment; it needs its own measurement pass against Search Console
data, which is a different job from this one.

---

## 3. Recommended order

1. **D (quality) — DONE 2026-09-19.** Markscheme independence checked corpus-wide, the
   `M`/`A`/`B` prefix rule gated, the MC answer-key judgement measured (and found unfit for
   computational questions), the difficulty tags measured with a blind human pass, and the
   rubric contradiction resolved in `CONTENT_STYLE.md` (commit `39e36b6`).
2. **C (templates) — 174 of 245 topics, 36 generators, all wired.** The quadratic solver and
   the flashcard-fed drill closed the two items this section named. The last 71 topics are
   tabulated in §2.C: ~39 need ~12 more generators (the same pattern), ~32 are not
   parameterizable and need authored variant groups.
3. **B (illustrations) — DONE 2026-09-20.** Standard settled at **≥1 figure per topic**; no
   topic is bare and every subject has imagery. Density beyond that is not queued.
4. **A (DP AA)** — **DONE 2026-09-21 at the committed SL-core scope** (12 topics, 9 figures, 2 paper
   sets). What remains is HL-only content and depth towards AI's 20 topics; neither is queued.

Sequenced: **D done → C → B → A**, with two cross-cutting tasks alongside any of them — an
AGENTS/plan-doc staleness sweep (two plan docs already claimed "nothing landed" for shipped
work, and AGENTS.md asserted no PITR existed after it was enabled) and the `ci.yml`
`timeout-minutes` gap that cost a 45-minute hang and skipped two deploys on 2026-09-18.
**Both cross-cutting items are CLOSED (2026-09-20).** The staleness sweep landed in `cd332e7`
(14 claims corrected; the two IGCSE status lines below are already fixed); the remaining stale
comment, `src/app/ibdp/page.tsx:9-10`, was corrected 2026-09-20. Every `ci.yml` job now carries
`timeout-minutes` (build-and-test 30, e2e 40, illustrations 30, semgrep 20, both deploys 60) —
except `osv-scanner`, which cannot, because a reusable-workflow-call job rejects the key.

---

## 4. Stale docs found while measuring (fix or they will mislead the next session)

**All three are fixed** (1–2 in `cd332e7`, 3 on 2026-09-20). Recorded here as the audit trail.

1. **`docs/igcse-wave2-plan.md` — "Status: plan only, nothing landed." is false.**
   All 6 wave-2 topics exist (`math-igcse-functions`, `-circle-theorems`, `-trigonometry`,
   `-trig-advanced`, `-vectors`, `-histograms`), `math-igcse-set-3.json` exists,
   `math-igcse` has exactly the 16 topics the plan specifies, and the repo has the plan's
   target totals (233 topics / 29 papers / 335 indexable). The plan's Phase 0 defect
   (`math-igcse-set-2` totalling 21 marks) was fixed and gated by commit `7728996`
   *on the same day the plan landed* (`cf95b9b`), and PROGRESS records the whole chain as
   "wave-2 chain CLOSED — LIVE IN PROD" on 2026-09-12. Both halves of Phase 0 are done:
   `scripts/validate-content.ts:336` enforces the 20-mark total, `:179` scans control
   characters.
2. **`docs/igcse-pilot-plan.md` — same stale status line**, and its own successor doc
   describes it as "live in prod since 2026-09-07".
3. **`src/app/ibdp/page.tsx:9-10`** — comment says "IGCSE has no tier hub — the tier is
   empty and the plan is explicit that an empty tier gets no route". `src/app/igcse/` has
   both `page.tsx` and `[subjectId]/page.tsx` and has been live since 2026-09-07.

---

## 5. Decisions (all three settled 2026-09-19)

1. **Difficulty tags (§2.D item 3) — make the rubric relative. DONE** (`CONTENT_STYLE.md`
   "How to read the bands", commit `39e36b6`). The bands are relative to the topic as well as
   to its level: the ramp is enforced (`audit:content` ≥3 hard/topic; `STANDARD_MIX` draws ~30%
   from the hard band), and reading the levels as *absolute* bands marks ~1% of the corpus hard,
   which cannot satisfy that rule. All 950 `hard` tags stand; no gate or mix changes. The
   phase-2 plan's swarm-prompt block now points at the ruling so the old absolute wording cannot
   propagate into future tagging runs.
2. **Illustration standard — ≥1 figure per topic (106 figures), bare subjects first.** No topic
   should render with zero imagery; density stays as it is elsewhere (a 1-in-7 topic already
   reads as finished — that is all of maths and english today). Order: the 5 bare subjects
   (chinese 20, german 13, ict 12, history 11, geography 10 = 66), then the 40 remaining zeros
   (maths 24, english 11, bio/chem/phys 5). Requires a first-ever `public/images/<subject>/`
   directory for the 5 subjects. Language subjects are the deliberate exception — vocab-table
   notes plus bilingual flashcards — so their figures should be vocab/situation posters rather
   than diagrams.
3. **DP Math AA — commit, SL core first (~12 topics).** Existing courses run 10–34 topics, so a
   ~12-topic core is a full course, not a stub; the mock pool has no shortfall risk at that size
   (the wave-2 reasoning: 16 topics × 15 questions = 240 available against 20 per paper). Chain:
   syllabus map → authoring (7 notes / 12 cards / 15 questions each) → `courses.ts` entry +
   `order.json` block + a paper set + the count-churn sites AGENTS.md enumerates. No route,
   schema, sitemap or hub change needed — the IGCSE pilot machinery generalises.
3. **Quality pass now or with new content?** Recommended: now — the markscheme pass
   covers existing content and every later item benefits.

## 6. Not backlog (already done — don't re-queue)

- Paper-set marks totals and control-character scanning: gated since `7728996`.
- OG image, E4.2 subscriptions infra, `reserved_concurrent_executions`, the
  `invoked_via_function_url` question: closed or consciously deferred elsewhere.
- IGCSE subjects 0610/0620/0625/0500: explicitly out of scope (wave-2 decision #1), a
  wave-3 candidate — not an oversight.
