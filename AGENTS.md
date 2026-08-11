# Octav Learning — Agent Guide

## Session Workflow (required)

**At the start of every work session:** read the top 2–3 entries of `docs/PROGRESS.md` to learn what was done recently and what the agreed next steps are. Do not re-run a full project-wide analysis unless the log is stale or contradicts what you see.

**At the end of every work session** (after enhancements, bug fixes, or content additions): prepend one entry to `docs/PROGRESS.md` (newest at top), using this format:

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
npm run test:e2e:static        # static-export build + full suite against out/ (pre-deploy gate)
```

## Conventions

- Product name is **"Octav Learning"** (formerly IBLearn); the `iblearn_progress` localStorage key and `iblearn-*` AWS resource names are intentionally unchanged. PWA icon source is `public/icons/icon.svg` (full-bleed variant of the Octav mark), regenerated with `node scripts/generate-icons.mjs`.
- Content lives in `src/content/data/topics/<subject>/<topic-id>.json` — one file per topic. See `docs/CONTENT_STYLE.md`.
- Free-response practice sets live in `src/content/data/papers/<courseId>/<courseId>-set-<n>.json` — original questions only, 20 marks per set, `marks === markscheme.length`. See `docs/CONTENT_STYLE.md` ("Practice papers").
- Course groupings (diagnostics/exams/ladder/papers) come from `src/lib/courses.ts` — add new courses there.
- **External dependencies get a controllable dummy** (user directive): unit tests mock them; e2e/local dev run a dummy implementation with deterministic defaults + per-test response injection. The injection path doubles as production-issue reproduction. See `src/lib/feedback/dummy.ts` (the template) and `docs/ai-feedback.md`.
- Illustration rules: `docs/ILLUSTRATION_GUIDELINES.md`. SVGs go in `public/images/<subject>/`. Visual review: `npm run render:illustrations` renders every SVG to `illustration-previews/<subject>/*.png` + an `index.html` contact sheet (gitignored; `--subject=<name>` or a single SVG path as arg). Use it for the manual colour/accuracy pass the validators can't do — an agent can sweep the PNGs with image reading.
- `src/content/registry.ts` is generated — never edit by hand; use `npm run generate:registry` (re-run after adding/removing topic OR paper JSON files).
- New topics follow the 7 notes / 12 flashcards / 15 questions standard; every question (MC and free-response) needs a `difficulty` tag — rubric in `docs/CONTENT_STYLE.md`.
- Topic taxonomy: `stage` (ks3/igcse/dp) + optional `year`/`course`/`level`/`strand` (strand = KS3 English only: reading/writing/grammar-vocabulary/spoken-english, grouped on the subject page) — see `docs/CONTENT_STYLE.md` ("Stage & course tagging" and ID conventions). `ibLevel` was retired in the Phase 1 migration (2026-07).
- Roadmap: `docs/revised-implementation-plan.md` (phases) and `docs/phase-1-implementation-plan.md`.
- BBC reference pipeline (Phase 1.5): `tools/scripts/scrape-bbc-ks3.mjs` scrapes to `tools/data/`; `tools/scripts/convert-bbc-to-topics.mjs` (map: `tools/scripts/bbc-curation-map.json`) writes reference drafts to `tools/data/_staging/`. BBC text is **reference only** — notes are rewritten in our own voice, flashcards/questions authored, before anything lands in `src/content/data/topics/`. Out-of-scope subjects are archived in `tools/data/_archive/`.
- Deploy: **live since 2026-08-08** at https://d2c1g77zfmjpm3.cloudfront.net (S3 + CloudFront, no custom domain; corrected 2026-08-06 — there is no Vercel account or Vercel↔GitHub integration). `/api/feedback` is wired to the feedback **Lambda** (Session 3) and **live since 2026-08-09 with DeepSeek** (`deepseek-v4-flash`; Moonshot abandoned — `api.moonshot.cn` gets blackholed from AWS ap-east-1). Unset `FEEDBACK_ENV` = unconfigured mode: GET `{configured:false}`, POST 501, "Mark with AI" hidden. Plan: `docs/aws-deployment-plan.md`; provider notes: `docs/ai-feedback.md`.
- CI/CD (Session 4, merged 2026-08): single workflow `.github/workflows/ci.yml` — `build-and-test` (validate/audit/lint/vitest/build) → `e2e` (matrix: iPhone SE / iPad Pro / Desktop Chrome, `fail-fast: false`, per-device report artifacts on failure) → `deploy` (only on push/dispatch to `develop`; build:static → build:lambda → terraform apply → s3 sync → invalidation → smoke). `illustrations` (validate:illustrations + validate:illustration-layout, needs Playwright Chromium) and the security scans run as separate jobs in parallel with `e2e` — all four are in deploy's `needs`, keeping gates green-only without duplicating work in the deploy job. e2e IS a deploy gate since the matrix split brought it under ~10 min. Auth via GitHub OIDC → role `arn:aws:iam::305655353474:role/iblearn-github-deploy` (`terraform/modules/ci`; trust scoped to repo `yongouyang/ib-learning-site` @ `develop`, no stored keys). Requires repo **variable** `AWS_DEPLOY_ROLE_ARN` (Settings → Secrets and variables → Actions → Variables) and optional **secret** `FEEDBACK_ENV` (JSON map, e.g. `{"FEEDBACK_PROVIDER":"openai-compatible","FEEDBACK_API_KEY":"sk-..."}` — unset = unconfigured Lambda). Manual dispatch has a `deploy_only` input (escape hatch: skips all gate jobs, deploys develop HEAD as-is — for deploy-stage fixes without a full-pipeline wait; `deploy` uses `always() && !failure()` so skipped gates don't block it but real failures do). The `FEEDBACK_ENV` JSON MUST be single-line with straight quotes — terraform parses it as HCL and rejects multi-line values / curly quotes.
- Security scanning (2026-08, plan `docs/security-scanning-plan.md`, Phase 3 done): Semgrep (SAST, pipx CLI, `p/typescript`+`p/react`+`p/security-audit`+`p/secrets` packs, excludes in `.semgrepignore`) + OSV-Scanner (SCA, official reusable workflow, recursive — covers `package-lock.json` AND `tools/package-lock.json`, ignores in `osv-scanner.toml`, results in Security → Code scanning) run as `ci.yml` jobs — full gates for PRs AND in deploy's `needs`. `.github/workflows/security.yml` is nightly-only (03:17 UTC CVE watch). Local triage: `npm run security` (needs `brew install semgrep osv-scanner`). Remaining 5 ignored CVEs are next@15.5.x nested pins — cleared by the Next.js 16 upgrade (ignoreUntil 2026-10-08).
- Terraform: `terraform/bootstrap` (one-time, LOCAL state by design: state bucket `iblearn-tfstate-305655353474` + lock table `iblearn-tfstate-lock`, ap-east-1), `terraform/envs/prod` (remote state), `terraform/modules/site` (bucket + OAC + CloudFront + URL-rewrite Function + `/api/*` behavior), `terraform/modules/feedback_api` (Lambda + Function URL + IAM + logs), `terraform/modules/ci` (GitHub OIDC provider + deploy role). AWS provider pinned `~> 6.0` (needed for the Lambda's `nodejs24.x` runtime — 5.x's enum ended at nodejs22.x). All local AWS/Terraform commands run with `AWS_PROFILE=ib-learning-site` (IAM admin user, account 305655353474). **No local `terraform apply` (user directive, 2026-08-11 incident): applies are CI-only** — local runs lack `FEEDBACK_ENV` (it lives only in the GitHub secret) and a local apply silently resets the Lambda to unconfigured mode, breaking "Mark with AI" in prod. Even a `-target` apply is unsafe: targeted resources' *dependencies* get applied too, which is how the Lambda got wiped. Exception: once the DeepSeek key moves to SSM Parameter Store (standing backlog item), local applies with the key sourced from SSM are fine again. Local `plan`/`validate`/`fmt` remain OK.
- Feedback handler contract lives in `src/lib/feedback/http-handler.ts` — the Next route (dev/e2e) AND `lambda/feedback/index.ts` (prod) both delegate there. Rebuild the Lambda after feedback changes: `npm run build:lambda` (esbuild → `lambda/feedback/dist/`, gitignored), then let the CI deploy apply it (no local applies — see Terraform bullet). Function URL public access needs BOTH `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction`+`InvokedViaFunctionUrl` (2026 AWS change; the second goes through a CLI provisioner because AWS provider 5.x can't express it).
- Manual deploy (superseded by CI — kept as reference for the cache-split commands): `npm run build:static`, then sync with cache splits — `aws s3 sync out/ s3://iblearn-site-305655353474 --delete --exclude "_next/static/*" --exclude "sw.js" --exclude "manifest.webmanifest" --cache-control "public,max-age=300"`; `aws s3 sync out/_next/static s3://iblearn-site-305655353474/_next/static --delete --cache-control "public,max-age=31536000,immutable"`; `aws s3 cp out/sw.js …/sw.js --cache-control "no-cache"` (+ same for `manifest.webmanifest`); then `aws cloudfront create-invalidation --distribution-id E1BMVEW6YOKNUY --paths "/*"`.
- Static export (AWS pre-deploy): `npm run build:static` sets `BUILD_EXPORT=1` (`output: 'export'` in `next.config.mjs`; URLs stay extensionless — `page.html` files, mapped by a CloudFront Function in Session 2) and stashes `src/app/api/` aside for the build (export rejects the non-static route handler; it stays the dev/e2e path). `npm run test:e2e:static` runs the full suite + PWA spec against `out/` served by `scripts/serve-static.ts`, which mimics the CloudFront topology: static files like the S3 origin, `/api/feedback` delegated to the real route handler like the `/api/*` Lambda behavior.
- PWA (Phase 7): service worker is hand-rolled in `public/sw.js` (no workbox/serwist) — bump `CACHE_VERSION` only when the caching *strategy* changes, never per deploy. SW registration and the update toast are prod-gated (`NODE_ENV === 'production'`; unit tests use `vi.stubEnv`). SW e2e lives in `tests/e2e/pwa.spec.ts` and only runs under the prod-build pattern: `npm run build && E2E_PROD=1 npx playwright test tests/e2e/pwa.spec.ts --project='Desktop Chrome'`. Regenerate icons with `node scripts/generate-icons.mjs` after changing `public/icons/icon.svg`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
