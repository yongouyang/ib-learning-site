# Future Tech Stack Evolution

> Analysis of how the current stack evolves to support accounts, subscriptions, AI generation, and a UI/server split.
> Written 2026-08-08; **updated 2026-08-14** (rebrand to Octav Learning, octavlearning.com cutover, DeepSeek live, variations engine, CI maturity) **and 2026-08-16** (accounts + progress sync shipped to `develop` — §1 snapshot, §2.1a, §4 Steps 0–2). Companion to `revised-implementation-plan.md` and `aws-deployment-plan.md`.

---

## 1. Current Tech Stack (Snapshot, 2026-08-16)

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | **Static export** to S3 + CloudFront; `BUILD_EXPORT=1` gate |
| **UI** | React 19, Tailwind CSS 3, Framer Motion, KaTeX, Lucide React | Dark mode, responsive (iPhone SE → desktop) |
| **State** | `localStorage` (versioned) primary + **server sync when logged in** (offline-first: local write → sync queue → background flush) | Anonymous: `iblearn_progress` unchanged; logged-in: per-profile `octav_progress:<userId>:<profileId>` |
| **Data** | Static JSON files (137 topics), Zod schema, generated registry; **DynamoDB** (`octav-users/sessions/otp-codes/progress/rate-limits`, on-demand) | **Variant groups + parameterized template engine live** (variations Phases 0–4): grouped pools 15→27–29 q/topic, TS generators (`src/content/generators/`) with seeded materialization |
| **Backend** | **3 Lambdas** (`/api/feedback`, `/api/auth/*`, `/api/progress/*`) via CloudFront Function URL origins | nodejs24.x, arm64; dev/e2e use Next route handlers instead. **Auth + progress sync merged to `develop` 2026-08-16 — live on DEV, not yet on PROD (`main`)** |
| **AI** | Provider abstraction (`openai-compatible` + `dummy`), per-IP rate limiter | **DeepSeek live since 2026-08-09** (`deepseek-v4-flash`); Moonshot abandoned (blackholed from ap-east-1) |
| **Infra** | AWS S3 + CloudFront + Lambda + DynamoDB + SES (ap-southeast-1), Terraform IaC, GitHub Actions CI/CD (OIDC) | **PROD = octavlearning.com** (www→apex 301), **DEV = dev.octavlearning.com**; two-tier deploy from main/develop. SES domain verified; **production access denied — re-apply is the pre-launch blocker** |
| **Testing** | Vitest (unit, 634 tests), Playwright (e2e, 3-device matrix) | e2e + Semgrep/OSV security scans are **deploy gates** in CI |
| **PWA** | Hand-rolled SW, offline page, install prompt (iOS manual) | Prod-gated registration |

---

## 2. Feature-by-Feature Impact Analysis

### 2.1 Account Registration & Authentication

**Current gap:** Completely missing. The site is fully anonymous — no session, no cookies, no `headers()`/`cookies()` usage.

**What needs to change:**

- **Auth provider:** Clerk (quickest, managed, React-native support), Auth0/NextAuth (more control), or **custom username + email-OTP** (see §2.1a). Clerk is the best fit if you want managed user UI/social login/passkeys out of the box; custom OTP is the best fit for this project's "controllable dummy for every external dependency" testing directive and near-zero cost.
- **Session management:** The current `localStorage` progress must be associated with a user ID. On first login, merge/carry-over anonymous progress.
- **Architecture shift:** Auth requires **server-side session verification** for gated behavior. Current static export can't do this at the page level — but it doesn't need to: all dynamic behavior is client-side fetches to an API layer after hydration. Options:
  - **(A) Stay static S3 + CloudFront, add Lambda Function URLs for the API layer** — the feedback-Lambda pattern extended (`/api/auth/*`, `/api/progress/*`, … behind CloudFront behaviors). No page-level gating; APIs enforce auth server-side. (An earlier framing of (A) used Lambda@Edge viewer-request checks for gated pages — rejected as hacky and unnecessary.)
  - **(B) Move to serverful Next.js on AWS** (ECS Fargate / Amplify / Lambda + SSR) — gives full `proxy.ts` (Next 16's renamed middleware) auth gating, API routes, SSR. Loses the simplicity of static hosting.
  - **(C) Hybrid: static marketing pages on S3, app behind auth on a server** — cleanest for a gated product, but splits the codebase.

**Recommendation (decided 2026-08-14): (A) — stay static export + Lambda Function URLs**, per `architecture-evolution-plan.md` Constraint 1. Accounts, progress sync, entitlements, and analytics are all API concerns, not page-rendering concerns; the PWA/offline-first UX stays untouched. (B) remains a documented later migration, triggered only by server-gated premium *content* (question JSON currently ships in the static bundle — §2.9) or SSR personalization needs; neither is in scope for accounts.

---

### 2.1a Custom Auth Option (username + email OTP)

Discussed 2026-08-14 as a serious alternative to Clerk. Passwordless OTP sidesteps the worst of rolling your own auth (no password hashing, no credential-stuffing surface).

**Shape:** `POST /api/auth/request-code` (email → 6-digit code, hashed + 10-min TTL in DynamoDB, sent via SES, rate-limited per IP and per email) → `POST /api/auth/verify` (code → signed session token, httpOnly cookie or Bearer JWT) → `GET /api/me` (session + entitlements). Username is a profile field set post-verify, not a credential.

**What you own that Clerk gives you free:** token signing/rotation, session revocation, email deliverability (SES sandbox exit + bounce handling), brute-force throttling on the verify endpoint, and the account-recovery flow (which for OTP *is* just email access — a real simplification). All are well-understood and small, but they must be written and tested deliberately.

**Why it fits this project:** zero per-MAU cost, runs entirely in the existing Lambda/DynamoDB target architecture, and the email sender gets a controllable dummy in dev/e2e exactly like the feedback provider (`src/lib/feedback/dummy.ts` pattern) — deterministic codes in tests.

**Verdict (decided 2026-08-14): custom email-OTP is the auth mechanism.** Clerk stays the fallback if social login/passkeys ever become requirements. **Implemented 2026-08-15 (Phase B): `src/lib/auth/*` + `lambda/auth` + `/login` + `/account`, merged to `develop` 2026-08-16.**

---

### 2.2 Analytics Tracking

**Current gap:** No analytics at all. No cookies, no tracking scripts.

**What needs to change:**

- **Client-side:** Plausible (privacy-first, lightweight, no cookie banner needed) or PostHog (product analytics, feature flags, session replays — powerful for understanding student behavior on quiz/diagnostic flows). Plausible is enough for marketing; PostHog wins for product analytics.
- **Server-side events:** Key actions (quiz completion, exam results, AI feedback usage) should emit server-side events for reliability. This requires an API endpoint → another Lambda or the same server hosting accounts.
- **Architecture impact:** Small. A `<Script>` tag in `layout.tsx` for Plausible, or a PostHog provider. No server change needed for basic analytics; advanced (server-side events) needs an API.

**Recommendation:** Start with Plausible (simple, cheap, no GDPR headache). Add server-side event logging when the API layer exists.

---

### 2.3 Subscription & Payment

**Current gap:** Nothing. No concept of paid features; everything is free.

**What needs to change:**

- **Payment processor:** Stripe (Checkout + Customer Portal for self-service). Requires server-side endpoints for Checkout Session creation and webhook handling.
- **Entitlement model:** Must define what's free vs. premium. Likely pattern: free = study notes + flashcards + limited quizzes; premium = full question bank, exams, AI feedback, diagnostics, ladder.
- **Subscription state:** Per-user record in a database (DynamoDB or RDS/Postgres). Updated by Stripe webhooks.
- **Content gating:** Client-side checks (hide locked features) + **server-side enforcement** (API refuses to serve premium question sets without active subscription).
- **Architecture impact:** **Major.** Requires:
  - A database for user + subscription state
  - Stripe webhook endpoint (Lambda or API route)
  - Checkout session creation endpoint
  - Content gating logic (middleware or API-level)
  - Billing portal integration

**Recommendation:** Build on top of the accounts layer. Stripe + DynamoDB for subscription records. This is the strongest driver for moving to a serverful architecture.

---

### 2.4 Account-Specific History & Records

**Current gap:** `localStorage` only — per-device, no sync. Progress is lost on device switch or clearing browser data.

**What needs to change:**

- **Database:** User-scoped records for quiz attempts, exam results, ladder progress, flashcard mastery, weak areas. Current shape (in `progress-store.ts`):
  ```ts
  { userProgress, topicProgress, examResults, ladderProgress, flashcardProgress }
  ```
  This is already well-structured for server sync. The `STORAGE_VERSION` field was added with future migration in mind.
- **Sync strategy:**
  - **Optimistic local-first:** Keep localStorage as cache, sync to server on write, pull on login/new device. This preserves offline capability (PWA) and feels fast.
  - **Server-as-truth:** Every action is a server API call; localStorage is read-only cache. Simpler but loses offline.
- **API endpoints needed:** `GET/PUT /api/progress`, `GET/POST /api/quiz-attempts`, `GET/POST /api/exam-results`, `GET/PUT /api/ladder-progress`, etc.
- **Architecture impact:** Requires the database + API layer from accounts/subscriptions. Adds ~5–8 API endpoints.

**Recommendation:** Optimistic local-first with conflict resolution (last-write-wins per topic/attempt, simple CRDT-like merge). Already versioned — good foundation.

---

### 2.5 AI Feedback (Refinement)

**Current status:** **Live in prod since 2026-08-09** with DeepSeek (`deepseek-v4-flash`) via the `openai-compatible` provider. Moonshot was abandoned — `api.moonshot.cn` gets blackholed from AWS ap-east-1. The key lives only in the `FEEDBACK_ENV` GitHub secret (SSM Parameter Store move is a standing backlog item — it unblocks local terraform applies again).

**What's still needed:**

- **Cost management:** AI marking is token-expensive. Needs:
  - **Response caching** — same question + similar answer → reuse previous feedback
  - **Usage quotas per user** (free tier: N marks/month; premium: unlimited) — ties into the entitlement model (§2.9)
  - **Prompt optimization** to reduce token count
- **Quality:** The dummy/injection system is already built for production-issue reproduction. Good.
- **Architecture impact:** Minimal — the Lambda is already the right shape. May want to add a queue (SQS) for async processing if latency is high, or keep it synchronous with streaming.

**Recommendation:** ~~Configure the key~~ Done. Next: caching + per-user quotas once accounts exist.

---

### 2.6 AI Practice Generation

**Current status (2026-08-14):** Topics are still human-authored/reviewed, but the **variations engine is live** (Phases 0–4): variant groups expand every chem topic's pool to 27–29 questions, and 18 TS generators (12 math/physics + 6 chemistry) produce unlimited fresh parameterized instances with error-rule distractors, fully unit-tested. This covers a large share of the "fresh practice" need **without any LLM** — deterministic, free, and already inside the validator. LLM generation remains the tool for *new topics/notes/flashcards* and for subjects where generators don't fit (biology, English).

**What needs to change:**

- **LLM integration:** Prompt engineering to generate notes, flashcards, and questions from syllabus specs and reference material. This is **not** the same as the feedback Lambda — it's a different workflow (batch, not real-time).
- **Quality gate:** Generated content must pass the same `validate:content` + `audit:content` checks. Likely needs:
  - Auto-generated → draft staging area (`tools/data/_staging/` pattern already exists)
  - Automated validation pass
  - Human review step before merge
- **Cost:** Generating one topic (~7 notes + 12 flashcards + ~20 questions) is far more expensive than marking one answer. Need batching, caching, and cost tracking.
- **Architecture impact:**
  - New Lambda (or Step Function) for batch generation
  - Staging workflow (already partially built with BBC pipeline)
  - An admin UI to review and approve generated content (or keep it CLI-based)

**Recommendation:** Extend the BBC pipeline pattern. Build a `generate:topic` script that calls an LLM, writes to `_staging/`, validates, and flags for human review. Keep it out of the critical user path — this is a content tool, not a user-facing feature.

---

### 2.7 Mock Exam Generation

**Current status (2026-08-14):** Mock exams use `buildQuestionSet()` — a **deterministic seeded sampler** from existing questions. No real AI generation. The variations rollout (Phases 1–4) is steadily deepening the pools this sampler draws from, which directly improves mock freshness without any new machinery.

**What needs to change:**

- If reusing existing questions: the current sampler works. Just needs more questions in the pool (content work — now accelerated by variant groups + generators).
- If generating **novel** questions for mocks (like RV "Prediction Exams"): needs the same LLM generation pipeline as §2.6, plus:
  - Paper structure awareness (exam format, mark distribution, timing)
  - Difficulty calibration (easy/medium/hard mix matching real papers)
  - Non-duplication guarantee (don't serve a question the student has seen)
- **Architecture impact:** If generating on-the-fly: a synchronous API endpoint or pre-generated pool refreshed periodically. Pre-generated is safer and cheaper.

**Recommendation:** Two-tier approach:
1. **Tier 1 (free/core):** Sampled from existing pool — already works.
2. **Tier 2 (premium "Prediction Papers"):** Pre-generated batches refreshed ~monthly via the same LLM pipeline as §2.6, with human spot-check. Served from a static-like cache.

---

### 2.8 UI & Server-Side Split

**Current gap:** Everything is static export. The only "server" is the feedback Lambda.

**The fundamental question:** Does IBLearn remain a static site with thin serverless APIs, or become a full-stack serverful app?

| Approach | Pros | Cons |
|---|---|---|
| **(A) Stay static + Lambdas** | Cheap (~$1–3/mo), fast CDN, simple deploy, PWA offline works | Auth gating is hacky (Lambda@Edge), no SSR, no middleware, no streaming |
| **(B) Full Next.js server on AWS** (ECS/Amplify/Lambda) | Full App Router power (middleware, API, RSC, SSR), unified codebase | More expensive, more ops, CDN caching harder, PWA SW needs rework |
| **(C) Hybrid: static S3 + API Gateway/Lambda backend** | Best of both — CDN for static, serverless for dynamic; clear API contract | Two deploy paths, CORS, complex routing |

**Recommendation (decided 2026-08-14): (C) in spirit, implemented as `architecture-evolution-plan.md`'s Option A** — the static export stays on S3 + CloudFront for **all** pages (public and app); the dynamic layer is Lambda Function URLs behind CloudFront `/api/*` behaviors (no API Gateway, no Lambda@Edge, no auth-walled pages). (B) serverful Next.js remains the documented long-term path, triggered only by premium-content gating or SSR needs (§2.1).

The simple path:
1. **Keep S3 + CloudFront for all static pages** (home, subjects, topics, flashcard viewer, etc. — anything not behind auth).
2. **Add API Gateway + Lambda / DynamoDB for all dynamic data:** auth, progress sync, subscription checks, AI generation, analytics events.
3. **The app pages** (quiz, exams, diagnostics, papers runner) are the grey area — they could remain static (ships with all question data, checks subscription client-side + server RPC) OR become SSR for gating.

This preserves the ~$1–3/mo base cost while the dynamic layer scales with usage. Later, if SSR becomes necessary (e.g., for SEO on topic pages or dynamic personalization), migrate to Next.js on AWS (Amplify or a custom ECS setup).

---

### 2.9 Feature Toggles & Entitlements

Discussed 2026-08-14. Two separate axes that should not be conflated:

1. **Rollout toggles (ops-owned):** is feature X visible at all — for phased launches, kill-switches, A/B. Server-controlled, no user dimension.
2. **Entitlements (user-owned):** does *this user* have feature X — derived from their subscription tier, possibly with per-feature grants.

**Data model (DynamoDB, expandable by design):**

```
Feature:        { featureId (PK), name, description, tier: "free"|"premium",
                  enabled: bool,        // rollout toggle
                  benefitCopy: string } // tooltip text for the locked view
Entitlement:    { userId (PK), featureId (SK), source: "subscription"|"grant", expiresAt? }
```

Entitlements are normally *derived* from tier (`tier → featureId[]` mapping lives in the Features table), with the Entitlement table reserved for manual grants/overrides. Adding a feature = one row, no deploy.

**Serving path:** `GET /api/me` returns `{ user, entitlements: featureId[] }`; a client `EntitlementsContext` (same pattern as `ProgressContext`) gates the UI. Non-entitled rendering = a `LockedFeature` wrapper component: feature visible but disabled/teased, tooltip or popover explains the benefit (`benefitCopy`) and links to the pricing page. The feature list endpoint (`GET /api/features`) is public — it's what the pricing page renders.

**Enforcement:** client gating is UX only. Any premium API (`/api/feedback` quotas, generated papers, progress sync beyond free limits) must re-check entitlement server-side from the session. Question content currently ships inside the static export — truly premium *content* (as opposed to premium *features*) needs either server-served question sets or accepting that determined users can read the JSON (decide at subscription design time; see §2.3).

**Testing:** fits the standing dummy-dependency directive — `EntitlementsContext` gets a deterministic dummy in dev/e2e with per-test entitlement injection, exactly like `src/lib/feedback/dummy.ts`.

**Dependencies:** accounts (§2.1) must exist first; the toggle half (axis 1) can ship earlier as a simple env/DB flag if needed for staged rollouts.

---

## 3. Target Architecture (Phase 7+)

```
                                CloudFront
        ┌─────────────────────────────────────────────────┐
  Users │  octavlearning.com (PROD) / dev.octavlearning.com (DEV) │
        └──┬──────────┬──────────┬────────────────────────┘
           │          │          │
      /*   │     /api/*     /_next/*
           ▼          ▼          ▼
        S3        API GW       S3
      (static)      │       (assets)
                    │
           ┌────────┼────────┐
           ▼        ▼        ▼
        /auth   /progress  /feedback
        Lambda  Lambda     Lambda
           │        │
           ▼        ▼
      ┌──────────────────┐
      │    DynamoDB      │
      │  (users, subs,   │
      │   progress,      │
      │   features,      │
      │   entitlements,  │
      │   analytics)     │
      └──────────────────┘
           │
      Stripe webhook
           │
      ┌────▼─────┐
      │  Stripe   │
      │(subs/pay) │
      └───────────┘
```

### New AWS resources needed

| Resource | Purpose |
|---|---|
| API Gateway (HTTP API) | Routes `/api/auth/*`, `/api/progress/*`, `/api/subscription/*`, `/api/generate/*` |
| Cognito, Clerk, or custom OTP | Authentication (see §2.1a — custom username + email-OTP via SES is a viable zero-per-MAU-cost option that fits the dummy-dependency testing directive) |
| DynamoDB tables | `Users`, `Progress`, `Subscriptions`, `Features`, `Entitlements`, `AnalyticsEvents` |
| New Lambdas | Auth proxy, progress CRUD, subscription webhook, generation |
| SQS queue | Generation jobs, analytics event batching (optional) |

### Database choice: DynamoDB vs RDS

| | DynamoDB | RDS/Postgres |
|---|---|---|
| Scaling | Serverless, auto | Manual instance size |
| Cost at low scale | Very cheap | Idle instance costs |
| Lambda fit | Excellent (no VPC needed) | Needs VPC, connection pooling |
| Query flexibility | Limited (index design critical) | Full SQL |
| **Verdict** | **DynamoDB (single-table design)** — all records keyed by userId. If analytics queries become complex, add a secondary index or export to S3 + Athena. | Overkill for one-person team. |

---

## 4. Incremental Migration Path

| Step | What to build | Prerequisite | Complexity |
|---|---|---|---|
| **0. Foundation ✅** | DynamoDB tables (`octav-users/sessions/otp-codes/progress/rate-limits`) + SES domain identity — **done 2026-08-14/15 (Phase 0)**; Lambda Function URLs behind CloudFront `/api/*` (no API Gateway — see §2.8) | None | Medium |
| **1. Accounts ✅** | Custom email-OTP (§2.1a) + `/api/auth/*` Lambda + `/login` + account management (`/api/me`, profile picker, session/device list, export/delete) — **done 2026-08-15 (Phase B), merged 2026-08-16** | Step 0 | Medium |
| **2. Progress sync ✅** | localStorage → DynamoDB with union/ladder-max/flashcard-LWW merge + `/api/progress/*` (offline-first SyncManager, first-login migration) — **done 2026-08-15/16 (Phase C), merged 2026-08-16** | Step 0 | Medium |

**First milestone (decided 2026-08-14): Steps 0–2 together** (accounts + progress sync) — **shipped to `develop` 2026-08-16; live on DEV, pending PROD (`main`) promotion and SES production access.** Entitlements (§2.9) deferred to subscription design time.
| **3. Analytics** | Plausible script + server-side event Lambda | None (can parallel) | Low |
| **4. Subscriptions + entitlements** | Stripe webhook + `/api/subscriptions` + `EntitlementsContext` + `LockedFeature` UI (§2.9) | Steps 1, 2 | High |
| **5. AI feedback (prod)** | ~~Configure provider key~~ **Done 2026-08-09 (DeepSeek).** Remaining: caching layer + per-user quotas | None (live) | Low |
| **6. Practice generation** | Generation Lambda + staging pipeline + admin review | None (can parallel) | Medium |
| **7. Mock generation** | Pre-generated pool + refresh schedule | Step 6 | Low |
| **UI/Server split** | Adopt hybrid (C) — refactor as features land | All above | Ongoing |

---

## 5. Key Decisions to Make

1. ~~**Auth provider: Clerk vs. Auth0 vs. Cognito vs. custom email-OTP?**~~ **Decided 2026-08-14:** custom email-OTP (§2.1a). Clerk is the fallback if social login/passkeys become requirements.

2. ~~**Static vs. serverful: do you accept moving off pure static export?**~~ **Decided 2026-08-14:** stay static export + Lambda API layer (§2.1, §2.8). Serverful Next.js is a later, separately-justified migration (premium-content gating or SSR).

3. ~~**Database: DynamoDB single-table vs. RDS?**~~ **Confirmed 2026-08-14:** DynamoDB, per-domain tables, on-demand.

4. **Monetization model: what's free vs. premium?**
   - This determines which API endpoints need subscription gating and what the Stripe price points are. Reference models: SME ~£40/yr all-access, RV ~$249–499 one-time. The §2.9 feature/entitlement model is the mechanism; this decision is the *content* of the tiers.

5. ~~**AI provider: Moonshot or OpenAI/Anthropic?**~~ **Resolved 2026-08-09:** DeepSeek (`deepseek-v4-flash`) via the `openai-compatible` provider — Moonshot is unreachable from ap-east-1. Revisit only if cost or quality demands it.

6. ~~**Account model & first milestone?**~~ **Decided 2026-08-14:** parent → child profiles (solo student = parent with one profile; see `architecture-evolution-plan.md` §2.6); first milestone = accounts + progress sync (migration Steps 0–2). Entitlements (§2.9) deferred to subscription design time.
