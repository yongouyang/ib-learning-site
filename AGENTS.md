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
npm run test:e2e:static        # static-export build + full suite against out/ (pre-deploy gate)
```

## Conventions

- Content lives in `src/content/data/topics/<subject>/<topic-id>.json` — one file per topic. See `CONTENT_STYLE.md`.
- Free-response practice sets live in `src/content/data/papers/<courseId>/<courseId>-set-<n>.json` — original questions only, 20 marks per set, `marks === markscheme.length`. See `CONTENT_STYLE.md` ("Practice papers").
- Course groupings (diagnostics/exams/ladder/papers) come from `src/lib/courses.ts` — add new courses there.
- **External dependencies get a controllable dummy** (user directive): unit tests mock them; e2e/local dev run a dummy implementation with deterministic defaults + per-test response injection. The injection path doubles as production-issue reproduction. See `src/lib/feedback/dummy.ts` (the template) and `docs/ai-feedback.md`.
- Illustration rules: `ILLUSTRATION_GUIDELINES.md`. SVGs go in `public/images/<subject>/`. Visual review: `npm run render:illustrations` renders every SVG to `illustration-previews/<subject>/*.png` + an `index.html` contact sheet (gitignored; `--subject=<name>` or a single SVG path as arg). Use it for the manual colour/accuracy pass the validators can't do — an agent can sweep the PNGs with image reading.
- `src/content/registry.ts` is generated — never edit by hand; use `npm run generate:registry` (re-run after adding/removing topic OR paper JSON files).
- New topics follow the 7 notes / 12 flashcards / 15 questions standard; every question (MC and free-response) needs a `difficulty` tag — rubric in `CONTENT_STYLE.md`.
- Topic taxonomy: `stage` (ks3/igcse/dp) + optional `year`/`course`/`level`/`strand` (strand = KS3 English only: reading/writing/grammar-vocabulary/spoken-english, grouped on the subject page) — see `CONTENT_STYLE.md` ("Stage & course tagging" and ID conventions). `ibLevel` was retired in the Phase 1 migration (2026-07).
- Roadmap: `revised-implementation-plan.md` (phases) and `phase-1-implementation-plan.md`.
- BBC reference pipeline (Phase 1.5): `tools/scripts/scrape-bbc-ks3.mjs` scrapes to `tools/data/`; `tools/scripts/convert-bbc-to-topics.mjs` (map: `tools/scripts/bbc-curation-map.json`) writes reference drafts to `tools/data/_staging/`. BBC text is **reference only** — notes are rewritten in our own voice, flashcards/questions authored, before anything lands in `src/content/data/topics/`. Out-of-scope subjects are archived in `tools/data/_archive/`.
- Deploy: **live since 2026-08-08** at https://d2c1g77zfmjpm3.cloudfront.net (S3 + CloudFront, no custom domain; corrected 2026-08-06 — there is no Vercel account or Vercel↔GitHub integration). `/api/feedback` is wired to the feedback **Lambda** (Session 3) but runs **unconfigured** (no provider env) — GET `{configured:false}`, POST 501, "Mark with AI" hidden — until the Moonshot key decision. Plan: `aws-deployment-plan.md`.
- CI/CD (Session 4, merged 2026-08): single workflow `.github/workflows/ci.yml` — `build-and-test` (validate/audit/lint/vitest/build) → `e2e` (matrix: iPhone SE / iPad Pro / Desktop Chrome, `fail-fast: false`, per-device report artifacts on failure) → `deploy` (`needs` both, only on push/dispatch to `develop`; gates incl. illustration validators → build:static → build:lambda → terraform apply → s3 sync → invalidation → smoke). e2e IS a deploy gate since the matrix split brought it under ~10 min. Auth via GitHub OIDC → role `arn:aws:iam::305655353474:role/iblearn-github-deploy` (`terraform/modules/ci`; trust scoped to repo `yongouyang/ib-learning-site` @ `develop`, no stored keys). Requires repo **variable** `AWS_DEPLOY_ROLE_ARN` (Settings → Secrets and variables → Actions → Variables) and optional **secret** `FEEDBACK_ENV` (JSON map, e.g. `{"FEEDBACK_PROVIDER":"openai-compatible","FEEDBACK_API_KEY":"sk-..."}` — unset = unconfigured Lambda).
- Security scanning (2026-08, plan `docs/security-scanning-plan.md`, Phase 3 done): Semgrep (SAST, pipx CLI, `p/typescript`+`p/react`+`p/security-audit`+`p/secrets` packs, excludes in `.semgrepignore`) + OSV-Scanner (SCA, official reusable workflow, recursive — covers `package-lock.json` AND `tools/package-lock.json`, ignores in `osv-scanner.toml`, results in Security → Code scanning) run as `ci.yml` jobs — full gates for PRs AND in deploy's `needs`. `.github/workflows/security.yml` is nightly-only (03:17 UTC CVE watch). Local triage: `npm run security` (needs `brew install semgrep osv-scanner`). Remaining 5 ignored CVEs are next@15.5.x nested pins — cleared by the Next.js 16 upgrade (ignoreUntil 2026-10-08).
- Terraform: `terraform/bootstrap` (one-time, LOCAL state by design: state bucket `iblearn-tfstate-305655353474` + lock table `iblearn-tfstate-lock`, ap-east-1), `terraform/envs/prod` (remote state), `terraform/modules/site` (bucket + OAC + CloudFront + URL-rewrite Function + `/api/*` behavior), `terraform/modules/feedback_api` (Lambda + Function URL + IAM + logs), `terraform/modules/ci` (GitHub OIDC provider + deploy role). All local AWS/Terraform commands run with `AWS_PROFILE=ib-learning-site` (IAM admin user, account 305655353474).
- Feedback handler contract lives in `src/lib/feedback/http-handler.ts` — the Next route (dev/e2e) AND `lambda/feedback/index.ts` (prod) both delegate there. Rebuild the Lambda after feedback changes: `npm run build:lambda` (esbuild → `lambda/feedback/dist/`, gitignored) then `terraform -chdir=terraform/envs/prod apply`. Function URL public access needs BOTH `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction`+`InvokedViaFunctionUrl` (2026 AWS change; the second goes through a CLI provisioner because AWS provider 5.x can't express it).
- Manual deploy (until Session 4 CI): `npm run build:static`, then sync with cache splits — `aws s3 sync out/ s3://iblearn-site-305655353474 --delete --exclude "_next/static/*" --exclude "sw.js" --exclude "manifest.webmanifest" --cache-control "public,max-age=300"`; `aws s3 sync out/_next/static s3://iblearn-site-305655353474/_next/static --delete --cache-control "public,max-age=31536000,immutable"`; `aws s3 cp out/sw.js …/sw.js --cache-control "no-cache"` (+ same for `manifest.webmanifest`); then `aws cloudfront create-invalidation --distribution-id E1BMVEW6YOKNUY --paths "/*"`.
- Static export (AWS pre-deploy): `npm run build:static` sets `BUILD_EXPORT=1` (`output: 'export'` in `next.config.mjs`; URLs stay extensionless — `page.html` files, mapped by a CloudFront Function in Session 2) and stashes `src/app/api/` aside for the build (export rejects the non-static route handler; it stays the dev/e2e path). `npm run test:e2e:static` runs the full suite + PWA spec against `out/` served by `scripts/serve-static.ts`, which mimics the CloudFront topology: static files like the S3 origin, `/api/feedback` delegated to the real route handler like the `/api/*` Lambda behavior.
- PWA (Phase 7): service worker is hand-rolled in `public/sw.js` (no workbox/serwist) — bump `CACHE_VERSION` only when the caching *strategy* changes, never per deploy. SW registration and the update toast are prod-gated (`NODE_ENV === 'production'`; unit tests use `vi.stubEnv`). SW e2e lives in `tests/e2e/pwa.spec.ts` and only runs under the prod-build pattern: `npm run build && E2E_PROD=1 npx playwright test tests/e2e/pwa.spec.ts --project='Desktop Chrome'`. Regenerate icons with `node scripts/generate-icons.mjs` after changing `public/icons/icon.svg`.
