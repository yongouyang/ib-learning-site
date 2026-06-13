# IBLearn

A website for IB (International Baccalaureate) students to learn and practice subjects through study notes, flashcards, and quizzes. Built with Next.js 14 + TypeScript + Tailwind CSS.

**Live URL:** [https://ib-learning-site.vercel.app](https://ib-learning-site.vercel.app)

## Subjects

| Subject | Topics | Levels |
|---------|--------|--------|
| Math | 45 | MYP · DP |
| Biology | 11 | MYP |
| Chemistry | 10 | MYP |
| English | 10 | MYP |
| Physics | 10 | MYP |

### Math DP Topics

Sequences & Series · Exponents & Logarithms · Binomial Theorem · Functions · Quadratic Functions & Equations · Exponential & Logarithmic Functions · Trigonometry · Vectors · Differentiation · Integration · Probability Distributions · Kinematics

### Study Tools

Each topic provides three modes:
1. **Study notes** — concept explanations with headings and body text
2. **Flashcards** — term/definition cards with worked examples
3. **Quiz** — multiple-choice questions with scoring, explanations, and star ratings

Progress is tracked locally via `localStorage` and displayed on the Progress page with day streaks and weak-point analysis.

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page with subject grid
│   ├── layout.tsx                # Root layout with Nav
│   ├── globals.css               # Tailwind imports + dark-mode support
│   ├── progress/page.tsx         # Progress dashboard
│   └── subjects/[subjectId]/
│       ├── page.tsx              # Subject topics list
│       └── [topicId]/
│           ├── study/page.tsx    # Study notes
│           ├── flashcards/page.tsx # Flashcard deck
│           └── quiz/page.tsx     # Interactive quiz
├── components/
│   ├── Nav.tsx                   # Bottom navigation bar (mobile)
│   ├── QuizGame.tsx              # Shared quiz component
│   ├── StudyNoteBody.tsx         # Renders study note body text + KaTeX
│   └── MathExpression.tsx        # KaTeX math renderer
├── content/                      # Static content (all subjects)
│   ├── types.ts                  # TypeScript interfaces
│   ├── schema.ts                 # Zod validators for content
│   ├── registry.ts               # getSubject / getTopic helpers
│   └── data/
│       ├── subjects.json         # Subject metadata
│       └── topics/               # One JSON file per topic
│           ├── math/
│           ├── biology/
│           ├── chemistry/
│           ├── english/
│           └── physics/
├── context/
│   └── ProgressContext.tsx       # React context for quiz progress
├── lib/
│   ├── mixed-review.ts           # Build mixed-review question sets
│   ├── progress-store.ts         # localStorage persistence
│   └── weak-point-analyzer.ts    # Identifies topics needing review
└── hooks/

scripts/
├── validate-content.ts           # Validate subjects.json and all topic JSON files
└── audit-content.ts              # Audit content quality (question counts, IDs, LaTeX)
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Deployment:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3000

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Validate all content JSON files
npm run validate:content

# Audit content quality (question counts, IDs, LaTeX issues)
# This now exits with an error if any warnings are found.
npm run audit:content
```

Content conventions are documented in [`CONTENT_STYLE.md`](./CONTENT_STYLE.md).

The app also respects the user's system dark-mode preference (`prefers-color-scheme`).

## Testing

```bash
# Unit tests (Vitest)
npm test
npm run test:watch     # watch mode

# E2E tests (Playwright — requires dev server running)
npm run test:e2e

# Or run E2E against a specific device
npx playwright test --project="Desktop Chrome"
```

### Test coverage

| Suite | Tests | Scope |
|-------|-------|-------|
| `content-registry` | 18 | Subject/topic counts, content integrity (non-empty fields, valid correctIndex), DP validation, unique IDs |
| `progress-store` | 5 | Quiz attempt recording, star ratings, streak tracking, average scores |
| `mixed-review` | 3 | Building random/weak-area mixed review question sets |
| `weak-point-analyzer` | 3 | Weak topic detection, score thresholds, result capping |
| `content-schema` | 20 | Zod schema validation for topics and subjects |
| `app.e2e` | 39 | Full quiz flow, flashcards, home page, subject pages, mixed review, DP topic rendering, progress page — across iPhone SE, iPad Pro, Desktop Chrome |

## Build & Deploy

```bash
# Production build
npm run build

# Start production server
npm start
```

The project deploys automatically to Vercel on push to `develop`.
