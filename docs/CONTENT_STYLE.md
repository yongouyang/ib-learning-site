# Content Style Guide

This guide documents the conventions for topic JSON files in `src/content/data/topics/`.

## File structure

Each topic is a single JSON file validated against `src/content/schema.ts`.

```json
{
  "id": "math-yr7-fractions",
  "subjectId": "math",
  "title": "Fractions",
  "description": "...",
  "stage": "ks3",
  "year": 7,
  "notes": [...],
  "flashcards": [...],
  "questions": [...]
}
```

## Stage & course tagging

Every topic carries a curriculum taxonomy (replacing the old `ibLevel` field):

| Field | Values | Rules |
|---|---|---|
| `stage` | `ks3`, `igcse`, `dp` | Required. |
| `year` | `7`, `8`, `9` | KS3 only; omit for topics spanning years (e.g. science). |
| `strand` | `reading`, `writing`, `grammar-vocabulary`, `spoken-english` | KS3 English only; the subject page groups English by strand when present. |
| `course` | IGCSE: `0580`, `0610`, `0620`, `0625`, `0500` · DP: `aa`, `ai`, `bio`, `chem`, `phys`, `langlit` | Required for `igcse` and `dp`. |
| `level` | IGCSE: `core`, `extended` · DP: `sl`, `hl` | IGCSE/DP only; omit for KS3. |

`npm run validate:content` enforces consistency (year ⇒ ks3, core/extended ⇒ igcse, sl/hl ⇒ dp, course required for igcse/dp, strand ⇒ ks3 english).

## Topic ID conventions for new topics

- KS3: `<subject>-yr<7|8|9>-<slug>` (e.g. `math-yr9-quadratics`, `geo-yr8-plate-tectonics`, `hist-yr8-ww1`, `ict-yr7-python-basics`, `chin-yr7-greetings-names`, `germ-yr8-food-drink`); `<subject>-<slug>-1` for KS3 science/English topics that span years (no `year` field).
- IGCSE: `<subject>-igcse-<slug>` (e.g. `bio-igcse-enzymes`).
- DP: `<subject>-dp-<course>-<slug>` (e.g. `math-dp-ai-sequences`, `math-dp-aa-proof`, `phys-dp-kinematics`).

## Target sizes

A complete topic should contain:

| Section | Target | Minimum |
|---|---|---|
| Notes | 7 | 5 |
| Flashcards | 12 | 8 |
| Questions | 15 | 5 |

Newly created topics may temporarily fall below the target, but they should not be below the minimum when merged.

## Notes

- Use a consistent heading structure with emojis:
  - `📌 Definition`
  - `🔑 How it works`
  - `💡 Worked Example`
  - `📎 Key Points to Remember`
  - `⚠️ Common Mistake`
  - `✅ Check` (optional)
- Keep each note focused on one concept.
- Use LaTeX for math: `$...$` for inline and `$$...$$` for display.

## Flashcards

- Every flashcard must have a non-empty `term` and `definition`.
- Include an `example` whenever it helps clarify the term.

## Questions

- Provide exactly one correct choice.
- The `explanation` must:
  - Be at least 20 characters long.
  - Not be identical to the `stem`.
  - Explain why the correct answer is right (and, where useful, why common distractors are wrong).

### Difficulty & calculator tags

Every question must carry a `difficulty` tag (`easy` | `medium` | `hard`); `audit:content` fails on untagged questions and enforces a per-topic minimum of 3 easy and 3 hard. Judge difficulty **relative to the topic's target level** (year/course), not on an absolute scale:

- **easy** — single-fact recall or a direct definition; a student who read the notes once should get it right.
- **medium** — apply one rule or procedure, discriminate between close options, or a short single-step calculation.
- **hard** — multi-step procedure, prediction/application in an unfamiliar context, or fine discrimination across several options — the questions a typical student at this level is most likely to miss. (For recall-heavy subjects like science, scenario-based prediction *is* the hard band.)

Aim for roughly 30% easy / 40% medium / 30% hard per topic.

Math questions may also carry `"calculator": true` when a calculator/GDC is genuinely expected (awkward decimal arithmetic, trig lookups, regression, distribution probabilities, matrix operations, numerical solving). Omit the field otherwise — never write `"calculator": false`. KS3 is mostly non-calculator; DP-AI allows a GDC on all papers (the P1-non-calc convention is AA, not AI). The tag is math-only (`validate:content` rejects it on other subjects).

## Practice papers (free-response sets)

Free-response sets live in `src/content/data/papers/<courseId>/<courseId>-set-<n>.json` — one file per set, separate from topic MC questions. Course IDs come from `src/lib/courses.ts`.

- **Original questions only.** Past-paper-*style* is the goal; never copy or adapt real exam questions (legal constraint).
- Set shape: `{ id, courseId, title, durationMinutes?, questions[] }`; 6–10 questions, **exactly 20 marks** total, ≥ 5 distinct topics per set, difficulty ramped easy → hard (tag every question; the MC rubric applies).
- Each question: `{ id: "<courseId>-set-<n>-q<i>", stem, marks, markscheme, modelAnswer, difficulty }`.
- **`marks` must equal `markscheme.length`** — one tickable point per mark (schema-enforced).
- **Markscheme style**: short point per mark, prefixed by type — `M1`/`M2` method, `A1`/`A2` accuracy (depends on the method mark), `B1`/`B2` independent fact or content point. Points must be independently awardable (no double-counting; every essential step covered). Keep each point ≥ 8 characters.
- **Model answers** are fully worked (≥ 40 characters) and must be re-derived for correctness before merge; every quotation referenced by a markscheme point must appear verbatim in the stimulus.
- **Non-calculator**: all numbers must be mental-math tractable / exact forms. Do not add a `calculator` field (the validator rejects `calculator: true` for now).
- English sets: short-answer comprehension/mini-analysis (not full essays); stimulus passages must be original; markscheme = content points (`B1` per valid point).

## LaTeX

- Only use characters that KaTeX can render inside `$...$` / `$$...$$`.
- Avoid raw Unicode symbols such as `★`, `🚲`, or `½` inside math delimiters.
- Use proper LaTeX commands: `\times`, `\text{unit}`.
- In JSON, LaTeX backslashes must be doubled (`\\times`, never `\times`) — a single backslash before `t`/`n`/`r`/`b`/`f` is a valid JSON escape and silently becomes a control character (tab, newline…), corrupting the math.
- Always use `\dfrac{a}{b}` (not `\frac{a}{b}`) so fractions render at full, readable size both inline and in display math.
- Write currency amounts as plain text outside math (`£28`), not `£$28$` or `\pounds` — keeps the £ symbol in the same font as the surrounding sentence.
- Do not end content lines with a single `\` (Markdown hard break) — the renderer does not interpret it and the audit flags it.
- Inline `$...$` is rendered by KaTeX everywhere content is displayed: note bodies and headings, quiz stems, choices and explanations, flashcards, and topic descriptions. Display `$$...$$` is only supported in note bodies, on one line or as a multi-line block closed by a later `$$` line.

## Bold

- `**bold**` is rendered in every field that supports inline math (note bodies/headings, stems, choices, explanations, flashcards, descriptions, paper stems/model answers/markscheme points).
- Pairs must be balanced on a single line, with plain text inside: no nested `*`, and never span `$...$` math (write `**midpoint** $M$`, not `**midpoint $M$**`).
- `audit:content` flags unpaired, empty (`****`), or math-spanning markers (`unbalanced_bold`).

## IDs

- IDs must be unique within a topic and across the whole project.
- Use the pattern `<topic-id>-<kind>-<short-label>` (e.g. `math-yr7-fractions-frac-q1`).

## Quality checks

Run these commands locally before committing:

```bash
npm run validate:content
npm run validate:illustrations
npm run audit:content
```

The CI pipeline runs both commands and treats any audit warning or validation error as a failure.

## Illustrations

Notes may include an optional `illustration` object:

```json
{
  "illustration": {
    "src": "/images/biology/bio-cell-1-animal-plant.svg",
    "alt": "Labelled comparison of an animal cell and a plant cell.",
    "caption": "Plant cells have a cell wall, chloroplasts, and a large central vacuole."
  }
}
```

See [ILLUSTRATION_GUIDELINES.md](./ILLUSTRATION_GUIDELINES.md) for design standards, file naming, and validation rules.
