# Content Migration Plan: From TypeScript to Separate Data Files

> Analysis of moving IBLearn's content from TypeScript modules into separate, DB-migratable files.
> Date: 2026-06-13

---

## 1. Current State

IBLearn content is authored as static TypeScript modules under `src/content/`:

```
src/content/
├── types.ts              # TypeScript interfaces
├── registry.ts           # Aggregates subjects and provides lookup helpers
├── math.ts               # Math subject (37 topics, ~77 KB)
├── english.ts            # English subject (5 topics)
├── biology.ts            # Biology subject (5 topics)
├── chemistry.ts          # Chemistry subject (5 topics)
├── physics.ts            # Physics subject (5 topics)
└── math-phase4-*.ts      # 18 DP math topic files imported by math.ts
```

**Pros of current approach:**
- Type-safe at compile time
- Simple import chain
- Bundled with the app

**Cons of current approach:**
- Content is mixed with code
- Editing content requires TypeScript knowledge
- Content changes trigger full app rebuild
- Harder for non-developers (teachers, content editors) to contribute
- Not portable to a CMS or database
- Large `math.ts` file is unwieldy

---

## 2. Feasibility Assessment

**Verdict: ✅ Highly feasible.**

The current types already describe a clean, relational-ish data model. Moving to separate files is a straightforward refactoring with clear benefits and no technical blockers.

### Why it works well for IBLearn

1. **Content is read-only at runtime** — there are no user edits to content during app use, so we don't need a write path.
2. **Types are already defined** — we can reuse `Topic`, `Subject`, `ConceptNote`, etc. as the schema.
3. **Static-site friendly** — Next.js can import JSON at build time or read files via Node APIs.
4. **DB migration path is clear** — the JSON shape maps directly to SQL/document tables.

---

## 3. Recommended Target Architecture

### Option A: One JSON file per topic (Recommended)

```
src/content/
├── types.ts                     # Keep TypeScript types
├── schema.ts                    # Optional Zod validators for runtime safety
├── registry.ts                  # Updated to load from data/ instead of TS modules
└── data/
    ├── subjects.json            # Subject metadata only
    └── topics/
        ├── math/
        │   ├── math-yr7-calculations.json
        │   ├── math-dp-sequences.json
        │   ├── math-dp-complex-numbers.json
        │   └── ... (37 files)
        ├── biology/
        │   ├── bio-cell-1.json
        │   └── ... (5 files)
        ├── english/
        ├── chemistry/
        └── physics/
```

**Why this is best:**
- Each topic is a standalone document — easy to edit, review, and migrate
- Directly maps to a `topics` table in a database
- Version-control friendly (diffs are isolated per topic)
- Non-developers can edit JSON with schema validation in editors
- Easy to add a CMS later (each JSON file = one CMS document)

### Option B: One JSON file per subject

```
src/content/data/
├── subjects.json
├── math-topics.json
├── biology-topics.json
└── ...
```

**When to use:** Simpler loader, but less granular. Not recommended because it recreates the "giant file" problem for math.

### Option C: Markdown + frontmatter per topic

```
src/content/data/topics/math/math-dp-sequences.md
```

**When to use:** Better for prose-heavy content. Overkill for IBLearn because notes/flashcards/questions are highly structured.

---

## 4. Proposed JSON Schema

Each topic file (`math-dp-sequences.json`) would look like this:

```json
{
  "id": "math-dp-sequences",
  "subjectId": "math",
  "title": "Sequences & Series",
  "description": "Arithmetic and geometric sequences, series, and financial applications.",
  "ibLevel": "DP",
  "notes": [
    {
      "id": "math-dp-sequences-n1",
      "heading": "Arithmetic Sequences",
      "body": "An arithmetic sequence is a list of numbers where each term changes by a fixed amount.\n\n📌 Definition..."
    }
  ],
  "flashcards": [
    {
      "id": "math-dp-sequences-f1",
      "term": "Common difference",
      "definition": "The fixed amount added or subtracted between consecutive terms.",
      "example": "In 3, 7, 11, 15, ... the common difference is 4."
    }
  ],
  "questions": [
    {
      "id": "math-dp-sequences-q1",
      "stem": "Arithmetic: $u_4 = 18$, $u_7 = 30$. Common difference?",
      "choices": ["3", "4", "5", "6"],
      "correctIndex": 1,
      "explanation": "$3d = 30 - 18 = 12 \\rightarrow d = 4$."
    }
  ]
}
```

**Subject metadata** (`subjects.json`):

```json
[
  {
    "id": "math",
    "name": "Math",
    "icon": "function",
    "accentColor": "#3B82F6"
  },
  ...
]
```

---

## 5. Loader Design

Create `src/content/loader.ts`:

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { Subject, Topic } from './types';

const DATA_DIR = path.join(process.cwd(), 'src/content/data');

export async function loadSubjects(): Promise<Subject[]> {
  const subjectsJson = await fs.readFile(path.join(DATA_DIR, 'subjects.json'), 'utf-8');
  const subjectsMeta = JSON.parse(subjectsJson) as Omit<Subject, 'topics'>[];

  const subjects: Subject[] = [];
  for (const meta of subjectsMeta) {
    const topics = await loadTopicsForSubject(meta.id);
    subjects.push({ ...meta, topics });
  }

  return subjects;
}

async function loadTopicsForSubject(subjectId: string): Promise<Topic[]> {
  const topicsDir = path.join(DATA_DIR, 'topics', subjectId);
  const files = await fs.readdir(topicsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const topics: Topic[] = [];
  for (const file of jsonFiles) {
    const content = await fs.readFile(path.join(topicsDir, file), 'utf-8');
    topics.push(JSON.parse(content) as Topic);
  }

  return topics.sort((a, b) => a.title.localeCompare(b.title));
}
```

**Note:** Because this reads files at runtime, it requires the data directory to be present in the deployed bundle. For Next.js static export, we'd either:
- Keep JSON files in `public/` so they're copied as static assets
- Or import JSON directly using `import topic from './data/topics/math/...json'` at build time

For a static-export build, **Option B (build-time imports)** is more reliable.

---

## 6. Build-Time vs Runtime Loading

| Approach | How | Best For | Notes |
|---|---|---|---|
| **Build-time imports** | `import topic from './data/topics/math/...json'` | Static export, Vercel, best performance | Content is bundled; no filesystem reads at runtime |
| **Runtime `fs.readFile`** | Read JSON files from disk at request time | Server-side rendering, API routes | Requires data files to exist on server |
| **Hybrid** | Generate `topics.json` manifest at build time; load at runtime | CMS-like flexibility | More complex |

**Recommendation for IBLearn:** Start with **build-time imports** because the app is currently static and content changes are deployed via code commits.

---

## 7. Migration Path

### Phase 1: Add loader + convert one subject (pilot)
- Create `src/content/data/` structure
- Convert `biology.ts` to 5 JSON topic files
- Write loader and update `registry.ts`
- Ensure all tests pass

### Phase 2: Convert remaining subjects
- Convert `english.ts`, `chemistry.ts`, `physics.ts`
- Convert `math.ts` (split 37 topics into 37 JSON files)
- Delete old TypeScript content files

### Phase 3: Add validation (optional but recommended)
- Add Zod schema in `src/content/schema.ts`
- Validate every JSON file at build time
- Fail the build if content is invalid

### Phase 4: Database migration (future)
- Write a migration script that reads JSON files and inserts into DB
- Switch `registry.ts` / loader from file imports to DB queries
- Minimal code changes elsewhere in the app

---

## 8. Database Schema Mapping

When migrating to a relational database, the JSON maps cleanly to these tables:

### Simple document approach (recommended first DB step)

```sql
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  accent_color TEXT NOT NULL
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT REFERENCES subjects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ib_level TEXT NOT NULL,
  notes JSONB NOT NULL,
  flashcards JSONB NOT NULL,
  questions JSONB NOT NULL
);
```

### Normalized approach (if needed later)

```sql
CREATE TABLE subjects (...);
CREATE TABLE topics (...);
CREATE TABLE concept_notes (...);
CREATE TABLE flashcards (...);
CREATE TABLE questions (...);
CREATE TABLE question_choices (...);
```

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| JSON doesn't support trailing commas or comments | Low | Use editor validation, lint JSON files |
| Runtime type safety lost | Medium | Add Zod validation in loader |
| Next.js static export can't read `src/` at runtime | Medium | Use build-time JSON imports or put data in `public/` |
| Large number of small files | Low | Manageable with good directory structure; tools handle this well |
| KaTeX `$` delimiters in JSON strings | Low | Same escaping rules as TypeScript strings |
| Backslash escaping in LaTeX | Medium | Automated migration script handles escaping consistently |

---

## 10. Recommended Next Step

1. **Approve this architecture** (one JSON file per topic, build-time loading)
2. **Implement a pilot** converting one subject (e.g., `biology.ts`) to JSON
3. **Validate** all existing tests still pass
4. **If pilot succeeds**, convert remaining subjects with subagents in parallel

The pilot will take ~30 minutes and proves the entire migration approach end-to-end before committing to the full refactor.
