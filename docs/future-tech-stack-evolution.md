# Future Tech Stack Evolution

> Analysis of how the current stack evolves to support accounts, subscriptions, AI generation, and a UI/server split.
> Written 2026-08-08. Companion to `revised-implementation-plan.md` (Phase 7, currently deferred) and `aws-deployment-plan.md`.

---

## 1. Current Tech Stack (Snapshot)

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | **Static export** to S3 + CloudFront; `BUILD_EXPORT=1` gate |
| **UI** | React 19, Tailwind CSS 3, Framer Motion, KaTeX, Lucide React | Dark mode, responsive (iPhone SE → desktop) |
| **State** | `localStorage` (versioned, `STORAGE_VERSION=2`) | Per-device only — no sync |
| **Data** | Static JSON files (137 topics), Zod schema, generated registry | Flat files, no database |
| **Backend** | 1 Lambda (`/api/feedback`) via CloudFront Function URL origin | Node 22, arm64, 256 MB; dev/e2e use Next route handler instead |
| **AI** | Provider abstraction (`openai-compatible` + `dummy`), per-IP rate limiter | Moonshot key **not yet configured** (Lambda returns `{configured:false}`) |
| **Infra** | AWS S3 + CloudFront + Lambda, Terraform IaC, GitHub Actions CI/CD (OIDC) | Live at `d2c1g77zfmjpm3.cloudfront.net` |
| **Testing** | Vitest (unit, ~250 tests), Playwright (e2e, 17 specs, 3-device matrix) | |
| **PWA** | Hand-rolled SW, offline page, install prompt (iOS manual) | Prod-gated registration |

---

## 2. Feature-by-Feature Impact Analysis

### 2.1 Account Registration & Authentication

**Current gap:** Completely missing. The site is fully anonymous — no session, no cookies, no `headers()`/`cookies()` usage.

**What needs to change:**

- **Auth provider:** Clerk (quickest, managed, React-native support) or Auth0/NextAuth (more control). Clerk is best-fit for solo-dev scale — user management UI, social login, passkeys all out of the box.
- **Session management:** The current `localStorage` progress must be associated with a user ID. On first login, merge/carry-over anonymous progress.
- **Architecture shift:** Auth requires **server-side session verification** for gated content. Current static export can't do this. Options:
  - **(A) Stay static S3 + CloudFront, add Lambda@Edge for auth checks** — CloudFront triggers a viewer-request Lambda that validates the session token (JWT) before serving gated pages. Keeps the static export but adds complexity.
  - **(B) Move to serverful Next.js on AWS** (ECS Fargate / Amplify / Lambda + SSR) — gives full `proxy.ts` (Next 16's renamed middleware) auth gating, API routes, SSR. Loses the simplicity of static hosting.
  - **(C) Hybrid: static marketing pages on S3, app behind auth on a server** — cleanest for a gated product, but splits the codebase.

**Recommendation:** **(B) or (C),** because accounts unlock everything else below. A server is inevitable once you have per-user data.

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

**Current status:** The core is built. Lambda + openai-compatible provider + dummy for dev. But the Moonshot key is **not yet configured** in production.

**What's still needed:**

- **Configure the Moonshot key** (or choose another provider). The infrastructure is ready — just set `FEEDBACK_ENV` repo secret and redeploy.
- **Cost management:** AI marking is token-expensive. Needs:
  - **Response caching** — same question + similar answer → reuse previous feedback
  - **Usage quotas per user** (free tier: N marks/month; premium: unlimited)
  - **Prompt optimization** to reduce token count
- **Quality:** The dummy/injection system is already built for production-issue reproduction. Good.
- **Architecture impact:** Minimal — the Lambda is already the right shape. May want to add a queue (SQS) for async processing if latency is high, or keep it synchronous with streaming.

**Recommendation:** This is the least-blocked feature. Configure the key, add caching, done.

---

### 2.6 AI Practice Generation

**Current gap:** Topics are hand-authored (7 notes / 12 flashcards / 15 questions). BBC scrapes provide reference material, but questions are authored manually.

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

**Current gap:** Mock exams use `buildQuestionSet()` — a **deterministic seeded sampler** from existing questions. No real AI generation.

**What needs to change:**

- If reusing existing questions: the current sampler works. Just needs more questions in the pool (content work).
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

**Recommendation: (C) Hybrid, derisked toward (B) over time.**

The simple path:
1. **Keep S3 + CloudFront for all static pages** (home, subjects, topics, flashcard viewer, etc. — anything not behind auth).
2. **Add API Gateway + Lambda / DynamoDB for all dynamic data:** auth, progress sync, subscription checks, AI generation, analytics events.
3. **The app pages** (quiz, exams, diagnostics, papers runner) are the grey area — they could remain static (ships with all question data, checks subscription client-side + server RPC) OR become SSR for gating.

This preserves the ~$1–3/mo base cost while the dynamic layer scales with usage. Later, if SSR becomes necessary (e.g., for SEO on topic pages or dynamic personalization), migrate to Next.js on AWS (Amplify or a custom ECS setup).

---

## 3. Target Architecture (Phase 7+)

```
                          CloudFront
                    ┌──────────────────────┐
  Users ───────────▶│  CDN (d2c1g...net)   │
                    └──┬───────┬───────┬───┘
                       │       │       │
                  /*   │  /api/*  │  /_next/*
                       ▼       ▼       ▼
                    S3     API GW    S3
                 (static)    │    (assets)
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
| Cognito or Clerk | Authentication (Clerk recommended — simpler, no Cognito complexity) |
| DynamoDB tables | `Users`, `Progress`, `Subscriptions`, `AnalyticsEvents` |
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
| **0. Foundation** | API Gateway + DynamoDB tables (`Users`, `Progress`) | None | Medium |
| **1. Accounts** | Clerk integration + `/api/auth` Lambda + login UI | Step 0 | Medium |
| **2. Progress sync** | Migrate localStorage → DynamoDB with optimistic merge + `/api/progress` CRUD | Step 0 | Medium |
| **3. Analytics** | Plausible script + server-side event Lambda | None (can parallel) | Low |
| **4. Subscriptions** | Stripe webhook + `/api/subscriptions` + gating UI | Steps 1, 2 | High |
| **5. AI feedback (prod)** | Configure Moonshot key + caching layer | None (infra ready) | Low |
| **6. Practice generation** | Generation Lambda + staging pipeline + admin review | None (can parallel) | Medium |
| **7. Mock generation** | Pre-generated pool + refresh schedule | Step 6 | Low |
| **UI/Server split** | Adopt hybrid (C) — refactor as features land | All above | Ongoing |

---

## 5. Key Decisions to Make

1. **Auth provider: Clerk vs. Auth0 vs. Cognito?**
   - Clerk is fastest to ship, best DX, free tier up to 10K MAU. Recommended.

2. **Static vs. serverful: do you accept moving off pure static export?**
   - Hybrid (C) lets you phase it: keep static for public pages, add APIs for dynamic data. Start there.

3. **Database: DynamoDB single-table vs. RDS?**
   - DynamoDB is the natural fit for Lambda + low scale.

4. **Monetization model: what's free vs. premium?**
   - This determines which API endpoints need subscription gating and what the Stripe price points are. Reference models: SME ~£40/yr all-access, RV ~$249–499 one-time.

5. **AI provider: Moonshot (Chinese market focus) or OpenAI/Anthropic?**
   - The existing `openai-compatible` provider works with any. Decision depends on target market and cost structure. Moonshot is cheaper for Chinese-market users; OpenAI/Anthropic have broader model selection.
