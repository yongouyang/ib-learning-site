# IBLearn

A website for IB (International Baccalaureate) students to learn and practice subjects through study notes, flashcards, and quizzes. Built with Next.js 14 + TypeScript + Tailwind CSS.

**Live URL:** [https://ib-learning-site.vercel.app](https://ib-learning-site.vercel.app)

## Subjects

| Subject | Topics | Levels |
|---------|--------|--------|
| Math | 31 | MYP · DP |
| Biology | 5 | MYP |
| Chemistry | 5 | MYP |
| English | 5 | MYP |
| Physics | 5 | MYP |

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
│   ├── globals.css               # Tailwind imports + utility classes
│   ├── progress/page.tsx         # Progress dashboard
│   └── subjects/[subjectId]/
│       ├── page.tsx              # Subject topics list
│       └── [topicId]/
│           ├── study/page.tsx    # Study notes
│           ├── flashcards/page.tsx # Flashcard deck
│           └── quiz/page.tsx     # Interactive quiz
├── components/
│   └── Nav.tsx                   # Top navigation bar
├── content/                      # Static content (all subjects)
│   ├── types.ts                  # TypeScript interfaces
│   ├── registry.ts               # getSubject / getTopic helpers
│   ├── math.ts                   # 31 topics (7 Y7 + 7 MYP + 5 new MYP + 12 DP)
│   ├── biology.ts                # 5 topics
│   ├── chemistry.ts              # 5 topics
│   ├── english.ts                # 5 topics
│   └── physics.ts                # 5 topics
├── context/
│   └── ProgressContext.tsx       # React context for quiz progress
├── lib/
│   ├── progress-store.ts         # localStorage persistence
│   └── weak-point-analyzer.ts    # Identifies topics needing review
└── hooks/
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
```

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
| `content-registry` | 13 | Subject/topic counts, content integrity (non-empty fields, valid correctIndex), DP validation, unique IDs |
| `progress-store` | 5 | Quiz attempt recording, star ratings, streak tracking, average scores |
| `weak-point-analyzer` | 3 | Weak topic detection, score thresholds, result capping |
| `app.e2e` | 24 | Full quiz flow, home page, subject pages, DP topic rendering, progress page — across iPhone SE, iPad Pro, Desktop Chrome |

## Build & Deploy

```bash
# Production build
npm run build

# Start production server
npm start
```

The project deploys automatically to Vercel on push to `develop`.
