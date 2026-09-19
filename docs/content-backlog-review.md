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

### D. Content defects the gates cannot see

This is the cheapest item here and the only one whose value is *student-facing
correctness* rather than volume. Three named classes, none of them caught by anything:

1. **Markscheme independence.** 233 FR questions / **580 markscheme points** are checked
   only for `marks === markscheme.length`. `CONTENT_STYLE.md:103` requires every point to
   be independently awardable with every essential step covered; nothing enforces it. A
   non-independent point marks students down silently in production. (AGENTS.md names
   this as the highest-value AI-judgement job available.)
2. **MC answer keys.** `correctIndex` is only range-checked 0–3
   (`src/content/schema.ts:56`). A second defensible answer is invisible to every gate —
   and it is the defect that actually harms a student. Measure-then-gate as a regression
   guard for new content; expect low yield on the existing 3765 (the 2026-09-17 sample
   found zero errors).
3. **Difficulty tags.** AGENTS.md records that 0 of 5 `hard`-tagged questions were judged
   hard, with drift ≤0.03 (systematic, not flaky) — one (`bio-cell-1`, single-fact
   recall) looks like a genuine mis-tag against `CONTENT_STYLE.md:88`. The tags feed
   `STANDARD_MIX`/`HARD_MIX` in mock papers, so a mis-tag changes what a mock looks
   like. Blocked on a human decision, not on tooling: hand-label ~30 questions from one
   subject and decide which side is wrong.

### E. Traffic / SEO depth

Not a content gap and not measurable from the JSON — listed for completeness because the
queue line includes it. What is known: 335 indexable of 887 pages, and PROGRESS has
described the hubs as "thin" with weak internal linking since 2026-08. Nothing in this
review changes that assessment; it needs its own measurement pass against Search Console
data, which is a different job from this one.

---

## 3. Recommended order

1. **D (quality)** — smallest, highest certainty, improves live content, and every later
   item adds more content that would otherwise need the same check afterwards. Do the
   markscheme pass first; it covers all 580 points with no new content.
2. **C (wiring)** — the generators are built and tested; this is the best
   content-per-hour available, and it lands inside an existing plan with decisions
   already locked.
3. **B (illustrations)** — requires the density decision above, then start the 5 bare
   subjects (66 topics) rather than scattering across maths.
4. **A (DP AA)** — the biggest win and the biggest commitment; start it deliberately, not
   as filler, and consider whether AI parity (~30 topics) or a smaller honest AA subset
   is the right first cut.

Items 1–3 are all *additive to what exists*; item 4 is a new course and should be a
planned chain like the IGCSE pilot, not a side quest.

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

## 5. Decisions this review needs from you

1. **Illustration standard:** ≥1 figure per topic (106 figures) or 1 per note (~1312)?
   Recommended: the former, per subject, with the 5 bare subjects first.
2. **DP Math AA:** commit to a planned chain (~30 topics + course entry + papers), or
   defer it and say so on `/ibdp` so the page doesn't imply coverage it lacks?
3. **Quality pass now or with new content?** Recommended: now — the markscheme pass
   covers existing content and every later item benefits.

## 6. Not backlog (already done — don't re-queue)

- Paper-set marks totals and control-character scanning: gated since `7728996`.
- OG image, E4.2 subscriptions infra, `reserved_concurrent_executions`, the
  `invoked_via_function_url` question: closed or consciously deferred elsewhere.
- IGCSE subjects 0610/0620/0625/0500: explicitly out of scope (wave-2 decision #1), a
  wave-3 candidate — not an oversight.
