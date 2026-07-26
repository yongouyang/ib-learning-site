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
- Free-response practice sets live in `src/content/data/papers/<courseId>/<courseId>-set-<n>.json` — original questions only, 20 marks per set, `marks === markscheme.length`. See `CONTENT_STYLE.md` ("Practice papers").
- Course groupings (diagnostics/exams/ladder/papers) come from `src/lib/courses.ts` — add new courses there.
- **External dependencies get a controllable dummy** (user directive): unit tests mock them; e2e/local dev run a dummy implementation with deterministic defaults + per-test response injection. The injection path doubles as production-issue reproduction. See `src/lib/feedback/dummy.ts` (the template) and `docs/ai-feedback.md`.
- Illustration rules: `ILLUSTRATION_GUIDELINES.md`. SVGs go in `public/images/<subject>/`.
- `src/content/registry.ts` is generated — never edit by hand; use `npm run generate:registry` (re-run after adding/removing topic OR paper JSON files).
- New topics follow the 7 notes / 12 flashcards / 15 questions standard; every question (MC and free-response) needs a `difficulty` tag — rubric in `CONTENT_STYLE.md`.
- Topic taxonomy: `stage` (ks3/igcse/dp) + optional `year`/`course`/`level` — see `CONTENT_STYLE.md` ("Stage & course tagging" and ID conventions). `ibLevel` was retired in the Phase 1 migration (2026-07).
- Roadmap: `revised-implementation-plan.md` (phases) and `phase-1-implementation-plan.md`.
- BBC reference pipeline (Phase 1.5): `tools/scripts/scrape-bbc-ks3.mjs` scrapes to `tools/data/`; `tools/scripts/convert-bbc-to-topics.mjs` (map: `tools/scripts/bbc-curation-map.json`) writes reference drafts to `tools/data/_staging/`. BBC text is **reference only** — notes are rewritten in our own voice, flashcards/questions authored, before anything lands in `src/content/data/topics/`. Out-of-scope subjects are archived in `tools/data/_archive/`.
- Deploy: Vercel, automatic on push to `develop`.
