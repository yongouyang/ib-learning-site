# Content gap roadmap — the improvement room beyond backlogs A–E

**Measured 2026-10-28** on `develop` @ `0450702` plus this iteration (300 topics / 5,046 MC
questions / 42 paper sets), by reading `src/content/data/**` directly. This doc is the multi-iteration programme
view: `docs/content-backlog-review.md` §2's five backlogs (A–E) are all **closed**, and what
remains is not debt but *headroom* — coverage the product has not grown into yet. Each gap
below is sized from the corpus, with options and a recommended iteration order. Nothing here
is a defect; the gates are green (`validate:content`, `audit:content` 0/0, leak gate HARD).

Read alongside `docs/CONTENT_STYLE.md` (authoring standard), `docs/igcse-pilot-plan.md` /
`docs/igcse-wave2-plan.md` (the wave mechanics this programme reuses), and
`docs/content-backlog-review.md` (the closed backlogs and their audit trail).

---

## 0. Corpus snapshot (the baseline every iteration moves)

| | Count | Note |
|---|---|---|
| Topics | **300** | every one at the 7 notes / 12 flashcards / 15 questions standard — **0 below it** |
| Stage split | **ks3 197 (66%) · igcse 71 (24%) · dp 32 (11%)** | IGCSE spans math, English, biology, chemistry and physics |
| MC questions | **5,046** | every question difficulty-tagged; bands remain relative to the topic |
| Fresh variants on retake | **300 / 300** | generators, authored variant groups, or flashcard-match drills |
| Paper sets | **42 across 19 courses** | 15 courses × 2; math-igcse and the three IGCSE sciences × 3 |
| Figures | **525 SVGs / 544 illustrated notes** | 300/300 topics illustrated; the 20-topic pilot has 3 figures per selected topic |

Per-subject (topics / stages covered):

| subject | topics | stages | variant mechanism |
|---|---|---|---|
| math | 104 | ks3+igcse+dp | generators + variant groups |
| english | 44 | ks3+igcse | flashcard-match drill only |
| chinese | 20 | ks3 | flashcard-match drill only |
| biology | 30 | ks3+igcse | generators + flashcard-match |
| physics | 28 | ks3+igcse | generators + variant groups + flashcard-match |
| chemistry | 28 | ks3+igcse | generators + variant groups + flashcard-match |
| german | 13 | ks3 | flashcard-match drill only |
| ict | 12 | ks3 | flashcard-match drill only |
| history | 11 | ks3 | flashcard-match drill only |
| geography | 10 | ks3 | flashcard-match drill only |

---

## Gap 1 — Stage skew beyond the first IGCSE subject wave

**Status: IGCSE wave 3 CLOSED (2026-10-23); first Biology wave-2 pair CLOSED
(2026-10-28).** Physics 0625, Chemistry 0620, Biology 0610 and English 0500 have dedicated
topics, hubs, diagnostics and papers. Biology now also covers the previously unhoused
Extended digestion and inheritance/selection objectives. DP remains math-only by design
until demand justifies more.

**Remaining size options:**
- Close the subject-specific gaps deferred by `docs/igcse-wave3-plan.md` §4, one subject at
  a time, verifying that each new topic adds exam-level depth rather than repeating KS3.
- DP beyond math (e.g. DP Physics/Biology): larger, later — DP has less search demand than
  IGCSE and the AA/AI pair already anchors the tier.

**Iteration shape:** one subject per wave. Science subjects map onto existing KS3 topics as
prerequisites; English remains skills-assessed rather than topic-syllabused.

## Gap 2 — Illustration density: 246 topics sit at the 1-figure floor

**Measured:** the 20-topic / 40-figure math + English pilot is complete and every new SVG
has been visually reviewed. That leaves **246 topics at the floor**: math 94, english 34,
biology 17, chemistry 18, physics 17, chinese 20, german 13, ict 12, history 11 and
geography 10. The full "1 per note" alternative remains rejected as a single job.

**Right-sized iteration:** do not automatically expand the pilot. First ship it, observe
use, and keep any later pass targeted to the 2–3 notes per topic where a figure teaches
most. The remaining math/English pool is 128 topics; the other non-science floor is 66
topics, and the one-figure IGCSE science leaves are included in the 52-topic science floor.
Language subjects keep the poster-style exception (backlog review §2.B).

## Gap 3 — Paper depth: premium exhausts at set 2

**Measured:** 15 of 19 courses still have exactly 2 sets. The first batch adds a third
20-mark set to each of `phys-igcse`, `chem-igcse` and `bio-igcse` (60 marks total),
alongside the existing maths third set. Free-response remains the highest-value premium
surface (AI-marked), and the thinnest.

**Iteration shape:** 15 further set-3 opportunities remain, at 8 questions / 20 marks /
`marks === markscheme.length`, weighted toward under-assessed course topics. Do not author
them as one blanket batch: low current paper usage means discovery and learner value should
be checked first. New set wording must not collide with free-corpus explanations *or vice
versa* — the leak gate treats a shared 48-char window as a leak in either direction.

## Gap 4 — Non-math practice variety: flashcard-match is a recall drill, not a skill

**Measured:** the six generator-less subjects (english, chinese, german, ict, history,
geography = 110 topics) get retake freshness from `flashcard-match` only — term/definition
recall over the topic's own deck. Essay craft, source analysis, map skills, and spoken
English are unmechanized *by design* (backlog review §2.C), so the gap is narrower than it
looks: what is actually missing is **authored variant groups** in those subjects (the
mechanism that closed C for the 26 non-parameterizable math/chem/phys topics).

**Size:** ~26–30 questions per topic × 77 non-language topics — the single largest item
here in authoring hours. **Recommendation: do not do this as a blanket programme.** Do it
per-subject *after* that subject's IGCSE wave lands, when the topics are being re-read
anyway; languages are the standing exception (vocab drilling IS the skill).

## Gap 5 — Difficulty calibration: SETTLED, recorded to stop re-litigation

The 2026-09-19 ruling (backlog review §5.1, `CONTENT_STYLE.md` "How to read the bands",
commit `39e36b6`) stands: the bands are **relative to the topic**, the ramp is enforced by
`audit:content` + `STANDARD_MIX`, all `hard` tags stand, no gate or mix changes. The
"open decision: difficulty-tag ruling" line in recent PROGRESS entries is **stale** — the
decision was taken; only the doc references lingered. No work item here.

---

## Usage reassessment (2026-10-28)

Read-only production analytics was queried directly for 2026-09-29…2026-10-28 and the prior
90-day window. The sample is small and includes some testing, so these are directional
signals, not robust conversion rates. In the last 30 days: **147 total events** across all
tracked hosts, **121 production-host events**, **13 quiz starts / 2 completions**, **0 paper
page views**, and **0 recorded views of the new IGCSE science topics**. The 90-day aggregate
has 109 quiz starts / 7 completions, 7 paper-page views and 27 DP-maths page views. By
subject, maths has 42 starts / 0 completions and mixed review 42 / 0; German has 16 / 5 and
Chinese 5 / 2. Starts and completions can cross the window boundary and test traffic may be
uneven, so do not treat these as true cohort conversion rates. Search Console was unavailable
(no connected browser session); impressions, CTR and query-level demand remain unmeasured.

## Recommended iteration order

| # | Item | Size | Why first / what it depends on |
|---|---|---|---|
| 1 | **Maths + mixed-review completion investigation, then discovery measurement** | small UX/analytics investigation | Locate abandonment in the two largest start buckets and obtain Search Console data before funding another large wave |
| 2 | **Ship and evaluate the current illustration pilot** | 20 topics / 40 figures, done | All figures reviewed; expand only if the live pilot proves useful |
| 3 | **Select ONE further paper-set-3 batch from demonstrated demand** | 3–4 sets | 15 courses remain, but current paper usage is too low to justify a blanket programme |
| 4 | **Next subject-specific IGCSE gap wave** | per-subject | Choose Chemistry/Biology gaps from syllabus value plus demand; fold authored variants into that reread |
| 5 | DP sciences / further 0580 maths waves | open | Deferred: no measured demand and no Search Console evidence |

**Standing rules for every iteration:** one subject per wave; Phase-0-style validator
hardening first if the wave introduces a new defect class; the count-churn checklist
(`igcse-wave2-plan.md` §7 + AGENTS.md) is computed at integration time, never trusted from
memory; every numeric answer key is re-derived by hand; `correctIndex` rotated across all
four positions; UX pass waived only for content-JSON-only changes, with the waiver reason
recorded in PROGRESS.md.
