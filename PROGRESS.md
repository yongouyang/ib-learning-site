# IBLearn Progress Log

> Append-only journal of work sessions. **Newest entry at the top.**
> Read the last 2–3 entries before starting work; append one entry when done.
> See `AGENTS.md` for the entry format rules.

---

## 2026-07-19 — Hydration mismatch fix (ProgressContext)

Git HEAD: `9767e68` (branch `develop`, uncommitted push pending)
Done: Home page threw a React hydration error for users with saved progress — `ProgressProvider` initialized state via `useState(getUserProgress)`, reading localStorage synchronously, so client render ≠ SSR. Now initializes with the same defaults the server uses and loads real progress in `useEffect` after mount. Fixes streak badge / subject stars / weak-topics panel mismatches in one place.
Verified: tsc ✅, Vitest 87/87 ✅, headless-Chrome check with seeded localStorage (streak badge renders, zero hydration console errors) ✅, e2e app+study+flashcards 42/42 ✅.
Next: 1) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Y8 science expansion. 3) Features: spaced repetition, progress sync, PWA.
Notes: Bug predates the Next 15 upgrade — React 19/Next 15 just surfaced it as a visible recoverable error. ThemeContext already used the correct mount-then-load pattern.

---

## 2026-07-19 — Next.js 15.5.20 + React 19 upgrade (branch pushed)

Git HEAD: `31aece8` (branch `chore/next-15-upgrade`, pushed to origin; NOT merged to develop)
Done: next/eslint-config-next 14.2.35 → 15.5.20, react/react-dom 18 → 19, @types/react* → 19. Async-`params` codemod applied to the 4 dynamic pages (only breaking change for this static site). Found + fixed one real regression: the Next 15 dev-tools button injected in dev overlaid the mobile bottom nav and matched the e2e `Next` locator — disabled via `devIndicators: false` in next.config.mjs. tsconfig auto-updated by the Next 15 build (formatting + ES2017 target). Also fixed a pre-existing e2e bug found this session: Playwright 1.60 renamed the `iPad Pro` device to `iPad Pro 11`, so the iPad project silently ran as a second desktop; after the rename the bottom-nav test's premise broke (app hides bottom nav ≥768px by design) — that test now skips on tablet-width viewports.
Verified: tsc ✅, next build ✅ (all static paths prerender), ESLint ✅, Vitest 87/87 ✅, validate:content ✅, audit:content ✅ 0/0, full Playwright suite 444 passed / 0 failed / 6 skipped ✅ (was 443/7 — iPad now runs the mobile action-button test for real).
Next: 1) **Review + merge `chore/next-15-upgrade` into develop** (user decision). 2) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 3) Y8 science expansion. 4) Features: spaced repetition, progress sync, PWA. 5) Later: `next lint` is deprecated — migrate to ESLint CLI before any Next 16 jump (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
Notes: `devIndicators: false` only affects the dev server; no production change. SVG backlog branch work from earlier today is already on develop (`b87b37e`).

---

## 2026-07-19 — SVG layout backlog cleared (159 files, all subjects)

Git HEAD: `df8819e` + uncommitted changes (branch `develop`)
Done: Fixed every file flagged by the illustration layout checker — biology 45, chemistry 33, math 37, physics 45 (159 total). Fixes were minimal: widened backing rects, moved/shrunk labels, shortened text where meaning is preserved; yr7 math needed the most structural work (re-laid-out sections, viewBox growth for clipped content in math-yr7-probability, math-yr7-transformations, math-yr7-calculations, math-yr7-angles). `validate:illustration-layout` now exits 0 for the first time. Removed one agent scratch file (`scripts/.measure-tmp.mjs`); no files outside `public/images/` touched.
Verified: validate:illustration-layout ✅ (exit 0), validate:illustrations ✅, validate:content ✅, audit:content ✅ 0/0, Vitest 87/87 ✅, illustrations e2e Desktop Chrome 119/119 ✅.
Next: 1) **User visual review + commit** of this batch (spot-check the rebuilt yr7 SVGs: math-yr7-probability, math-yr7-transformations). 2) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 3) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Work done by a 4-agent swarm (one per subject), resumed after a 30-min timeout and a quota cut-off. The layout gate is now green — keep it that way: run `npm run validate:illustration-layout` before committing any SVG change.

---

## 2026-07-18 — Commit + push of the full fix batch

Git HEAD: `3e29f21` (branch `develop`, pushed to origin, clean tree)
Done: Committed and pushed all work from the four entries below as one commit (73 files). Full verification before commit: Vitest 87/87 ✅, full Playwright suite all devices 443 passed / 0 failed / 7 skipped ✅, all content + illustration gates ✅.
Next: 1) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 2) SVG backlog (161 flagged files — good swarm candidate). 3) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Vercel auto-deploys from develop.

---

## 2026-07-18 — Circle diagram: labels moved outside with leader lines

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`)
Done: Reworked the Circle geometry section of `math-geometry-1.svg` — all 5 labels (centre, radius, diameter, arc, chord) now sit outside the circle with 1.5px colour-matched leader lines, no crossings. Also fixed an accuracy bug: the chord endpoint was outside the circle (was a secant); moved onto the circle. Parent-verified with PNG render + diagnose clean.
Verified: diagnose-illustrations ✅, validate:illustrations ✅.
Next: unchanged (Next.js upgrade, SVG backlog, DP niche topics, Y8 science, features).
Notes: Same uncommitted batch awaiting user review + commit.

---

## 2026-07-18 — Illustration sizing fix + Geometry SVG

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`) — stacks on the two entries below (all uncommitted).
Done:
- **StudyNoteIllustration**: replaced next/image in a fixed 16:10 frame with a plain `<img class="w-full h-auto">` — illustrations now always use full container width at their intrinsic aspect ratio (the new 900x780 fractions SVG was letterboxed before). Local SVGs get no next/image optimisation anyway.
- **math-geometry-1.svg**: viewBox 440→500 tall; polygon formula strip moved from y=400 to y=455 — circle section ("chord" label) no longer collides with the strip (subagent + PNG visual review).
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅, diagnose on geometry ✅, validate:illustrations ✅, illustrations e2e Desktop Chrome 119/119 ✅.
Next: unchanged — 1) Next.js 15.5 upgrade (branch; security patch lands 2026-07-20). 2) SVG backlog (161 flagged files). 3) DP niche topics. 4) Y8 science. 5) Features.
Notes: Still awaiting user manual review + commit approval for the whole uncommitted batch (InlineMath/$ rendering, overflow check, backslash/£/\dfrac content fixes, fractions + geometry SVGs, illustration sizing).

---

## 2026-07-18 — Manual-review fixes: backslashes, £ fonts, \dfrac, Fractions SVG

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`) — NOTE: also includes the still-uncommitted InlineMath/overflow-check work from the previous entry.
Done:
- **Stray `\` at line ends**: cleaned 53 lines in math-algebra-1, math-dp-graph-theory, math-dp-voronoi-diagrams; added `stray_backslash` audit rule; `StudyNoteBody` now supports multi-line `$$...$$` blocks (math-dp-functions fun-n3, math-yr7-negative-numbers n5/n6 previously rendered as raw code text!) and normalizes single `\` → `\\`. New regression test `tests/unit/study-note-body.test.tsx`.
- **£ font inconsistency** (math-fractions-1): currency now plain text outside math; convention documented in CONTENT_STYLE.md.
- **Fraction sizing**: converted all 2,430 `\frac` → `\dfrac` in 56 topic files — fractions now render full-size inline and display (uniform). Convention documented in CONTENT_STYLE.md.
- **Fractions SVG** (math-fractions-1.svg): redesigned 900x500→900x780, five stacked full-width sections (subagent + PNG visual review); passes diagnose-illustrations cleanly.
Verified: tsc ✅, ESLint ✅, Vitest 87/87 ✅ (new study-note-body test), validate:content ✅, validate:illustrations ✅, audit:content ✅ 0/0, diagnose on math-fractions-1 ✅, e2e app+study+flashcards 14/14 ✅.
Next: 1) **Next.js upgrade** — assessed: go to Next 15.5+/React 19 on a branch; only real breaking change for this static site is async `params` in dynamic routes (codemod: `npx @next/codemod@canary next-async-request-api .`); Next security patch lands 2026-07-20 — good time to do it. 2) SVG cleanup backlog (161 flagged files — overlaps/oob/overflow in legacy science SVGs). 3) DP niche topics. 4) Y8 science expansion. 5) Features: spaced repetition, progress sync, PWA.
Notes: Awaiting user manual review before commit. `\dfrac` convention: KaTeX renders it full-size inline; global conversion is visually uniform.

---

## 2026-07-18 — Fix `$` rendering, SVG overflow check + Algebra Basics fix

Git HEAD: `4c52b7f` + uncommitted changes (branch `develop`)
Done:
- Root-caused literal `$` in quiz/flashcards/descriptions: content convention allows `$...$` LaTeX in all fields (audit validates it), but only `StudyNoteBody` rendered it. Created shared `src/components/InlineMath.tsx`; wired into `QuizGame` (stem/choices/explanation), `FlashcardsPageClient` (term/definition/example), `SubjectPageClient` + `StudyPageClient` (description), and note headings in `StudyPageClient`.
- Extended `scripts/diagnose-illustrations.mjs` with a **container-overflow check**: flags text whose centre sits well inside a rect but spills > 4px outside it (edge-hugging labels excluded to avoid false positives). This is the automated "visual acceptance" check.
- Fixed `math-algebra-1.svg` distributive-law label overflowing its green panel (shortened text, widened box 400→415).
- Docs: `CONTENT_STYLE.md` (where LaTeX renders), `ILLUSTRATION_GUIDELINES.md` (overflow rule), `README.md` (layout-check description).
Verified: tsc ✅, ESLint ✅, Vitest 86/86 ✅, validate:content ✅, validate:illustrations ✅, audit:content ✅ (0/0), e2e smoke app+study+flashcards 14/14 ✅ (Desktop Chrome). All 15 English SVGs + fixed math-algebra-1.svg pass the new check.
Next: 1) **SVG cleanup backlog**: full diagnosis flags 161 legacy SVGs — 139 with container overflow (270 spills, mostly labels wider than their backing rects in science SVGs), 31 label overlaps, 17 out-of-bounds. Report at `/tmp/diag-final2.txt` (regenerate with `npm run validate:illustration-layout`). Good swarm candidate. 2) DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 3) Year 8 science expansion. 4) Features: spaced repetition, progress sync, PWA.
Notes: `validate:illustration-layout` exits 1 due to the pre-existing backlog (it already did before this change — 40 files). Changes uncommitted; user reviewing manually before commit.

---

## 2026-07-18 — Finish English illustrations (10 topics)

Git HEAD: `586556f` (branch `develop`, pushed to origin)
Done: Created 10 new SVGs in `public/images/english/` and attached each to notes[0] of its topic — eng-creative-1 (idea-generation techniques), eng-essay-1 (essay/PEEL structure), eng-figurative-1 (simile vs metaphor), eng-grammar-1 (parts of speech), eng-narrative-1 (point of view), eng-nonfiction-1 (text types), eng-persuasive-1 (argument structure), eng-poetry-1 (sonnet structure), eng-reading-1 (inference vs explicit), eng-speaking-1 (presentation structure). English now 15/15 illustrated — all subjects fully illustrated. Also created `AGENTS.md` (session workflow + quality gates) and this `PROGRESS.md`; fixed stale README line 24.
Verified: validate:content ✅, validate:illustrations ✅, audit:content ✅ (0/0), diagnose-illustrations (no issues in any English file) ✅, Vitest 86/86 ✅. E2E not run this session (specs auto-discover from registry).
Next: 1) Add 3 DP niche topics (Markov Chains, Volume of Revolution, Further Differential Equations). 2) Year 8 science expansion (biology + physics). 3) Feature candidates: spaced repetition, progress sync/export, PWA/offline. 4) Housekeeping: archive completed plan docs to `docs/`.
Notes: English illustration pattern = one SVG per topic on notes[0]. Work was done by a 10-agent swarm; several agents saw transient eng-essay-1.json validation errors from concurrent writes — final state verified clean by parent.

---

## 2026-07-18 — Full project status review (baseline)

Git HEAD: `650cc17` (branch `develop`, clean tree). All checks green: `validate:content` ✅, `validate:illustrations` ✅, `audit:content` ✅ (0 errors/warnings), Vitest 86/86 ✅.

**Content totals:** 119 topics, 1,820 questions, avg 15.3/topic.
Math 68 · Biology 13 · Chemistry 11 · English 15 · Physics 12.

**Illustrations:** math 68/68 ✅, all sciences ✅, English 5/15 ⚠️.
English topics missing illustrations: `eng-creative-1`, `eng-essay-1`, `eng-figurative-1`, `eng-grammar-1`, `eng-narrative-1`, `eng-nonfiction-1`, `eng-persuasive-1`, `eng-poetry-1`, `eng-reading-1`, `eng-speaking-1`.

**Roadmap status:**
- Books plan: Phase 1 ✅, Phase 2 ✅, Phase 3 partial — Graph Theory + Voronoi done; Markov Chains, Volume of Revolution, Further Differential Equations NOT added (sources: Save My Exams PDFs, `~/projects/tmp/IB Books/Math/`).
- Y8 plan: math Phases 1–5 ✅, science/English pilot ✅ (3 topics); §9 next steps NOT done (more Y8 bio/phys/English).
- Content migration plan ✅ fully done. Y7 gap-fill ✅.
- No Year 9 / MYP 4–5 content; MYP stops at Year 8.

**Recommended next steps (priority order):**
1. Finish English illustrations (10 topics above) — then fix stale README line 24.
2. Add 3 DP niche topics: Markov Chains, Volume of Revolution, Further Differential Equations (7 notes / 12 flashcards / 15 questions, with illustrations).
3. Year 8 science expansion (biology + physics; see `y8-math-content-sourcing-plan.md` §9).
4. Feature candidates: spaced repetition (builds on `src/lib/weak-point-analyzer.ts`); progress sync/export (localStorage-only today); PWA/offline.
5. Housekeeping: README math illustration status; archive completed plan docs to `docs/`.

---
