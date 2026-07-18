# IBLearn — Agent Guide

## Session Workflow (required)

**At the start of every work session:** read the top 2–3 entries of `PROGRESS.md` to learn what was done recently and what the agreed next steps are. Do not re-run a full project-wide analysis unless the log is stale or contradicts what you see.

**At the end of every work session** (after enhancements, bug fixes, or content additions): prepend one entry to `PROGRESS.md` (newest at top), using this format:

```
## YYYY-MM-DD — <short title>
Git HEAD: `<short-hash>` (branch, tree clean/dirty)
Done: <what changed — files, topic IDs, features; be specific>
Verified: <which checks ran and passed: validate:content, audit:content, npm test, e2e…>
Next: <updated next steps — remove completed items, add new ones discovered>
Notes: <anything a future session must know: blockers, decisions, conventions changed>
```

Rules:
- Keep entries short (under ~15 lines). Facts, not prose.
- Always record verification results honestly — if a check failed or wasn't run, say so.
- Keep the "Next" list current; it is the queue for the next session.
- If you change a workflow, convention, or command, update this `AGENTS.md` too.

## Quality Gates (run before considering work done)

```bash
npm run generate:registry      # after adding/removing topic JSON files
npm run validate:content
npm run validate:illustrations
npm run validate:illustration-layout
npm run audit:content          # fails on any warning
npm test                       # Vitest unit tests
npm run test:e2e               # Playwright (auto-starts dev server)
```

## Conventions

- Content lives in `src/content/data/topics/<subject>/<topic-id>.json` — one file per topic. See `CONTENT_STYLE.md`.
- Illustration rules: `ILLUSTRATION_GUIDELINES.md`. SVGs go in `public/images/<subject>/`.
- `src/content/registry.ts` is generated — never edit by hand; use `npm run generate:registry`.
- New topics follow the 7 notes / 12 flashcards / 15 questions standard.
- Deploy: Vercel, automatic on push to `develop`.
