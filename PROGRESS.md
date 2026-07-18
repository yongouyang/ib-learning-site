# IBLearn Progress Log

> Append-only journal of work sessions. **Newest entry at the top.**
> Read the last 2–3 entries before starting work; append one entry when done.
> See `AGENTS.md` for the entry format rules.

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
