# AWS Deployment Plan

> Written 2026-08-06. Supersedes all earlier "Vercel auto-deploy" notes — there is no Vercel account or Vercel↔GitHub integration; the site has never been deployed.
>
> **Decisions (user, 2026-08-06):**
> 1. **Topology: S3 + CloudFront + Lambda** (static export + serverless feedback endpoint).
> 2. **IaC: Terraform.**
> 3. **No custom domain yet** — deploy to the CloudFront default domain (`*.cloudfront.net`); custom domain is a later add-on (§7).

---

## 1. Current state (verified at planning time)

- Next.js 15 App Router. **Effectively static**: all pages render from bundled content JSON (`generateStaticParams`); `useSearchParams` appears only in client components; no `headers()`/`cookies()`/ISR. No `next/image` anywhere (plain `<img>` in `StudyNoteIllustration.tsx`).
- **One server-side piece**: `src/app/api/feedback/route.ts` — `GET` (configured check) + `POST` (AI marking). Stateless except an in-memory per-IP rate limit (already documented as per-instance on serverless; phase-5 §3.5). All provider logic lives in `src/lib/feedback/` and is reusable outside Next.
- Frontend calls the **relative path** `/api/feedback` (`PaperRunnerClient.tsx`) — works unchanged behind a CloudFront `/api/*` behavior.
- PWA: hand-rolled `public/sw.js` + manifest; SW registration prod-gated. Post-deploy checks exist (phase-7 §6) but were written for Vercel — adapted in §8.
- E2E runs against the dev server, which keeps the Next API route (dummy provider + injection) — local dev and e2e are unaffected by the export build.
- No hosting of any kind today; nothing to migrate.

## 2. Target architecture

```
GitHub push to develop
  └─ GitHub Actions (OIDC → AWS role, no stored keys)
       ├─ quality gates (validate/audit/vitest)
       ├─ next build (static export) ──► S3 bucket (private, OAC-only)
       │                                   ▲
       │                              CloudFront distribution
       │                              ├─ /*          → S3 origin
       │                              └─ /api/*      → Lambda Function URL origin
       └─ terraform apply ──► Lambda (feedback) + Function URL
                                  └─ env: FEEDBACK_* (Moonshot key etc.)
```

- **S3**: private bucket, CloudFront Origin Access Control; no public bucket policy.
- **CloudFront**: two origins. Behaviors: `sw.js` and `manifest.webmanifest` → `Cache-Control: no-cache` (via response-headers policy or S3 metadata); `/_next/static/*` → long immutable cache (content-hashed); everything else → short default. Price class 100 (US/EU edge only) is enough at our scale.
- **Lambda**: Node 22, arm64, 256 MB, Function URL (no API Gateway — one endpoint, no need). Reuses `src/lib/feedback` verbatim; the Next route handler stays for dev/e2e only.
- **Cost estimate** at family-use scale: **~$1–3/month** (CloudFront requests + S3 storage + Lambda free tier). Domain adds ~$0.50/mo (Route 53 zone) later.

## 3. App changes (static-export readiness)

1. `next.config.mjs`: `output: 'export'` gated on an env flag (`BUILD_EXPORT=1`) so dev/e2e builds are unchanged.
2. `output: 'export'` rejects non-static route handlers → **build script moves `src/app/api/` aside for the export build and restores it after** (`scripts/build-static.sh` + `npm run build:static`). The Next route handler remains the dev/e2e path; production feedback goes to the Lambda (same relative URL via the CloudFront behavior).
3. Verify the export build passes (Suspense boundaries around `useSearchParams` clients — build will tell) and run the full e2e suite **plus** the prod PWA spec against the static output served locally.
4. **URL convention (decided 2026-08-07)**: extensionless URLs, Next default (`page.html` files) — NOT `trailingSlash: true` (that changed every app URL and broke 28 e2e `waitForURL`/glob assertions). CloudFront maps `/foo` → `/foo.html` via a Function (Session 2); `scripts/serve-static.ts` mirrors this locally. 404-test deep links.

## 4. Terraform layout

```
terraform/
  bootstrap/            # one-time, local state: state bucket + lock table + GitHub OIDC provider/role
  envs/prod/            # remote state in the bootstrap bucket
  modules/
    site/               # S3 bucket, OAC, CloudFront distribution + behaviors, response-headers policy
    feedback_api/       # Lambda (zip from CI build), Function URL, IAM, log group
    ci/                 # GitHub Actions deploy role (OIDC trust: repo yongouyang/ib-learning-site, branch develop)
```

- State: S3 backend + DynamoDB locking (created by `bootstrap/`).
- Secrets: `FEEDBACK_API_KEY` etc. as Terraform **variables marked sensitive** → Lambda env (never committed; `terraform.tfvars` gitignored or passed via CI secrets). Moonshot key decision still open — the Lambda deploys fine unconfigured (returns 501, button hides, same as today).
- CloudFront invalidation is done by the deploy workflow (`aws cloudfront create-invalidation --paths "/*"`), not Terraform.

## 5. Feedback Lambda

- Thin handler wrapper around `getFeedbackProvider()` / `markRequestSchema` / `markResultSchema` from `src/lib/feedback` — same validation and contract as the Next route (one entry per markscheme point, marks recomputed). Port `route.ts` logic 1:1, minus Next imports.
- Bundled with esbuild in CI (`lambda/feedback/index.ts` → single zip).
- Function URL with `NONE` auth (public endpoint, same exposure as the Next route today) + CORS restricted to the CloudFront origin. Rate limit stays in-memory per-instance — acceptable per phase-5 §3.5; Upstash/ElastiCache remains the follow-up if abuse appears. **Implementation note (2026-08-08):** public Function URLs now require TWO resource-policy statements — `lambda:InvokeFunctionUrl` (auth type NONE) AND `lambda:InvokeFunction` with `InvokedViaFunctionUrl=true`; the second is applied via a CLI provisioner because AWS provider 5.x can't express it.
- Keep `GET /api/feedback` → `{ configured }` behavior identical so the UI's button-gating works unchanged.

## 6. CI/CD (GitHub Actions)

Single workflow `.github/workflows/deploy.yml`, on push to `develop`:

1. Quality gates: `validate:content`, `validate:illustrations`, `validate:illustration-layout`, `audit:content`, `npm test` (e2e stays local/pre-push — too slow/flaky for every deploy; revisit).
2. `npm run build:static` → `out/`.
3. Build feedback Lambda zip (esbuild).
4. `terraform -chdir=terraform/envs/prod apply -auto-approve` (OIDC role).
5. `aws s3 sync out/ s3://<bucket> --delete` with cache-header splits (`sw.js`/manifest `no-cache`, `/_next/static` immutable).
6. CloudFront invalidation; smoke check: `curl -fsS https://<dist>.cloudfront.net/` + `/api/feedback` GET.

## 7. Custom domain — octavlearning.com (**DONE 2026-08-11**)

Implemented per `docs/custom-domain-cutover-plan.md` (two-distribution DEV/PROD split — this §7's original single-distribution alias approach was superseded). PROD = new bucket `iblearn-prod-site-305655353474` + distribution `EYC8IOH4L9SXT` (`d1s55irh5569t1.cloudfront.net`) with ACM cert (us-east-1, apex+www, DNS-validated via two permanent gray-cloud CNAMEs in CloudFlare) and www→apex 301 in the PROD URL-rewrite Function; DEV = the original bucket/distribution, unchanged. CI split: `deploy-dev` on develop, `deploy-prod` on main. Verified per the cutover plan §7 (apex 200, www 301 with query preserved, `/api/feedback` configured on both origins, deep links, sw.js no-cache).

## 8. Verification & launch checks (adapts phase-7 §6 from Vercel → CloudFront)

- Standard gates per AGENTS.md (in CI, §6).
- After deploy: `curl -I https://<dist>.cloudfront.net/sw.js` shows **no long max-age**; `manifest.webmanifest` 200s; deep link (e.g. a topic page) 200s; `/api/feedback` GET returns `{ "configured": false }` (until Moonshot key set).
- One manual install on iOS Safari + one on Chromium desktop; offline reload works; "Mark with AI" hidden offline and when unconfigured.
- Lighthouse PWA category ≥ 90 (acceptable misses: push/background sync — deliberate non-goals).
- CloudFront error pages: 404 → app 404 (custom error response → `/404.html`, 404 status preserved).

## 9. Session breakdown

> Status 2026-08-11: **Sessions 1–4 done; custom domain DONE** — PROD live at **octavlearning.com** (bucket `iblearn-prod-site-*`, distribution `EYC8IOH4L9SXT`, deploys from `main`), DEV at `d2c1g77zfmjpm3.cloudfront.net` (deploys from `develop`); `/api/feedback` live with DeepSeek on both origins; CI/CD split `deploy-dev`/`deploy-prod` + OIDC role. **Rebrand to "Octav Learning" done**. Remaining: §8 launch checks on the real domain (iOS install, Lighthouse), branch protection on `main`.

- **Session 1 — static-export readiness**: §3 changes, `build:static` script, gates + full e2e + prod PWA spec against local static serve. No AWS yet.
- **Session 2 — Terraform bootstrap + site**: AWS account/prereqs (§10), bootstrap state, `site` module, manual first sync + smoke checks.
- **Session 3 — feedback Lambda**: `lambda/feedback` port, `feedback_api` module, CloudFront `/api/*` behavior, dummy-provider integration test against the deployed URL.
- **Session 4 — CI/CD**: OIDC role (`ci` module), deploy workflow, branch protection on `develop`, full launch checks (§8).
- **Later (not scheduled)**: accounts/subscriptions phase (Cognito + DynamoDB) bolts onto this base — see `revised-implementation-plan.md` §"deferred".

## 10. Prerequisites & open questions

- **AWS account**: assumed to exist (user: "no domain yet" — domain, not account). If not, step 0: create account, enable MFA on root, create an admin IAM user/Identity Center user for running Terraform locally. Region: default `ap-east-1` (Hong Kong, near GSIS users) — CloudFront is global anyway; confirm before bootstrap since state bucket region is sticky.
- **Moonshot API key**: still open (unchanged). Lambda deploys and behaves correctly without it (501 → button hidden).
- **GitHub**: repo is `yongouyang/ib-learning-site`, default working branch `develop` — the OIDC trust is scoped to exactly that.
