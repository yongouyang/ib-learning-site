# TypeSafe Review — Where Intelligent Judgement Can Replace Fragile Code

> **Status:** Findings + recommendation, **plus a first live measurement pass (§8)**. **Partially acted on since** (note added 2026-09-19, extended 2026-09-26): §2's parser finding was fixed without any AI — `src/components/InlineMath.tsx` is escape-aware, `scripts/audit-content.ts`'s `escaped_dollar` rule was deleted 2026-09-18 (`tests/unit/inline-math.test.tsx` pins it), and `multi_display_math` was deleted 2026-09-25 after `StudyNoteBody` learned mid-line `$$…$$` (`tests/unit/study-note-body.test.tsx` pins it, including the rule's own last test case). §2 below is kept as dated history — its "verifiable in the code today" claims no longer are. §3's first recommendation became `scripts/audit-content-ai.ts` (`--mode=markscheme` / `answerkey` / `difficulty`), whose live measurements are recorded in `docs/content-backlog-review.md` §2.D — and which **corrected §8.1's optimism**: the answer-key judgement is unusable on computational questions (9 of 35 maths questions flagged, every flag a hand-verified false positive, 0 of 55 in other subjects).
> **Reviewed:** 2026-09-17 (branch `develop`, HEAD `b25c1c8`, tree clean) — via the `typesafe-ai` skill,
> including the live docs at `docs.typesafe.ai` (primitives, build guide, API reference, confidence/routing
> patterns, and the vendor's `model-jaggedness/jev-1.13` known-issues page).
> **Measured:** 2026-09-17, against the live API (`jev-latest` → `jev-1.13.0`), 7 questions × 3 runs. See §8.
> **Next action:** §5, now refined by §8 — the answer-key check has clean separation and can go straight to
> a gate; the difficulty Score needs the hand-labelled sample first.

---

## 1. What this review covered

The skill's brief: find places where a narrow, typed judgment (choice / score / yes-no) should stand
in for hand-written parsing, regex proxies, or unenforced human promises.

Explored: the content corpus and its validators (`scripts/validate-content.ts`, `scripts/audit-content.ts`,
`src/content/schema.ts`), the client renderer (`src/components/InlineMath.tsx`, `src/lib/seo/text.ts`),
search/filtering (`src/lib/topic-filter.ts`), the existing LLM path
(`src/lib/feedback/openai-compatible.ts`), SEO id-derivation (`src/lib/seo/curriculum.ts`), the
legal-markdown renderer (`src/components/LegalDocument.tsx`), the BBC authoring pipeline
(`tools/scripts/`), and the deferred `docs/support-bot-plan.md`.

Corpus size at review time (measured, `npm run validate:content` green): **233 topics / 3,765 MC
questions / 0 untagged difficulty** — i.e. every question already carries a human judgement that
nothing machine-checks.

---

## 2. Headline finding: one grammar, three parsers, zero tests on the one that ships

This is the most fragile code in the repo, and **it is not a TypeSafe opportunity** (see §4).

`renderInlineMath` (`src/components/InlineMath.tsx:10–11`) splits content on `/(\$[^$\n]+\$)/` — a
naive regex with **no escape awareness**. Two more parsers of the same string live in the auditor:

| Parser | Location | Behaviour on `\$` |
|---|---|---|
| `renderInlineMath` — **what ships** | `src/components/InlineMath.tsx:11` | no escape handling → delimiters mis-pair |
| `findLatexIssues` — full state machine | `scripts/audit-content.ts:243` | `if (text[i] === "\\") i += 2` — **skips escapes** |
| `findStrayBackslashes` / `findMultiDisplayMath` — line-based delimiter counting | `scripts/audit-content.ts:165`, `:209` | re-derives `inDisplay` by counting `$$` per line |

Consequences, all verifiable in the code today:

- **`audit:content` green means "well-formed LaTeX per an escape-aware parser", not "the page renders
  correctly".** The two disagree by construction on exactly the construct that caused past incidents.
- `findEscapedDollarIssues` (`:190`) exists **only** to ban `\$` — a hand-written rule compensating for
  the renderer lacking what the auditor has. Currency must be written with fullwidth `＄`.
- `findMultiDisplayMath` (`:209`) re-derives, by line-level counting, what the naive splitter will do
  with a case the state machine handles fine.
- **Nothing in `tests/` imports `InlineMath` at all** — 0 references across its 12 consuming components.

Every production bug in this class (`escaped_dollar`, `multi_display_math`, the
`math-yr7-money-finance` ladder corruption, the five 2026-09-03 notes with KaTeX ParseError) was found
in production and then encoded as another rule. The auditor's rules are a shadow implementation of the
shipped parser, kept in sync by hand and asserted only against itself.

**Root fix (small, not AI):** make `renderInlineMath` `\$`-aware, then render every content string
through the *real* splitter in a test with `throwOnError: true`. `katex` is already a dependency
(`package.json:44`, and `audit-content.ts:3` already imports it). That deletes three rules rather than
adding a fourth. This is the single highest-value change in this document and it costs no API calls.

---

## 3. Where intelligent judgement genuinely fits

The corpus is machine-checked only for *shape*: 33 `issues.push` sites in `audit-content.ts`, every
one a length, a count, an id match, or a delimiter scan.

| Check today | Location | What is actually unchecked |
|---|---|---|
| `correctIndex: z.number().int().min(0).max(3)` | `src/content/schema.ts:56` | that the option marked correct **is correct** |
| Explanation ≥ 20 chars, ≠ stem | `scripts/audit-content.ts:479–499` | that the explanation explains *that* option |
| `difficulty` present; ≥3 easy / ≥3 hard | `scripts/audit-content.ts:404–456` | that the tag matches the published rubric |
| Variant group has ≥ 2 members | `scripts/audit-content.ts:458–477` | that variants are actually isomorphic |
| "must be re-derived for correctness before merge" | `docs/CONTENT_STYLE.md:105` | nothing — a human promise, unenforced |

A **second defensible MCQ answer** is the defect that actually harms a student, and no regex can see
it. This is the textbook gap: the evidence exists, the judgement does not.

### #1 — Semantic QA on authored content (offline, authoring path) ★ highest value

**State:** `{ stem, choices[4], correctIndex, explanation, difficulty, topic: { title, stage, year }, rubric }`.

One request, questions asked together over the same state:

- a **`Noul` per choice** — *"Is `choices[i]` a correct answer to `stem`?"* (one per label, because
  several may apply — the second-defensible-answer case is exactly "more than one is true");
- a **`Noul` per choice** for distractor plausibility (wrong but tempting);
- a **`Score`** for difficulty, with the levels lifted verbatim from `docs/CONTENT_STYLE.md:88–90`
  (easy = single-fact recall; medium = apply one rule; hard = multi-step / unfamiliar context).

**Code stays in charge of the policy**, which is where the asymmetry lives and it matters:
a *second* Noul above threshold is a **question-quality defect** (report, fix later); **no** choice
above threshold is a **content emergency** (student cannot answer at all). Different thresholds,
different consequences — that belongs in our code, not in prompt prose.

No prose to parse, no JSON to recover, no retry-and-nudge path, every judgment independently
inspectable. Compare with the current failure mode it replaces: none — this check does not exist.

**Scope honestly:** 3,765 questions × ~9 judgments is a corpus pass, not a CI gate. Run it on the
authoring path for new topics, and on a *sample* first to calibrate the two thresholds. Cost and
latency are unmeasured (§7).

### #2 — Free-text student intent over the topic registry

`src/lib/topic-filter.ts:15–26` is `title.includes(q) || description.includes(q)` on a lowercased
query. A student typing *"why is my gradient negative"* gets an empty page — the topic is titled
"Gradient of a Line". Semantic understanding is exactly what substring matching cannot do.

Shape: find candidate topics in code (the metadata registry already has them), judge the intended one
with a **`Choice`** over candidate ids, and **copy the real id** rather than generating anything.
Keep substring matching as the instant local filter and call out **only when it returns zero results** —
one request, on the rare empty-result path, never in the hot loop.

### #3 — Support triage (deferred v1.1, not existing fragile code)

`docs/support-bot-plan.md:180` recommends shipping triage rule-based, deferring the LLM because it
*"introduces a failure mode (API timeout, parse error)"*. Typed answers with no recovery step and
calibrated probabilities are the direct answer to that specific objection — worth noting **when that
plan resumes**. It is a planned feature, not a defect: do not build it now.

### #4 — Partial fit: the free-response marker (measure before touching)

`src/lib/feedback/openai-compatible.ts:63` is the literal prompt-and-parse step:
`JSON.parse(content)` → zod `safeParse` → one retry with a nudge prompt → `throw new Error('provider
returned malformed JSON twice')` (`:56`) → 502. It is live on DeepSeek in prod.

The **award half** is a clean fit: a `Noul` per markscheme point — *"Does the student's answer satisfy
this markscheme point?"* — with the M/A dependency rule expressed in state rather than in prompt prose,
and `marksFromPerPoint` (`src/lib/feedback/types.ts`) already recomputing marks server-side, so score
inflation is impossible on either path.

**But the fit is only half.** The same prompt also returns a one-sentence comment per point and overall
revision feedback — that is *generation*, not judgement, and `markResultSchema` requires those strings.
TypeSafe would cover the award decisions and leave a second provider in the tree for the prose.

**Therefore: measure first.** If the malformed-JSON/502 rate and the marking variance are not a real
problem, this is a rewrite for its own sake. Do not start here.

---

## 4. Deliberately NOT recommended

Recorded so a future session does not re-litigate these.

- **Do not put a model in the rendering path to fix §2.** Three hand-maintained parsers are replaced by
  one test on the shipped splitter, not by a fourth implementation. Judgement is the wrong tool: the
  renderer's behaviour is deterministic and testable, so it should be *tested*, not *guessed*.
- **Do not AI `src/lib/seo/text.ts` (`plainText`).** It looks like the same anti-pattern but is not: no
  tool converts KaTeX to plain text, and it is already pinned by real assertions against the corpus
  (`tests/unit/seo-metadata.test.ts:29–55`). Leave it.
- **Do not AI `courseCodeFor` (`src/lib/seo/curriculum.ts:45–61`).** It parses topic ids by splitting on
  `-` and filtering structural tokens — genuinely fragile, but every field it recovers is *already on
  the taxonomy object*. That is a **data** fix, not a judgement fix. (It is also why `AGENTS.md` says
  never re-derive a tier from an id.)
- **Do not extend `LegalDocument.tsx`'s markdown parser with AI.** Its limits are already paid for by
  `tests/unit/legal-pages.test.tsx`, and the file's own comment states the correct upgrade path: adopt a
  real markdown dependency if the documents need richer constructs.
- **Do not semantic-match `tools/scripts/bbc-curation-map.json`.** It is a one-shot authoring map, mostly
  complete, and `docs/revised-implementation-plan.md` Phase 1.5 already treats it as hand-curated
  reference material. Low value, high ceremony.

---

## 5. Recommended next session (2026-09-18)

Ordered, and deliberately starting with the free win.

1. **Fix §2 first — it needs no API key and no decisions.** Make `renderInlineMath` `\$`-aware; add a
   unit test that renders every content string for one subject through the real splitter with
   `throwOnError: true`; then delete `findEscapedDollarIssues` and check whether
   `findStrayBackslashes` / `findMultiDisplayMath` are still load-bearing. One runnable check replaces
   three shadow parsers.
2. **The answer-key half of #1 is already de-risked (§8) — build it.** Separation was wide and stable in
   all 21 observations: the marked-correct option scored 0.87–0.99, the highest distractor 0.02–0.15, and
   the correct option won every run. A threshold anywhere in 0.3–0.7 separates cleanly on this sample, so
   this can become a real gate. Still start on **one subject** and hand-check the flags before wiring.
3. **The difficulty half needs the hand-labelled sample before anything is decided (§8).** The Score is
   stable (drift ≤0.03) but systematically disagrees with our `hard` tags — 0 of 5 hard-tagged questions
   were judged hard. Stable disagreement means this is a decidable question, not flakiness: hand-label
   ~30 questions from one subject and ask which side is wrong. Do **not** wire it to a gate until then.
4. **Only then** decide whether #1 becomes a script (`scripts/audit-content-semantic.ts`), a step in the
   authoring workflow, or both.

Explicitly **not** in scope for tomorrow: #2, #3, #4.

---

## 6. Decisions needed before work starts

- **API access.** ✅ Done 2026-09-17 — key lives in `~/.config/typesafe/env` (mode 600), sourced from
  `~/.zshrc`, so every local project inherits `TYPESAFE_API_KEY` / `TYPESAFE_BASE_URL` /
  `TYPESAFE_DEFAULT_MODEL`. Verified live: HTTP 200, `jev-latest` → `jev-1.13.0`. **Never
  `NEXT_PUBLIC_*`** — that prefix is inlined into the client bundle; the key is server-side only. A
  TypeSafe integration will still need a controllable dummy per the standing external-dependency rule
  (`src/lib/feedback/dummy.ts` is the template) before it can be unit-tested or run in e2e.
- **Cost and budget ceiling.** First real basis from §8: **~800 in / ~95 out tokens and 240–740 ms per
  question** for 5 judgments in one request. So a 25-topic subject (~400 questions) is roughly 320k in /
  37k out tokens in ~2–5 minutes of wall clock. Batched per question, not per judgment — the docs are
  explicit that packing many questions into one query is the efficient use of context. Unit pricing not
  yet obtained, so no currency figure is asserted here.
- **Where this runs.** Offline script (batch, no user waiting) vs. authoring-time gate (blocks a new
  topic) vs. CI gate. Recommendation stands: offline only at first.
- **Failure policy.** Now split by half, because the evidence differs (§8): the **answer-key check**
  separated cleanly and stably and is a candidate for a real gate; the **difficulty check** must stay
  advisory until the hand-labelled sample says which side is wrong.
- **Model version pinning.** The alias `jev-latest` resolved to `jev-1.13.0`. Any gate built on these
  thresholds must pin the version (or re-verify on alias change), because the vendor documents
  version-specific jagged edges and states several are slated to be fixed in later versions.

---

## 7. What this document does NOT claim

Stated plainly so a future session does not mistake intent for evidence:

- **No code was changed.** Tree is clean at `b25c1c8`; the only artefact of this review is this file.
  The measurement harness (§8) is throwaway and lives in `/tmp`, deliberately not in the repo.
- **§8's sample is 7 questions × 3 runs.** It is a smoke test that de-risks a design, **not** a
  validation. It says nothing about error rates across the 3,765-question corpus.
- **The only ground truth available was our own `difficulty` tags**, which the measurement then
  disagreed with. So §8 cannot settle whether the tags or the model are wrong — that is exactly what
  the hand-labelled sample in §5 is for. Where §8 reports a "disagreement", that word means
  "disagreement with a human tag that may itself be wrong", not "the model found a defect".
- **No currency figure.** Token counts and latency were measured; unit pricing was not obtained, so no
  cost estimate is stated.
- **The opportunity ranking is a judgement, not a pilot result.** #1 is ranked first because it targets a
  defect students currently experience and no existing check can see — not because a corpus-scale pilot
  proved it works.

---

## 8. First measurements (2026-09-17, live API)

Harness: throwaway `/tmp/typesafe-smoke.mjs` + `/tmp/typesafe-batch.mjs`. One request per question,
**5 judgments batched** (a `Noul` per choice + one `Score` for difficulty) over a named `state` of
`{ topic, question }`. The question's own `difficulty` tag was **not** included in state, so the
difficulty judgment is independent of the tag it is compared against. Model: alias `jev-latest` →
reported `jev-1.13.0`.

### 8.1 The answer-key half works, and it is deterministic

Marked-correct option vs. highest-scoring distractor, over 3 runs (21 observations):

| Topic | tag | correct `Noul` | max distractor | correct option won? |
|---|---|---|---|---|
| math-dp-ai-quadratics | hard | 0.950 → 0.960 → 0.970 | 0.030 → 0.040 | ✅ all 3 |
| math-dp-ai-quadratics | easy | 0.990 ×3 | 0.020 ×3 | ✅ all 3 |
| phys-electricity-1 | hard | 0.980 ×3 | 0.020 ×3 | ✅ all 3 |
| chem-acids-1 | hard | 0.970 ×3 | 0.050 → 0.080 | ✅ all 3 |
| bio-cell-1 | hard | 0.970 ×3 | 0.030 ×3 | ✅ all 3 |
| eng-creative-1 | hard | 0.870 → 0.890 | 0.130 → 0.150 | ✅ all 3 |
| eng-creative-1 | easy | 0.980 ×3 | 0.030 ×3 | ✅ all 3 |

- **Separation is wide:** correct 0.87–0.99, best distractor 0.02–0.15. The closest any distractor came
  was 0.15 (the "Retorted" option on the English question) — still a 0.72 gap.
- **Drift is ≤0.02 on every value across runs.** The check is effectively deterministic, which is what
  makes it safe to gate on. Same property the vendor calls "self-consistent".
- **Extremes of the `Score` scale are sound.** A control run with deliberately fixed inputs gave
  `trivial → 0.01` (`P(0)=1.00`), `mid → 0.70`, `very hard → 1.98` (`P(2)=0.99`) — so level 2 is fully
  reachable and the primitive discriminates across its whole range.

### 8.2 The difficulty half disagrees with our tags — and that is the finding

| Topic | human tag | `Score` | `P(hard)` | verdict vs. tag |
|---|---|---|---|---|
| math-dp-ai-quadratics | hard | 1.09 → 1.11 | 0.10 → 0.12 | disagrees (→ medium) |
| math-dp-ai-quadratics | easy | 0.62 → 0.65 | 0.00 | agrees |
| phys-electricity-1 | hard | 0.89 → 0.90 | 0.00 | disagrees (→ medium) |
| chem-acids-1 | hard | 0.93 → 0.94 | 0.00 | disagrees (→ medium) |
| bio-cell-1 | hard | 0.34 → 0.38 | 0.00 → 0.01 | disagrees (→ **easy**) |
| eng-creative-1 | hard | 0.84 ×2 | 0.01 | disagrees (→ medium) |
| eng-creative-1 | easy | 0.10 → 0.13 | 0.00 | agrees |

**0 of 5 hard-tagged questions were judged hard**, and drift was ≤0.03 — so this is a *systematic*
offset, not noise. Because it is stable, it is a decidable question: either our `hard` tags are too
generous, or the Score's middle is compressed. The vendor documents the second effect explicitly —
*"score levels are weak in numerical calibration. You can use the expectation to check if it passes a
particular threshold"* — which is precisely why these must be used as **thresholds, never as magnitudes**.

One case looks like a genuine catch: `bio-cell-1`'s question is *"Why do root hair cells have no
chloroplasts?"* — single-fact recall, which `docs/CONTENT_STYLE.md:88` defines as **easy** — yet it is
tagged `hard` and scored 0.34–0.38. That is the model agreeing with our own written rubric against our
own tag. One sample is not a finding, but it is the exact shape of what the hand-labelled pass should
look for.

### 8.3 Harness lesson: the first "ambiguity" was our own instruction

The English question first scored **0.510** on the correct option — a coin flip that looked like a
question defect. The cause was the harness: the `Noul` instruction was hardcoded as *"Judge
**mathematical** correctness only"*, which is nonsense for a dialogue-tag question. Rewording it to be
subject-neutral moved the same option to **0.880–0.890** with no change to the content.

This is documented behaviour — jagged edge #1 *"answers the question you wrote, not the one you meant"*
and #7 *"contradictory instructions and criteria"* — and it is the concrete reason the skill says to keep
judgments narrow and to put boundary cases in the criteria. **Expect the first calibration run to find
the harness before it finds the content.** Any future findings must be re-checked against the instruction
text before being reported as a content defect.

A second harness lesson, cheaper: one run reported a failure that was simply a wrong file path
(`bio-cells-1.json` vs the real `bio-cell-1.json`). Verify the input before diagnosing the model.
