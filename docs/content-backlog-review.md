# Content backlog review

**Measured 2026-09-19** at prod `354858c`, by reading `src/content/data/**` directly.
Every number here is reproducible from the JSON — none is quoted from an older plan.
This doc supersedes the one-line "Standing queue: illustrations 106, traffic/SEO depth,
content depth" that has been copy-pasted between PROGRESS entries since 2026-08: that
line is an append-only snapshot, it has drifted, and it conflates five different jobs.

Read this with `docs/CONTENT_STYLE.md` (the authoring standard) and
`docs/ILLUSTRATION_GUIDELINES.md` (the drawing standard).

---

## 1. What exists today

| | Count | Note |
|---|---|---|
| Topics | **233** | 10 subjects, 3 stages |
| Notes | **1643** | 221 topics × 7; 12 topics carry 8 (a superset, not a gap) |
| MC questions | **3765** | mean 16.2/topic |
| Paper sets | **29** across 14 courses | 13 courses × 2 + `math-igcse` × 3 |
| Free-response questions | **233** | 580 markscheme points; every set totals exactly 20 marks |
| Illustrations | **312 SVG files** | 0 orphans, 0 dangling references — the file set and the content agree exactly |
| Question generators | **18** in `src/content/generators/` | **all 18 are wired into content**, across 9 topics |
| Indexable URLs | **335** of 887 prerendered pages | the rest are deliberately `noindex` |

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

### A. DP Math AA — the only missing *course* (largest gap, and committed scope)

**Zero topics. No `Course` entry. No `aa` token anywhere in `src/`.** DP Math today is
20 topics, all `applications & interpretation`.

Evidence that this is scope and not a deliberate omission: the phase-1 decision recorded
in PROGRESS.md was "both DP Math AA and AI", and `src/lib/seo/curriculum.ts:34` already
formats a label for it (`IB DP AA (HL)`). `/ibdp` currently advertises "IB Diploma
Programme topics" and lists exactly one subject — Math — whose 20 topics are all AI. A
DP student taking AA (the larger cohort for STEM) finds nothing, on a page that says the
site covers the Diploma.

Size: ~30 topics to reach parity with AI (5 × 7-note topics per syllabus area), plus
*one line* in `courses.ts`, an `order.json` block, a paper set, and the count-churn sites
AGENTS.md enumerates. **No route, schema, sitemap or hub change** — the pilot machinery
already generalises.

Caveat worth stating plainly: this is the most expensive item here by an order of
magnitude, and it is the only one where the *product* claim (an IB DP site) is currently
thinner than the marketing implies.

### B. Illustrations — 106 zero-coverage topics, and 5 subjects with no imagery at all

The queue's "106" is accurate but understates the shape. Coverage is bimodal:

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

### C. Templates — 9 of 233 topics, but the generators are already paid for

18 generators exist and are unit-tested; **all 18 are used, in only 9 topics**. So there
is no wasted code and no generator backlog: the gap is *wiring existing generators into
the remaining 224 topics' param tables*, which is authoring, not engineering.

`docs/question-variations-plan.md` Phase 4 is the live plan, and it is **partly done and
inaccurately described by its own status line** (see §4): Phase 3 (chemistry) is fully
landed — all 12 chem topics expanded to 24–29 questions with 12–14 variant groups — and
the math/physics pilot is landed (4 math + 3 physics topics at 24–28 questions). Phase 4
item 2 names the remainder: "remaining math + physics topics, then biology + english".

Measured state: **19 topics are group-expanded** (12 chem + 4 math + 3 phys) out of 233.
The DP AI topics carry 20 questions each, but that is a different standard (a longer
bank), not variant groups — don't count them as progress.

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
2. **C (wiring)** — the generators are built and tested; this is the best
   content-per-hour available, and it lands inside an existing plan with decisions
   already locked.
3. **B (illustrations)** — standard settled: **≥1 per topic, all 106 zeros**, bare subjects
   first (66 in chinese/german/ict/history/geography, which need a first-ever
   `public/images/<subject>/`), then the 40 remaining zeros in maths/english/sciences.
   Deliberate exception: language subjects get vocab/situation posters, not diagrams.
4. **A (DP AA)** — decided: build it, SL core first (~12 topics). Start with the syllabus map;
   it is the biggest win and fixes a real over-claim on `/ibdp`, but treat it as a planned chain
   (the IGCSE pilot shape), not a side quest.

Sequenced: **D done → C → B → A**, with two cross-cutting tasks alongside any of them — an
AGENTS/plan-doc staleness sweep (two plan docs already claimed "nothing landed" for shipped
work, and AGENTS.md asserted no PITR existed after it was enabled) and the `ci.yml`
`timeout-minutes` gap that cost a 45-minute hang and skipped two deploys on 2026-09-18.

---

## 4. Stale docs found while measuring (fix or they will mislead the next session)

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
