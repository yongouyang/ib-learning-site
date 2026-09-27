# Content gap roadmap — the improvement room beyond backlogs A–E

**Measured 2026-09-27** on `develop` @ `ae7eb9a` (245 topics / 4,221 MC questions / 31 paper
sets), by reading `src/content/data/**` directly. This doc is the multi-iteration programme
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
| Topics | **245** | every one at the 7 notes / 12 flashcards / 15 questions standard — **0 below it** |
| Stage split | **ks3 197 (80%) · igcse 16 (7%) · dp 32 (13%)** | all non-KS3 content is math-only |
| MC questions | **4,221** | difficulty 32% easy / 42% medium / 26% hard, 0 untagged |
| Fresh variants on retake | **245 / 245** | 219 templated (64 generators) + 40 variant-grouped, 14 overlap |
| Paper sets | **31 across 15 courses** | 2 per course (math-igcse has 3); set 1 free, 2+ premium |
| Figures | **430 SVGs** | 245/245 topics illustrated, but density is bimodal (gap 2 below) |

Per-subject (topics / stages covered / figures per topic):

| subject | topics | stages | figs/topic | variant mechanism |
|---|---|---|---|---|
| math | 104 | ks3+igcse+dp | 1.0 | generators + variant groups |
| english | 34 | ks3 | 1.0 | flashcard-match drill only |
| chinese | 20 | ks3 | 1.0 | flashcard-match drill only |
| biology | 14 | ks3 | 6.6 | generators |
| physics | 14 | ks3 | 5.7 | generators + variant groups |
| chemistry | 13 | ks3 | 5.6 | generators + variant groups |
| german | 13 | ks3 | 1.0 | flashcard-match drill only |
| ict | 12 | ks3 | 1.0 | flashcard-match drill only |
| history | 11 | ks3 | 1.0 | flashcard-match drill only |
| geography | 10 | ks3 | 1.0 | flashcard-match drill only |

---

## Gap 1 — Stage skew: IGCSE and DP exist only in math

**Measured:** 9 of 10 subjects are KS3-only. The exam-tier product (IGCSE hub, IBDP hub,
diagnostics, mock exams, premium papers) is a math-only product today.

**Size options:**
- **IGCSE wave 3** (the wave-2 plan's named successor): 0610 Biology, 0620 Chemistry,
  0625 Physics, 0500 English First Language. At ~10–14 topics + 2 paper sets per subject
  that is **~40–56 topics + 8 paper sets**, each new subject also needing a `courses.ts`
  entry and the count-churn checklist from `igcse-wave2-plan.md` §7.
- DP beyond math (e.g. DP Physics/Biology): larger, later — DP has far less search demand
  than IGCSE and the AA/AI pair already anchors the tier.

**Iteration shape:** one subject per wave (pilot precedent: 10 topics, then 6). Science
subjects map cleanly onto existing KS3 topic structure as prerequisites; 0500 is
skills-assessed, not topic-syllabused — needs its own fit decision.

**Status: NEXT — see `docs/igcse-wave3-plan.md`.**

## Gap 2 — Illustration density: 100 topics sit at the 1-figure floor

**Measured:** biology/physics/chemistry average 5.6–6.6 figures per topic (per-note
standard); the other seven subjects sit at exactly 1.0 — the "≥1 figure per topic" floor
settled 2026-09-19 (backlog review §5.2). That is **204 topics at the floor** (math 104,
english 34, chinese 20, german 13, ict 12, history 11, geography 10). The full "1 per
note" alternative was priced at ~1,312 figures and rejected as a single job.

**Right-sized iteration:** a *targeted* pass, not per-note: the 2–3 further notes per topic
where a figure teaches most. Shard by subject so each session's review batch stays
reviewable — **math + english first (138 topics, ~300–400 figures)**, then the 66-topic
non-math floor (chinese/german/ict/history/geography, ~150–200 figures). Language subjects
keep the poster-style exception (backlog review §2.B) — their figures are vocab posters,
so the pass there is smaller per topic.

## Gap 3 — Paper depth: premium exhausts at set 2

**Measured:** 14 of 15 courses have exactly 2 sets; a paying student finishes a course's
premium papers in one sitting (set 1 free + set 2 premium = 40 marks of practice per
course). Free-response is the highest-value premium surface (AI-marked), and the thinnest.

**Iteration shape:** **set 3 per course**, 8 questions / 20 marks / `marks ===
markscheme.length`, weighted toward the course's newest topics. 15 courses → 15 sets.
Caution carried from 2026-09-24: new set wording must not collide with free-corpus
explanations *or vice versa* — the leak gate treats a shared 48-char window as a leak in
either direction, so author sets and topic text with distinct phrasing.

## Gap 4 — Non-math practice variety: flashcard-match is a recall drill, not a skill

**Measured:** the six generator-less subjects (english, chinese, german, ict, history,
geography = 114 topics) get retake freshness from `flashcard-match` only — term/definition
recall over the topic's own deck. Essay craft, source analysis, map skills, and spoken
English are unmechanized *by design* (backlog review §2.C), so the gap is narrower than it
looks: what is actually missing is **authored variant groups** in those subjects (the
mechanism that closed C for the 26 non-parameterizable math/chem/phys topics).

**Size:** ~26–30 questions per topic × 81 non-language topics — the single largest item
here in authoring hours. **Recommendation: do not do this as a blanket programme.** Do it
per-subject *after* that subject's IGCSE wave lands, when the topics are being re-read
anyway; languages are the standing exception (vocab drilling IS the skill).

## Gap 5 — Difficulty calibration: SETTLED, recorded to stop re-litigation

The 2026-09-19 ruling (backlog review §5.1, `CONTENT_STYLE.md` "How to read the bands",
commit `39e36b6`) stands: the bands are **relative to the topic**, the ramp is enforced by
`audit:content` + `STANDARD_MIX`, all ~950 `hard` tags stand, no gate or mix changes. The
"open decision: difficulty-tag ruling" line in recent PROGRESS entries is **stale** — the
decision was taken; only the doc references lingered. No work item here.

---

## Recommended iteration order

| # | Item | Size | Why first / what it depends on |
|---|---|---|---|
| 1 | **IGCSE wave 3** (0610/0620/0625, then 0500 decision) | ~30–42 topics + 6–8 paper sets | New audience + exam-tier credibility; machinery exists since the pilot; reuses KS3 subjects as prerequisites |
| 2 | **Paper set 3 per course** | 15 sets × 20 marks | Premium depth; independent of everything; small units |
| 3 | **Targeted illustration density** (math + english first) | ~300 figures | Visible quality; shard by subject; needs nothing new |
| 4 | **Authored variant groups for non-language subjects** | per-subject batches | Fold into each subject's IGCSE wave rather than a standalone sweep |
| 5 | DP sciences / further 0580 maths waves | open | Only after wave 3 ships green and demand data exists (Search Console pass, backlog review §2.E) |

**Standing rules for every iteration:** one subject per wave; Phase-0-style validator
hardening first if the wave introduces a new defect class; the count-churn checklist
(`igcse-wave2-plan.md` §7 + AGENTS.md) is computed at integration time, never trusted from
memory; every numeric answer key is re-derived by hand; `correctIndex` rotated across all
four positions; UX pass waived only for content-JSON-only changes, with the waiver reason
recorded in PROGRESS.md.
