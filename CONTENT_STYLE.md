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
  "ibLevel": "MYP",
  "notes": [...],
  "flashcards": [...],
  "questions": [...]
}
```

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

## LaTeX

- Only use characters that KaTeX can render inside `$...$` / `$$...$$`.
- Avoid raw Unicode symbols such as `★`, `🚲`, or `½` inside math delimiters.
- Use proper LaTeX commands: `\frac{1}{2}`, `\times`, `\text{unit}`.

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
