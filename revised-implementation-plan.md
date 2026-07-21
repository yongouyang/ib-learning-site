# IBLearn — Revised Implementation Plan (Y7 → IBDP)

> Supersedes the roadmap portions of `ib-books-analysis-and-implementation-plan.md`.
> Benchmark: Revision Village (RV), researched 2026-07-21 (sources cited inline).
> Student context: GSIS — UK KS3 in Y7–Y9 (from Aug 2026), Cambridge IGCSE in Y10–Y11, IBDP in Y12–Y13.
> Tech stack: unchanged (Next.js 15 static + later serverless API route, React 19, Tailwind, KaTeX, Vitest/Playwright, Vercel).

---

## 1. Revision Village benchmark — verified findings

### 1.1 What RV actually covers

| Segment | RV coverage | Source |
|---|---|---|
| IB DP (14 subjects) | Math AA & AI (SL/HL), Bio, Chem, Phys (SL/HL), ESS, Psych, Business, Econ, History, English Lang&Lit + Lit, English/Spanish/French B | [homepage](https://www.revisionvillage.com/), [Gold FAQ](https://www.revisionvillage.com/revision-village-gold/) |
| IGCSE | **Math only**: Cambridge 0580 Core/Extended, 0606 AddMath, Edexcel 4MA1 F/H, 4PM1 — at `igcse.revisionvillage.com`; only Questionbank live, Practice Exams/Past Papers "Coming Soon" | [IGCSE homepage](https://igcse.revisionvillage.com/) |
| Y7–Y9 / KS3 / MYP | **Nothing.** No KS3/MYP content anywhere on the domain | verified negative |
| AP / A-Level | Not offered (marketing mentions only) | verified negative |

**Key correction to our earlier assumption:** RV *does* cover IB English (Lang & Lit and Literature, SL/HL), but has **no** IGCSE sciences, **no** IGCSE English, and **no** Y7–Y9 content at all. For KS3 and IGCSE (except math organization) we benchmark against official syllabi instead:

- UK KS3 Maths & Science programmes of study — [gov.uk maths](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study), [gov.uk science](https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study), [gov.uk English](https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study/national-curriculum-in-england-english-programmes-of-study)
- Cambridge IGCSE: [Math 0580](https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf), [Biology 0610](https://www.cambridgeinternational.org/Images/697203-2026-2028-syllabus.pdf), [Chemistry 0620](https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf), [Physics 0625](https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf), [First Language English 0500](https://www.cambridgeinternational.org/Images/635230-2024-2026-syllabus.pdf)
- IB DP: [Lang & Lit](https://www.ibo.org/programmes/diploma-programme/curriculum/language-and-literature/language-a-language-and-literature/), [Literature](https://www.ibo.org/programmes/diploma-programme/curriculum/language-and-literature/language-a-literature/)

### 1.2 RV feature set (all verified on public pages)

1. **Questionbank** — exam-style questions per topic/sub-topic, ordered easy→medium→hard, tagged calculator/non-calculator, each with student-friendly step-by-step markscheme + video solution. ~20+ questions per sub-topic; AA HL Topic 1 alone has 229.
2. **Practice Exams** — 4 types: Popular Quizzes (~10 questions, one concept, 30–60 min), **Revision Ladder** (10 levels, whole syllabus, increasing difficulty), Mock Exams (full paper simulation), **Prediction Exams** (novel paper ~1 month before each session).
3. **Past Papers** — real IB questions with video solutions; RV does **not** host exam PDFs (copyright — directs students to school/Follett).
4. **Key Concepts** — 5–10 min theory recap videos per sub-topic (our "study notes" analog).
5. **Flashcards** — terminology cards **plus MCQs**; progress shown as dual-ring donut: outer ring "Seen" (purple), inner ring "Known" (green `#12B76A`/`#D1FADF`).
6. **Newton AI** — hints/coaching on any question, real-time marking against the markscheme (with marks), photo upload of handwritten answers. Beta, Gold-only, usage-limited.
7. **Bootcamps**, **Mobile app** (iOS/Android), educator analytics.
8. Pricing: free tier (subset of topics) / $249 per course / $499 all subjects, **one-time**, not subscription.

### 1.3 RV design system (extracted from live HTML/CSS)

RV is Next.js + MUI/Emotion; we stay Tailwind — below is the token mapping.

- **Color**: page bg `#F4F4F4`; white cards `border-radius:16px`, `shadow-lg`; primary navy `#032254`; heading slate-navy `#2E4871`; body slate `#596D8E`; accent blue `#0081D6` (CTAs, progress bars); eyebrow blue `#2B96DD`; success `#12B76A` on `#D1FADF`; grays `#ACB6C7/#8191AA/#D4DAE2/#EBEDF1`; borders `#E8E8E8`.
- **Subject color-coding** (white glyph on `rounded-lg` colored square): Math `#0081D6` blue · Sciences `#032254` navy · Humanities `#B52209` red · English `#51104B` purple · Languages `#985514` amber.
- **Typography**: Manrope 800 headings (tight tracking, `-0.4px`), Inter 400/600 body (`text-sm` dominant); eyebrow labels `text-xs font-semibold` above card titles ("Topic 1", "Theme A").
- **Progress visuals**: thin linear progress bar + % label on every topic card; **dual-ring donut** for two-metric progress (Seen/Known); no bar/radar mastery charts publicly visible.
- **Components**: pill buttons (`rounded-full`), accordion topic groups → sub-topic card grids, breadcrumbs on all inner pages, exam cards with calculator/no-calculator glyph + question count + duration, "RV Free/Gold" chips.
- **Navigation**: subject mega-grid grouped by IB subject group; course page = vertical stack of resource cards (Questionbank / Practice Exams / Key Concepts / Past Papers / Flashcards); questionbank = Topic accordion → sub-topic cards.
- **Dark mode**: none on web. (We keep ours — it's a differentiator.)

---

## 2. Gap analysis — where IBLearn stands today

Current content (`src/content/data/topics/`): **117 topics** — math 68, english 15, biology 13, chemistry 11, physics 12 (ibLevel currently "MYP"/DP-ish labels).

| Area | Status | Gap |
|---|---|---|
| KS3 Math Y7 | ✅ ~22 topics | Minor polish |
| KS3 Math Y8 | ✅ 16 topics | Minor polish |
| KS3 Math Y9 | ❌ | ~16 topics missing (surds/standard form depth, quadratics intro, trig intro, simultaneous eqns, inequalities, 3D trig-free geometry, error intervals…) |
| KS3 Science | ✅ 36 topics across bio/chem/phys | Roughly KS3-aligned already; re-tag stage, fill "Working Scientifically" |
| KS3 English | ✅ 15 topics | Re-map to the 4 statutory strands (Reading, Writing, Grammar & Vocabulary, Spoken English); add Y8/Y9 progression |
| IGCSE Math 0580 | ❌ | 9 official topics → ~25–30 app topics, Core/Extended tiering |
| IGCSE Bio 0610 / Chem 0620 / Phys 0625 | ❌ | 21 + 12 + 6 official topics (2026–2028 syllabi) |
| IGCSE English 0500 | ❌ | Skills-based: comprehension & summary, language analysis, directed writing, descriptive/narrative composition, speaking & listening |
| DP Math | ⚠️ Partial | ~21 `math-dp-*` topics, all AI-HL-flavored. Need: retag as AI, add missing AI topics (in progress: Markov chains ✅, volumes of revolution, further diff eqs), then full AA SL/HL + AI SL sets |
| DP Sciences | ❌ | Bio themes A–D (~40 sub-topics), Chem S1–S3/R1–R3 (22), Phys themes A–E (~22), 2025-exam syllabi, SL core first then HL/AHL |
| DP English Lang & Lit | ❌ | 3 areas of exploration, 7 concepts, Paper 1/2, IO/global issues, HL essay |

Feature gaps vs RV (current app: study notes, flashcards, MCQ quiz, mixed review, localStorage progress):

1. **Question volume & difficulty tiers** — we have fixed 15/topic MCQ; RV has ~20+/sub-topic with easy/medium/hard ordering.
2. **Question types** — MCQ only; RV is exam-style short/extended answer with markschemes. This is the prerequisite for AI marking.
3. **Practice exams** — no timed mocks, no revision-ladder equivalent.
4. **Past-paper-style sets** — none (must be original questions + worked solutions; never host real IB/CAIE PDFs).
5. **AI feedback** — none (approved: serverless API route + LLM).
6. **Progress analytics** — basic stars/streaks; RV-style rings/mastery missing.
7. **Curriculum browsing** — current subjects page is flat; needs stage (KS3/IGCSE/DP) × course hierarchy.

---

## 3. Data model changes (minimal, additive)

All changes keep the JSON-file-per-topic convention and generated registry.

1. **Stage/level tagging**: extend `src/content/schema.ts` — replace/augment `ibLevel` with:
   - `stage`: `"ks3" | "igcse" | "dp"`
   - `year`: `7 | 8 | 9` (ks3 only)
   - `course`: e.g. `"0580"`, `"0610"`, `"dp-ai"`, `"dp-aa"`, `"dp-bio"` …
   - `level`: `"core" | "extended"` (IGCSE), `"sl" | "hl"` (DP) — HL/Extended topics reference their SL/Core base where applicable.
   - Migration: script rewrites existing files (yr7/yr8 → ks3+year; `math-dp-*` → stage dp, course `dp-ai`, level hl where applicable). Update `scripts/validate-content.ts` + `generate-registry.ts`.
2. **Topic ID conventions** (new): `math-yr9-*`, `math-igcse-*`, `bio-igcse-*`, `chem-igcse-*`, `phys-igcse-*`, `eng-igcse-*`, `math-dp-ai-*` / `math-dp-aa-*` (rename existing `math-dp-*` → `math-dp-ai-*` with a one-time migration), `bio-dp-*`, `chem-dp-*`, `phys-dp-*`, `eng-dp-*`.
3. **Difficulty tiering on questions** (phased, per decision): add optional `difficulty: "easy" | "medium" | "hard"` and `calculator: boolean` to question schema now; populate on new content immediately, backfill later.
4. **New question type (Phase 4 prerequisite)**: `freeResponse` — stem, model answer / markscheme points (array of marking points), marks total. Renders as "write your answer, then reveal/compare markscheme" before AI marking exists.

Content standards stay: 7 notes / 12 flashcards / 15 questions (CONTENT_STYLE.md), `validate:content` + `audit:content` green. New standard for tiered expansion: high-value topics grow to ~30 questions (10 per difficulty) in a later phase.

---

## 4. Content roadmap (all stages in parallel, per decision)

Per-topic syllabus maps are verified (§1.1 sources). Rough topic counts (app-level topics, 7/12/15 standard):

| Track | Topics to build | Notes |
|---|---|---|
| KS3 Math Y9 | ~16 | Completes KS3 number/algebra/ratio/geometry/probability/stats domains |
| KS3 Science re-tag + gaps | ~6 new + re-tag 36 | Add "Working Scientifically" topics per subject |
| KS3 English re-map | re-tag 15 + ~6 | 4 strands; Y8/Y9 progression topics |
| IGCSE Math 0580 | ~28 | 9 official topics; Core vs Extended sub-topic tags |
| IGCSE Sciences | 21 bio + 12 chem + 6 phys (split phys ~12) | 2026–2028 syllabi; Supplement content tagged |
| IGCSE English 0500 | ~12 | Paper 1 reading skills, Paper 2 directed writing & composition, S&L |
| DP Math AI | ~10 more | Finish SL set + HL (Markov ✅, vol. of revolution, further diff eqs pending from PROGRESS) |
| DP Math AA | ~30 | SL core first (shared with AI SL where identical), then HL |
| DP Sciences | ~40 bio + 22 chem + 22 phys | 2025-exam syllabi; SL core first, HL/AHL flagged |
| DP English Lang & Lit | ~15 | Textual analysis, comparative essay, IO, HL essay, 7 concepts |

Sequencing rule: within each track, order topics by school-year relevance (Y7-now first), SL/Core before HL/Extended.

---

## 5. Feature roadmap (phases)

**Phase 1 — Curriculum foundation (data model + browsing)**
- Schema changes from §3, migration script, registry update.
- Subjects page → stage-aware browsing: KS3 (Y7/8/9) / IGCSE / IB DP groupings, course cards with progress bars (RV pattern), breadcrumbs already in place.
- Update AGENTS.md/CONTENT_STYLE.md with new fields and ID conventions.

**Phase 2 — Question bank & difficulty**
- `difficulty`/`calculator` tags surfaced in quiz UI (badges), quiz ordered easy→hard, filter by difficulty.
- Mixed review + weak-areas reuse difficulty weighting.

**Phase 3 — Practice exams**
- Timed mock mode per course (question sampler matching real paper structure: e.g. IGCSE 0580 P2 non-calc/P4 calc; DP P1 non-calc/P2 calc).
- "Revision Ladder" analog: N cross-topic sets of increasing difficulty per course (generated from tagged question pool).
- Results screen per exam; stored in localStorage progress.

**Phase 4 — Free-response + worked solutions ("past-paper-style")**
- `freeResponse` question type with markscheme points and self-marking checklist UI.
- Past-paper-*style* sets (original questions only — copyright-safe, RV's model), arranged by year-like sets per course.

**Phase 5 — AI feedback (approved: API route)**
- `app/api/feedback/route.ts` (serverless): sends student free-response + markscheme points to an LLM, returns marks + feedback; rate-limited, API key in env (never client-side), graceful degradation to self-marking when key absent.
- Later: hint mode on any question; photo/handwriting input deferred (needs vision model + upload storage).

**Phase 6 — Progress analytics & flashcard upgrade**
- RV-style dual-ring donut (Seen/Known) for flashcards; linear progress bars on topic/course cards; per-topic mastery from quiz history.
- Spaced-repetition scheduling for flashcards (already on backlog) feeds the Known ring.

**Phase 7 — Platform (deferred, per decision)**
- PWA (offline content, install prompt) — backlog item, fits before any native consideration.
- Accounts + sync + subscriptions: **explicitly deferred** to the future AWS/public-cloud phase (user decision). Design note only: keep progress state shape versioned (`version` field in localStorage payload) now, so a future server sync can migrate cleanly. No auth work in this plan.

---

## 6. Design refresh (Tailwind, no stack change)

Adopt the RV visual language as tokens in `tailwind.config.ts` and `globals.css` (keep our dark mode — extend tokens, don't remove):

- Colors: surface `#F4F4F4` (light bg), card white `rounded-2xl shadow-lg`, navy `#032254`, heading `#2E4871`, body `#596D8E`, accent `#0081D6`, eyebrow `#2B96DD`, success `#12B76A`/`#D1FADF`. Subject hues: math `#0081D6`, sciences `#032254`, english `#51104B`, (reserve humanities red `#B52209`).
- Fonts: add Manrope (headings, 800) + Inter (body) via `next/font` — replaces current font setup.
- Icons: keep `lucide-react`; add rounded-square subject icon tiles (white glyph on subject color) — hand-rolled SVG tiles, not a new library.
- Components to restyle/build: subject/course cards with progress bar + % label, pill buttons, accordion topic groups, difficulty/calculator badges, dual-ring donut (hand-rolled SVG — no chart lib needed for two rings).
- Our existing SVG illustration system and `validate:illustration-layout` gate stay as-is (RV has almost no illustrations — ours are a strength).

---

## 7. Quality gates & process (unchanged + additions)

- Existing gates stay mandatory: `generate:registry`, `validate:content`, `validate:illustrations`, `validate:illustration-layout`, `audit:content`, `npm test`, `test:e2e`.
- Schema migration adds: fixture topics for new fields; validator rules (stage/course/level consistency, difficulty values).
- Every session: PROGRESS.md entry per AGENTS.md.

## 8. Explicit non-goals (for now)

- No auth/accounts/subscriptions (future AWS phase).
- No native mobile app (PWA first).
- No real IB/CAIE past-paper PDFs (copyright).
- No MYP content track (GSIS uses UK KS3/IGCSE — existing `ibLevel: "MYP"` labels get remapped to KS3/stage tags).
- No Bootcamps/video content (out of scope for a single-author project).
