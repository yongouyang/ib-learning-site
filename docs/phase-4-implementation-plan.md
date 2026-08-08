# Phase 4 — Free-Response + Worked Solutions: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 4.
> Goal: a `freeResponse` question type with markscheme points and a self-marking checklist UI, plus original past-paper-*style* sets per course (copyright-safe — the RV model: original questions only, format referenced, never copied).
> Sized for: **3 focused sessions** (breakdown in §5).
> Depends on: Phase 3 (course map, seeded set builder, storage v1, exam runner patterns).

---

## 1. Scope

**In:**
- New content type: **practice sets** (`src/content/data/papers/<courseId>/<set-id>.json`) — original free-response questions arranged by course, "year-like" set titles (Set 1, Set 2…).
- `FreeResponseQuestion` schema: `{ id, stem, marks, markscheme[], modelAnswer, difficulty?, calculator? }` where `marks === markscheme.length`.
- Registry + validators + audit support for the new content tree.
- Self-marking UI: student writes an answer (textarea) → reveals markscheme checklist → ticks achieved points → marks recorded. Model answer shown after self-marking.
- Results storage: reuse `examResults` (marks achieved / total marks fit `correctCount`/`totalCount` exactly; `secondsUsed` tracked).
- `/papers` index + `/papers/[courseId]/[setId]` runner routes.
- Non-calculator policy (Phase 3 user decision) applies: authored questions must not require a calculator; the `calculator` field exists in the schema for future use.
- Tests + docs.

**Out (deliberately):**
- **AI marking** — Phase 5. The UI is structured so an "AI mark" button slots in later (student answer + markscheme points are exactly what the Phase 5 API route will send).
- **Free-response questions inside topics** (per-topic practice) — sets are course-level only in v1; topic-level FR is a later content decision.
- **Real past papers / copied questions** — legal constraint (§7 parent plan): original questions only.
- **Predicted/refreshed papers** — still the parent plan's nice-to-have.
- **Second sets per course** — v1 is one set per course (8 sets); more sets are pure content additions once the pipeline is proven.

---

## 2. Current state (verified at planning time)

- Question schema is MC-only; no type discriminator. QuizGame and all quiz flows expect `choices`/`correctIndex` — **FR content must not enter the `questions` array**.
- Content pipeline: topic JSONs → `generate-registry.ts` (imports + `topicSchema.parse`) → `registry.ts`; validators `validate-content.ts` + `audit-content.ts` walk `src/content/data/topics/`.
- Course map: `src/lib/courses.ts` (8 ids). Storage: `examResults[]` in progress-store v1, exposed via context (`recordExam`, `examResults`).
- Runner patterns: `ExamRunnerClient` (deterministic set + overall timer + `recordExam`), diagnostics runner (per-question callback fan-out).
- Difficulty rubric: CONTENT_STYLE.md (applies to FR tagging too).

---

## 3. Design decisions

### 3.1 Content model

```
src/content/data/papers/<courseId>/<set-id>.json
{
  "id": "math-y7-set-1",
  "courseId": "math-y7",
  "title": "Practice Set 1",
  "durationMinutes": 30,
  "questions": [ FreeResponseQuestion × ~8 ]
}
```

- `paperSchema` (zod): `id` (regex `<courseId>-set-<n>`), `courseId` (must exist in `COURSES`), `title`, `durationMinutes` optional, `questions` min 5.
- `freeResponseQuestionSchema`: `id`, `stem` (min 1), `marks` (int 1–10), `markscheme` (array of strings, length === marks — refined), `modelAnswer` (min 1), `difficulty` optional (rubric applies), `calculator` optional (must be absent/false per policy — validator rule).
- Markscheme point style (CONTENT_STYLE.md): short imperative point per mark, prefixed by type — `M1` method, `A1` accuracy, `B1` independent fact (standard exam convention, original text).
- Question counts per set: 6–10 questions, ~20 marks total, difficulty ramp easy→hard within the set.

### 3.2 Registry / validators

- `generate-registry.ts`: second pass over `data/papers/**` → `getPaper(courseId, setId)`, `getPapersForCourse(courseId)`, `getAllPapers()`; parse via `paperSchema`.
- `validate-content.ts`: new `validatePapers()` — schema parse, `courseId` exists in `COURSES`, folder name === courseId, marks === markscheme.length, `calculator: true` rejected (policy).
- `audit-content.ts`: papers pass — IDs unique globally (across topics AND papers), modelAnswer ≥ 40 chars, markscheme points ≥ 8 chars, difficulty presence warning (same as MC), unreadable-file handling. New issue types on the existing report.

### 3.3 Self-marking runner UI

`/papers/[courseId]/[setId]/page.tsx` + `PaperRunnerClient` (new component, NOT QuizGame — different interaction):

Per question (one at a time, easy→hard order):
1. **Answer stage**: stem (InlineMath), marks badge (`3 marks`), difficulty chip (reuse classes from QuizGame badges), textarea for the student's answer (kept in state; disabled after reveal).
2. **Mark stage** (after "Check answer"): model answer shown; markscheme points as a checklist — student ticks each achieved point; overall timer keeps running (overall mode like exams; paper is untimed if `durationMinutes` absent — v1 sets are timed).
3. Marks for the question = ticks count → "Next question".

Completion: results screen (total marks / max, %, stars per existing thresholds) → `recordExam({ examId: <set id>, correctCount: marksAchieved, totalCount: totalMarks, secondsUsed })`.

Phase-5 hook: the mark stage is where a "Mark with AI" button will pre-fill the checklist; the runner keeps `{ questionId, studentAnswer, ticks }` in state — exactly the Phase 5 payload shape.

### 3.4 Authoring (Session 2)

- 8 sets (one per course), 6–10 original FR questions each, 20 marks total target.
- Method: LLM swarm per subject area (math split KS3/DP) with a strict brief: original questions only (no copying from real papers — format/mark style referenced only), markscheme in M/A/B style, model answers worked in full, rubric difficulty tags, non-calculator.
- Math sets: worked numeric answers with steps. Science: point-marked explanation answers. English: mini-essay/comprehension answers with content-point markschemes.
- Spot-check: random sample per set — answers correct, markscheme consistent with model answer.

### 3.5 Entry points & tests

- `/papers` index (course cards → sets with best-score badges, same `PaperScore` pattern as /exams). Progress page CTA ("Practice Papers"). /exams cards get a link to the course's paper sets (cross-link).
- Unit: schema (marks===markscheme.length refinement), validators, registry accessors, self-mark tally logic (runner component test), storage round-trip.
- E2E: index; full set run (type answer → reveal → tick points → next) → best score on index; cross-link from /exams.

---

## 4. Task breakdown (ordered)

**Session 1 — schema, pipeline, pilot UI**
1. `freeResponseQuestionSchema` + `paperSchema` in `schema.ts` (+ types.ts).
2. `generate-registry.ts` papers pass; validators + audit rules.
3. Hand-author pilot set `math-y7-set-1` (8 questions, ~20 marks) — nails the markscheme style guide.
4. `PaperRunnerClient` + routes (`/papers`, `/papers/[courseId]/[setId]`), results into `examResults`; progress CTA.
5. Unit tests (schema, validators, runner tally) + e2e pilot flow; gates.

**Session 2 — authoring swarm**
6. Author the other 7 sets (swarm, per-subject batches); diff-check schema validity; spot-check answers/markschemes.
7. Gates (validate:content + audit now cover papers); registry regen.

**Session 3 — integration + wrap-up**
8. /papers index with score badges; cross-links from /exams; any polish from Session 1–2 learnings.
9. Full e2e; CONTENT_STYLE.md (markscheme style), AGENTS.md (papers content tree conventions); PROGRESS.md.

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Schema, registry/validators/audit for papers, pilot set, runner UI + routes | 3–4 h | Pilot set runs end-to-end; gates green |
| **2** | Author 7 remaining sets via swarm | 2–3 h | All 8 sets pass validators + audit; spot-checks pass |
| **3** | Index, cross-links, docs, full e2e | 1–2 h | Full gate suite green |

## 6. Open questions (resolve in Session 1)

1. **Set size** — 8 questions / 20 marks is the default; adjust if the pilot shows self-marking pace is slower (textarea + checklist per question). Sets can vary 6–10 questions.
2. **Timer default** — 30 min for ~20 marks (≈1.5 min/mark) as the pilot baseline; tune per course after the pilot run.
3. **English markschemes** — content-point style (B1 per valid point) vs level descriptors; pilot decision: content points (self-marking needs discrete ticks).
