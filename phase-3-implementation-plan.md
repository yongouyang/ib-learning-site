# Phase 3 — Practice Exams: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 3.
> Goal: timed mock exams per course (sampler matching real paper structure, using the Phase 2 tags) + a Revision Ladder of cross-topic sets of increasing difficulty — with per-exam results stored in localStorage.
> Sized for: **3 focused sessions** (breakdown in §5).
> Depends on: Phase 2 (difficulty/calculator tags on all 1,970 questions) — done.

---

## 1. Scope

**In:**
- Timed mock mode per course grouping (the same 8 groupings as diagnostics): overall countdown, auto-submit on expiry, results screen per exam.
- **All mock papers are non-calculator** (user decision 2026-07-24): the sampler excludes `calculator: true` questions. Paper variants split by difficulty lean instead (P1-style standard mix, P2-style harder mix). Caveat recorded: DP-AI's real papers allow a GDC, so its mocks are non-calculator *practice*, not true paper simulation.
- Revision Ladder: 5 levels per course, 10 questions each, distribution shifting easy→hard by level, sequential unlock, per-level best score stored.
- Storage: `examResults` + `ladderProgress` added to the localStorage payload (additive, optional fields, `version: 1` stamped — the Phase-7 forward-compat field, folded in now).
- Entry points: nav/homepage/progress links; tests + docs.

**Out (deliberately):**
- **IGCSE mocks** — zero IGCSE topics exist; the sampler is course-generic so IGCSE mocks appear automatically when content does.
- **"Predicted" periodically-refreshed mocks** (parent plan's nice-to-have) — needs an authoring pipeline, not this phase.
- **Free-response questions / markschemes** — Phase 4; mocks stay multiple-choice.
- **No per-question history** — still Phase 6.

**Paper-structure assumptions (recorded honestly):**
- All mocks are non-calculator (user decision). For DP-AI this diverges from real exam conditions — both AI papers allow a GDC — so DP mocks are non-calculator practice, not true paper simulation. If a calculator-allowed variant is ever wanted, the tags are there.
- KS3: no national exam structure (SATs long abolished); school end-of-year papers are commonly mixed difficulty. Our P1/P2 split is by difficulty lean, not by calculator.

---

## 2. Current state (verified at planning time)

- Question pool: 129 topics / 1,970 questions, all difficulty-tagged (32/43/24 E/M/H); 92 `calculator: true` (math only). Calculator-tag counts per math grouping: Y7 ≈ 14, Y8 ≈ 29, Y9 ≈ 12, DP-AI ≈ 37.
- Course groupings: `src/lib/diagnostics.ts` `DIAGNOSTIC_COURSES` (8 ids with `matches(topic)` predicates) — **extract into a shared course map** reused by diagnostics, mocks, and ladder.
- Sampler: `stratifiedSample(pool, targets, accessor)` in `src/lib/quiz-utils.ts` (Math.random) + seeded round-robin builder in `diagnostics.ts` (deterministic).
- Quiz runner: `QuizGame` — per-question timer only (`enableTimer`/`timerSeconds`); results screen = score % + stars; `onQuestionResult` callback exists.
- Storage: `src/lib/progress-store.ts` — `iblearn_progress` = `{ userProgress, topicProgress }`, no version field. Attempts are per-topic only; synthetic topics (mixed-review) already leak into weak-area lists (pre-existing quirk — **do not add exam synthetic topics**; store exam/ladder results in their own fields).
- Weak areas consume `topicProgress` only — exam results must NOT feed it directly (a mock's 8/20 aggregate says nothing topic-level).

---

## 3. Design decisions

### 3.1 Shared course map

Extract the 8 course predicates from `diagnostics.ts` into `src/lib/courses.ts` (`COURSES: { id, title, matches }[]`), re-exported from diagnostics for backward compat. Mocks/ladder consume the same ids; URLs stay consistent (`/exams/math-y7`, `/exams/math-y7/ladder`).

### 3.2 Mock exams

- **Route**: `/exams` (index: one card per course with its available papers) + `/exams/[courseId]/[paperId]` runner. Paper ids: `paper-1`, `paper-2`.
- **Paper definitions** (`src/lib/exams.ts`), per course — all sample from non-calculator questions only (`calculator: true` excluded):
  - KS3 math (y7/y8/y9): `paper-1` = standard mix (5E/9M/6H), 20 questions, 30 min; `paper-2` = harder mix (3E/8M/9H), 20 questions, 30 min.
  - KS3 eng/bio/chem/phys: `paper-1` = standard mix (5E/9M/6H), 20 questions, 25 min. (No paper-2 for v1 — single school-test style paper.)
  - math-dp-ai: `paper-1` = short-response style (6E/10M/4H), 20 questions, 30 min; `paper-2` = extended style (3E/8M/9H), 20 questions, 35 min.
- **Sampler**: seeded deterministic per (course, paper) like diagnostics — same rationale (SSR-safe, retake parity). Bands via round-robin topic spread builder already proven in diagnostics; generalize that builder to accept (course, bandTargets, length, excludeCalculator, seed) and share it between diagnostics and exams (`src/lib/question-sets.ts` or extend diagnostics lib — decide in implementation, one home only).
- **Overall timer**: extend `QuizGame` with `timerMode?: 'per-question' | 'overall'` (default `'per-question'`, current behavior unchanged). Overall mode: single countdown in the header, no per-question reset; on expiry auto-finish — unanswered questions count as incorrect (`onQuestionResult(id, false)` for each unanswered, then `onComplete`). 60s/question equivalent pacing is preserved by paper durations above.
- **Results screen**: after completion, an exam-specific results view (score %, band breakdown correct/total per difficulty, time used, "Retake" + "Back to exams"). Implemented in the runner (not inside QuizGame) using `onQuestionResult` tallies — QuizGame's own results screen is bypassed via the existing `onComplete` flow... **decision**: keep QuizGame's results screen for consistency, and record the exam result there; the band-breakdown results view is a ladder/exam-results enhancement only if cheap — **cut**: v1 = QuizGame standard results + stored result + "last result" shown on the exam index card. Band breakdown deferred to Phase 6 analytics.
- **Storage**: `examResults: { examId: string, date: string, correctCount: number, totalCount: number, secondsUsed: number }[]` appended on completion; `recordExamResult` in progress-store; context exposes it. Exam results do NOT touch `topicProgress` (no weak-area pollution). Index card shows best/last score.

### 3.3 Revision Ladder

- **Route**: `/exams/[courseId]/ladder` (level list) — or fold into the course exams page. **Decision**: `/exams/[courseId]` shows papers AND the ladder (one course page, fewer routes); ladder level runs at `/exams/[courseId]/ladder/[level]`.
- **Levels** (`src/lib/ladder.ts`): 5 levels × 10 questions, band targets:
  L1 6E/3M/1H · L2 4E/4M/2H · L3 3E/4M/3H · L4 2E/4M/4H · L5 1E/3M/6H.
  Deterministic seeded sets per (course, level); no timer (practice, not exam). Non-calculator policy applies here too (calc-tagged questions excluded).
- **Unlock rule**: level N+1 unlocks when level N completed with ≥ 60%. `ladderProgress: Record<string /* courseId */, Record<number, { bestScore: number, completedAt: string }>>`.
- **Recording**: ladder attempts do NOT write `topicProgress` either (same pollution argument); only `ladderProgress` via `recordLadderResult(courseId, level, score)`.

### 3.4 Storage changes (`progress-store.ts`)

```ts
interface StoredData {
  version?: number;            // absent in legacy payloads — treat as 1
  userProgress: UserProgress;
  topicProgress: Record<string, TopicProgress>;
  examResults?: ExamResult[];                          // new
  ladderProgress?: Record<string, Record<number, LadderLevelResult>>; // new
}
```
Additive + optional → zero migration; old payloads parse fine, new fields default to empty. `version: 1` written on next save. ProgressContext exposes `examResults`, `ladderProgress`, `recordExamResult`, `recordLadderResult`.

### 3.5 Entry points & tests

- Progress page Practice card: add "Mock Exams" link → `/exams`. Homepage: skip (already has diagnostics card in cold-start; avoid clutter) — **revisit in Session 2 if the exams index deserves a homepage slot**.
- Unit: paper definitions validity (bands sum, durations), sampler calc-filter behavior, overall-timer expiry logic (QuizGame test), unlock rule, storage round-trip incl. legacy payload without new fields.
- E2E: exams index; full paper-1 run with overall timer visible; result recorded (index shows score); ladder level 1 run → level 2 unlocked.

---

## 4. Task breakdown (ordered)

**Session 1 — libs + storage**
1. `src/lib/courses.ts` shared course map; refactor diagnostics to use it (no behavior change — diagnostics tests stay green).
2. progress-store: `version`, `ExamResult`, `ladderProgress` + `recordExamResult`/`recordLadderResult`; ProgressContext exposure; legacy-payload test.
3. Generalize the seeded topic-spread set builder (params: course, targets, length, calculator filter, seed) shared by diagnostics + exams + ladder.
4. `src/lib/exams.ts` paper definitions + `src/lib/ladder.ts` level definitions; unit tests.

**Session 2 — mock exams UI**
5. `QuizGame` `timerMode='overall'` + auto-submit-on-expiry (+ unit test).
6. `/exams` index + `/exams/[courseId]` (papers + ladder entry) + `/exams/[courseId]/[paperId]` runner with result recording.
7. Progress page CTA. E2E: index + full timed run + recorded result.

**Session 3 — revision ladder UI + wrap-up**
8. `/exams/[courseId]/ladder/[level]` runner + unlock logic UI.
9. E2E: ladder run → unlock. Full gate suite.
10. Docs: AGENTS.md conventions if any changed, PROGRESS.md entries per session.

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Course map extraction, storage extension, shared set builder, exam/ladder definitions | 2–3 h | Unit tests green; diagnostics behavior unchanged |
| **2** | Overall timer, exam routes + runner, CTA, e2e | 2–3 h | Full timed mock run records a result; gates green |
| **3** | Ladder UI + unlock, e2e, docs | 2–3 h | Ladder run unlocks L2 e2e; full gate suite green |

## 6. Open questions (resolve in Session 1)

1. ~~KS3 math paper-2 pool depth~~ — **moot**: calculator-allowed papers dropped (user decision); all papers exclude `calculator: true` questions.
2. Retake policy: deterministic sets mean retakes are identical (as with diagnostics). Acceptable for v1; a "generate new set" button (seed = courseId + attempt count) is a cheap later add — decide in Session 2 if it bothers.
