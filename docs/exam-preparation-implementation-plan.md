# Exam Preparation Implementation Plan

## Product direction

Octav Learning's primary student loop becomes:

**Select an exam scope → practise → review every mistake → try a similar question → take another targeted test.**

Study notes and flashcards remain published and searchable, but become supporting material reached from questions and weak areas. The change is one of product hierarchy, not deletion of learning content or a destructive data migration.

The reviewed question bank, not an LLM, is the source of generated tests. AI is added later as optional contextual help inside this loop.

## Phase 1 — Complete the practice-and-review loop

### Question review and richer attempt data

- Extend per-question results with the selected choice and an optional question snapshot.
- Keep all new fields optional in local storage, sync payloads and DynamoDB records.
- Preserve the existing attempt IDs, aggregate scores and mastery behaviour.
- Show a question-by-question review on the results screen, including the student's answer, correct answer and authored explanation.
- Let students retry only the questions they answered incorrectly.
- Offer a fresh set of similar questions where variant/template content can provide one.
- Keep legacy attempts usable for scores and broad topic analysis; never invent answer details that were not recorded.

### Custom test builder

- Add a student-facing builder for subject, year/course, topics, question count, difficulty and timed/untimed mode.
- Assemble deterministic seeded tests from approved multiple-choice questions on the server.
- Balance coverage across selected topics; do not use an LLM to invent questions.
- Return source topic metadata with every question so completion can update per-topic progress.
- Route the builder's draw through the existing public content API, with the same free-content cache boundary and request budget as mixed review.
- Support retrying mistakes and generating another test over the same scope.

### Phase 1 acceptance

A student can select several topics, complete a custom test, inspect each wrong answer, retry only those mistakes, and start another comparable test. A normal topic quiz provides the same review and mistake-retry experience. Existing stored progress still loads and syncs.

## Phase 2 — Persistent mistake notebook and visible improvement

- Derive unresolved mistakes and weak topics from attempt history rather than maintaining a second authoritative progress store.
- Add a mistake notebook grouped by subject and topic.
- Use richer attempts for detailed review and label legacy records when only an aggregate or correctness result exists.
- Resolve a weakness only after the existing consecutive-correct mastery rule is satisfied on related questions.
- Add “Generate a test from my weak topics” and show improvement between initial and targeted attempts.
- Avoid a backfill: old attempts contribute only the information they actually contain.

## Phase 3 — Contextual AI help

- Add help actions after a question has been attempted: simpler explanation, hint, worked example, and why the selected answer was wrong.
- Supply bounded context: question, selected answer, correct answer, authored explanation, relevant topic notes, subject and year/course.
- Keep reviewed explanations as the default; label generated help clearly.
- Use a separate server endpoint, provider contract, controllable dummy, quota and operational telemetry from AI marking.
- Do not permit answer revelation before an attempt. Do not request personal or school information.
- Keep requests ephemeral by default; define retention and deletion before storing conversations or feedback ratings.
- Add free-text follow-up only after the fixed actions pass correctness, usefulness, safety and cost evaluation.

## Phase 4 — More realistic exam preparation

- Combine multiple-choice and reviewed free-response questions where the course content supports both.
- Add marks-based papers, overall timing, written-answer review and existing AI marking.
- Extend exam results additively with per-question outcomes; old exams retain their summary view.
- Evaluate printable revision and parent-facing summaries separately from the student workflow.

## Data compatibility and rollout

All phases use additive schema evolution. No table re-keying, bulk rewrite, forced logout, anonymous-progress reset or fabricated historical answer data is permitted.

For Phase 1, the progress read/sync path must accept optional richer question results before clients emit them. Existing producers and consumers must continue to work with `questionId + correct` only. Generated questions carry a snapshot so later review does not confuse two different instances sharing a template ID.

Each phase has its own unit, integration, end-to-end, mobile/desktop, light/dark and static-export verification. Later phases do not begin while the preceding phase's acceptance path is broken.

## Measurement

Compare before/after behaviour using existing anonymous analytics and add only necessary events:

- Test and quiz completion rate
- Results-review usage
- Mistake-retry start and completion
- Similar-question practice usage
- Custom-test creation and completion
- Improvement on targeted retries

Do not use AI message volume as a success measure. Phase 3 additionally measures helpfulness, retry success, failures and cost.
