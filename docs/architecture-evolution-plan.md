# Architecture Evolution Plan — Octav Learning

> **Status:** Approved for implementation (2026-08-14). **Phase 0 (DynamoDB + SES), Phase B (auth + account management), and Phase C (progress sync) implemented and merged to `develop` as of 2026-08-16** — see the Phase C checklist (§7) and `docs/PROGRESS.md`. Remaining: Phase A (analytics), Phase D (leaderboard), SES production access (pre-launch blocker).
> Decisions locked 2026-08-14: Option A — static export + Lambda Function URLs (Constraint 1); custom email-OTP auth (§2); parent → child account model (§2.6, Q1); first milestone = Phase B (auth + account management) + Phase C (progress sync). Analytics (Phase A) and leaderboard (Phase D) deferred; entitlements (`future-tech-stack-evolution.md` §2.9) deferred to subscription design time.
> **Author:** Senior architect review (direct analysis, not sub-agent — team resource limit hit)
> **Scope:** Email+OTP auth, server-side progress persistence, anonymous leaderboard, web analytics
>
> **Read alongside:** `AGENTS.md` (current architecture), `docs/aws-deployment-plan.md`,
> `docs/phase-7-implementation-plan.md` (PWA/static export), `docs/custom-domain-cutover-plan.md` (DEV/PROD split)

---

## Table of contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Authentication Architecture (Feature 1)](#2-authentication-architecture-feature-1)
3. [Progress Persistence Architecture (Feature 2)](#3-progress-persistence-architecture-feature-2)
4. [Leaderboard Architecture (Feature 3)](#4-leaderboard-architecture-feature-3)
5. [Analytics Architecture (Feature 4)](#5-analytics-architecture-feature-4)
6. [Infrastructure Changes](#6-infrastructure-changes)
7. [Migration Plan (Phased)](#7-migration-plan-phased)
8. [Risk Register](#8-risk-register)
9. [Open Questions for the Founder](#9-open-questions-for-the-founder)

---

## 1. Current State Assessment

### 1.1 Architecture snapshot

```
                         ┌──────────────────────────────────────────┐
                         │              CloudFront                  │
                         │  (ap-east-1, PriceClass_100)             │
                         │                                          │
                         │  /api/*  ──────────────────────┐        │
                         │  /*      ─── S3 origin ───┐    │        │
                         │  www→apex 301 (Function)  │    │        │
                         │  /foo→/foo.html (Function)│    │        │
                         └───────────────────────────┼────┼────────┘
                                                      │    │
                                          ┌───────────▼┐  ┌─▼──────────────┐
                                          │  S3 bucket │  │ Lambda Func URL│
                                          │  (private) │  │ /api/feedback  │
                                          │  static    │  │ (nodejs24.x)   │
                                          │  export    │  │ esbuild bundle│
                                          └────────────┘  └────────────────┘

     Browser (PWA)
     ├── localStorage: iblearn_progress (v2)
     │   ├── userProgress    { totalStars, currentStreakDays, lastStudyDate }
     │   ├── topicProgress   Record<"subj:topic", { attempts: QuizAttempt[] }>
     │   ├── examResults     ExamResult[]
     │   ├── ladderProgress  Record<courseId, Record<level, { bestScore, completedAt }>>
     │   └── flashcardProgress Record<cardId, { status, lastReviewed, knownStreak }>
     ├── Service Worker (public/sw.js) — offline cache
     └── No auth, no server sessions, no database
```

### 1.2 Key facts

| Aspect | Current state | Source |
|--------|--------------|--------|
| **Build mode** | `output: 'export'` when `BUILD_EXPORT=1` — static HTML/JS to S3 | `next.config.mjs:11-18` |
| **API in prod** | Lambda Function URL behind CloudFront `/api/*` behavior; the Next `/api/feedback` route is stashed during static build | `next.config.mjs:2-6`, `lambda/feedback/index.ts` |
| **API in dev/e2e** | Next route handler `src/app/api/feedback/route.ts` → delegates to shared `http-handler.ts` | `src/app/api/feedback/route.ts` |
| **Shared handler pattern** | `src/lib/feedback/http-handler.ts` is the single source of truth; both the Next route and the Lambda adapter import it | `AGENTS.md` (Feedback handler contract) |
| **Progress store** | `src/lib/progress-store.ts` — reads/writes `localStorage["iblearn_progress"]`, version 2 | `progress-store.ts:3-4` |
| **Progress React layer** | `src/context/ProgressContext.tsx` — wraps store in context, exposes `recordAttempt`, `recordExam`, `recordLadder`, `recordFlashcard` + `refresh()` | `ProgressContext.tsx:41-97` |
| **Region** | `ap-east-1` (Hong Kong) | `terraform/envs/prod/main.tf:37` |
| **CI/CD** | GitHub OIDC → role `iblearn-github-deploy`; `develop`→DEV, `main`→PROD; gates: validate/audit/lint/vitest/build/e2e/illustrations/security → deploy | `AGENTS.md` (CI/CD), `.github/workflows/ci.yml` |
| **Terraform** | bootstrap (local state), modules: `site`, `feedback_api`, `ci`; prod env composes them; AWS provider `~>6.0` | `terraform/envs/prod/main.tf` |
| **PWA** | Hand-rolled SW (`public/sw.js`), prod-gated registration, installable, offline works | `AGENTS.md` (PWA), `src/components/ServiceWorkerRegistration.tsx` |
| **Content** | 137 topics across 5 subjects, bundled into static JS chunks (no runtime fetching) | `AGENTS.md` (Content lives in JSON), registry.ts |
| **Cost** | ~$0.50-2/mo at current family-use scale (S3 + CF + 1 Lambda + DeepSeek API calls) | inferred from architecture |

### 1.3 Architectural constraints for evolution

**Constraint 1 — Static export blocks server-side Next.js features.**
`next.config.mjs:18` sets `output: 'export'` for prod builds. This means:
- No Next.js Server Actions, no middleware, no server components with dynamic data
- No Next.js API routes in production (they're stashed during `build:static`)
- All server-side logic must live in **Lambda Function URLs** behind CloudFront's `/api/*` behavior (the established pattern)

**Decision point:** Three options for adding server-side features:

| Option | Description | Tradeoff |
|--------|-------------|----------|
| **A. Stay static export + more Lambdas** | Keep `output: 'export'`; add new Lambda Function URLs for auth/progress/leaderboard APIs behind `/api/*` | ✅ No build change, proven pattern (feedback Lambda works), minimal disruption. ❌ No SSR/middleware, auth cookies need careful CloudFront handling, no Next.js server features |
| **B. Hybrid: drop static export, use Next.js standalone** | Move to `next start` / Next.js server on Lambda@Edge or container; keep S3 for static assets | ✅ Full Next.js features (middleware, SSR, API routes, server actions). ❌ Major infra change, loses offline-first static simplicity, higher cost/complexity, SW + caching rewrite |
| **C. Hybrid: Vercel/serverless Next.js** | Deploy on Vercel or AWS OpenNext instead of S3+CF | ✅ Easiest path to full Next.js. ❌ Vendor lock-in, different deploy model from current terraform, cost unpredictable at scale |

**Recommendation: Option A (stay static export + more Lambdas).**

Rationale:
1. The feedback Lambda pattern is proven and well-understood — extend it, don't replace it.
2. The PWA offline-first architecture is a core product feature (phone-first, works offline); static export supports this cleanly.
3. Auth + progress + leaderboard don't need SSR — they're API calls that the client makes after hydration.
4. Lowest risk and cost; can always migrate to Option B later if server-side rendering becomes necessary.
5. All 4 features can be implemented as Lambda Function URLs behind `/api/*`, exactly like `/api/feedback` today.

**Constraint 2 — ap-east-1 region.** SES (email sending) is NOT available in ap-east-1 — `email.ap-east-1.amazonaws.com` does not resolve (verified by the Phase 0 apply failure, 2026-08-14). The SES domain identity therefore lives in ap-southeast-1, passed into `module.ses` via a provider alias in `terraform/envs/prod/main.tf`. DynamoDB is fully available. This is fine for the current scale.

**Constraint 3 — No local terraform apply (user directive).** All applies are CI-only because `FEEDBACK_ENV` lives only in the GitHub secret. New secrets (SES, DynamoDB table names, JWT signing keys) will need the same treatment — added as GitHub secrets/variables, passed through terraform, no local applies.

**Constraint 4 — Offline-first PWA.** The app works offline (SW caches content). Progress is written to localStorage synchronously. Any server-side progress sync must NOT break the offline UX — writes go to localStorage immediately, sync to server in the background when online.

---

## 2. Authentication Architecture (Feature 1)

### 2.1 Email + OTP flow

```
┌─────────┐          ┌──────────┐          ┌─────────┐          ┌──────────┐
│ Browser │          │ CloudFront│         │ Auth    │          │   SES    │
│ (PWA)   │          │ /api/auth │         │ Lambda  │          │  (email) │
└────┬────┘          └─────┬────┘          └────┬────┘          └────┬─────┘
     │                     │                    │                    │
     │ 1. POST /api/auth/  │                    │                    │
     │    request-otp      │                    │                    │
     │    { email }        │                    │                    │
     ├────────────────────▶│───────────────────▶│                    │
     │                     │                    │ 2. Generate 6-digit│
     │                     │                    │    OTP, hash it,   │
     │                     │                    │    store in OTP    │
     │                     │                    │    table (TTL 10m) │
     │                     │                    │                    │
     │                     │                    │ 3. Send email via  │
     │                     │                    │    SES             │
     │                     │                    ├───────────────────▶│
     │                     │                    │                    │ 4. Email delivered
     │ 5. 200 { "message": │◀───────────────────│                    │
     │    "Check your email"}│                   │                    │
     │◀────────────────────│                    │                    │
     │                     │                    │                    │
     │ 6. POST /api/auth/  │                    │                    │
     │    verify-otp       │                    │                    │
     │    { email, otp }   │                    │                    │
     ├────────────────────▶│───────────────────▶│                    │
     │                     │                    │ 7. Hash provided   │
     │                     │                    │    OTP, compare to │
     │                     │                    │    stored hash     │
     │                     │                    │                    │
     │                     │                    │ 8. Create/update   │
     │                     │                    │    session in      │
     │                     │                    │    Session table   │
     │                     │                    │    (TTL 30d)        │
     │                     │                    │                    │
     │ 9. Set HTTP-only    │◀───────────────────│                    │
     │    cookie:          │                    │                    │
     │    octav_session=   │                    │                    │
     │    <sessionId>      │                    │                    │
     │    HttpOnly, Secure,│                    │                    │
     │    SameSite=Lax,    │                    │                    │
     │    Path=/           │                    │                    │
     │◀────────────────────│                    │                    │
```

### 2.2 Session management

**Strategy: Server-side sessions in DynamoDB, identified by an opaque session ID in an HTTP-only cookie.**

Why not JWTs?
- JWTs are stateless → impossible to revoke a compromised session without a blocklist (which reintroduces state).
- Server-side sessions in DynamoDB can be revoked instantly (delete the item), and TTL handles expiry automatically.
- The session lookup is a single DynamoDB `GetItem` (≤5ms) — negligible latency.

**Cookie spec:**
```
Name:     octav_session
Value:    <UUID v4> (opaque, unguessable)
HttpOnly: true   (JS can't read it → XSS can't steal it)
Secure:   true   (HTTPS only)
SameSite: Lax    (allows top-level navigation, blocks CSRF on POST)
Path:     /
Max-Age:  2592000  (30 days)
```

**Session table (DynamoDB):**

```
Table: octav-sessions
  PK: sessionId (string, UUID)
  Attributes:
    userId        (string, FK → users table)
    email         (string)
    createdAt     (ISO string)
    lastAccessedAt (ISO string)
    userAgent     (string, for device display)
    ip            (string, for security audit)
  TTL: expiresAt (30 days from lastAccessedAt, refreshed on each request)
  GSI1: userId → list all sessions for a user ("manage devices" UI)
```

### 2.3 Data model

**Users table (DynamoDB):**

```
Table: octav-users
  PK: userId (string, ULID)
  Attributes:
    email         (string, lowercased)
    displayName   (string, for leaderboard — auto-generated or chosen)
    role          ("parent" | "student")
    childProfiles (list of { profileId, displayName, stage }) — parent links children
    createdAt     (ISO string)
    lastLoginAt   (ISO string)
  GSI1: email → userId (lookup by email at login)
```

**OTP table (DynamoDB):**

```
Table: octav-otp-codes
  PK: email (string, lowercased)
  Attributes:
    codeHash      (string, bcrypt or SHA-256 of the 6-digit OTP)
    attempts      (number, max 5 before lockout)
    createdAt     (ISO string)
  TTL: 600 (10 minutes from creation)
```

### 2.4 API contract

All endpoints are Lambda Function URLs behind CloudFront `/api/auth/*`.

```
POST /api/auth/request-otp
  Request:  { "email": "parent@example.com" }
  Response: 200 { "message": "If an account exists, a code has been sent." }
            429 { "error": "Too many requests. Try again in 60s." }
  Notes:    Always returns 200 (don't leak whether email is registered).
            Rate limit: 3 requests / 10 min / email + IP.
            OTP: 6 digits, 10-min TTL, max 5 verification attempts.

POST /api/auth/verify-otp
  Request:  { "email": "parent@example.com", "otp": "123456" }
  Response: 200 { "user": { "userId": "...", "email": "...", "displayName": "..." } }
                 Set-Cookie: octav_session=<sessionId>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
            400 { "error": "Invalid or expired code." }
            429 { "error": "Too many attempts. Request a new code." }
  Notes:    On first login (email not in users table), auto-create account.

POST /api/auth/logout
  Request:  (cookie: octav_session)
  Response: 200 { "message": "Logged out." }
                 Set-Cookie: octav_session=; Max-Age=0
  Notes:    Deletes session from DynamoDB.

GET /api/auth/me
  Request:  (cookie: octav_session)
  Response: 200 { "user": { "userId": "...", "email": "...", "displayName": "...", "role": "parent" } }
            401 { "error": "Not authenticated." }
  Notes:    Called on app load to check if user is logged in.
```

### 2.5 Security measures

| Concern | Mitigation |
|---------|-----------|
| OTP brute-force | Max 5 verification attempts per OTP; 10-min TTL; rate limit 3 OTP requests / 10 min / email+IP |
| Email enumeration | `/request-otp` always returns 200 with same message regardless of whether email is registered |
| Session hijacking | HTTP-only + Secure + SameSite=Lax cookie; opaque UUID (not JWT); server-side revocation |
| CSRF | SameSite=Lax cookie; all state-changing operations are POST with JSON body (not form-encodable) |
| XSS | HTTP-only cookie means JS can't steal session; CSP headers via CloudFront response policy |
| Multi-device | Each login creates a new session; user can view/revoke sessions via GSI1 on sessions table |
| Abuse (mass OTP requests) | Per-IP rate limiting (reuse the in-memory pattern from feedback handler, or move to DynamoDB-based) |

### 2.6 Account model: parent → child

```
Parent account (email: parent@example.com)
  ├── childProfile: { profileId: "p_abc", displayName: "Alex", stage: "ks3" }
  └── childProfile: { profileId: "p_def", displayName: "Sam", stage: "dp" }
```

- Parents register with email; they create child profiles (display name + stage) — no email needed for children.
- Each child profile has its own progress data, keyed by `userId:profileId`.
- Parent can switch between child profiles in the UI (profile picker in header).
- Leaderboard entries are per child-profile (not per parent account).

### 2.7 Interaction with static export

Auth is entirely client-side after hydration:
1. On app load, `GET /api/auth/me` (Lambda) checks the cookie → returns user or 401.
2. If not authenticated → show landing page with "Sign in" button (calls `/api/auth/request-otp`).
3. If authenticated → load progress from server (`GET /api/progress`, see Feature 2).
4. The HTTP-only cookie is sent automatically by the browser on all `/api/*` requests (same-origin via CloudFront).

**No changes to the static build are needed.** The cookie is set by the Lambda's response, and CloudFront passes it through. The CloudFront `/api/*` behavior already forwards all headers including `Cookie`.

---

## 3. Progress Persistence Architecture (Feature 2)

### 3.1 Current data model (localStorage)

From `src/lib/progress-store.ts:6-13` and `src/content/types.ts:100-153`:

```
StoredData {
  version: 2
  userProgress: {
    totalStars: number
    currentStreakDays: number
    lastStudyDate: string | null
  }
  topicProgress: Record<"subjectId:topicId", {
    topicId, subjectId, topicTitle, subjectTitle,
    attempts: [{ date, correctCount, totalCount, questionResults?: [{questionId, correct}] }]
  }>
  examResults: [{ examId, date, correctCount, totalCount, secondsUsed }]
  ladderProgress: Record<courseId, Record<level, { bestScore, completedAt }>>
  flashcardProgress: Record<cardId, { status, lastReviewed, knownStreak }>
}
```

### 3.2 Proposed server-side data model (DynamoDB)

**Why DynamoDB?**
- Already in the AWS ecosystem (ap-east-1, terraform-managed)
- Single-digit millisecond reads/writes at any scale
- Pay-per-request billing (no capacity planning, ~$0.00 at family-use scale)
- TTL for automatic cleanup of old sessions/OTP codes
- The access patterns are simple key-based lookups (no complex joins)

**Why not PostgreSQL (RDS)?**
- RDS has a minimum ~$15/mo (even Aurora Serverless v2 has a baseline); DynamoDB on-demand is $0 until you use it
- The data is document-like (nested attempts arrays, flashcard maps) — DynamoDB's flexible attributes fit naturally
- No relational integrity needed (progress is per-user, no cross-user joins except leaderboard, which uses a different pattern)
- Adds operational burden (VPC, security groups, backups) that DynamoDB avoids

**Table: `octav-progress`**

```
PK: userId (string)          — e.g. "usr_01HXYZ..." or "anon_<deviceId>"
SK: dataType (string)        — partition key for different progress types

Items:
  ┌─ dataType: "META" ──────────────────────────────────────┐
  │  userId, dataType="META"                                 │
  │  totalStars, currentStreakDays, lastStudyDate            │
  │  lastSyncedAt (ISO)                                      │
  └──────────────────────────────────────────────────────────┘
  ┌─ dataType: "TOPIC#math:math-yr7-algebra-1" ─────────────┐
  │  userId, dataType="TOPIC#<subjectId>:<topicId>"           │
  │  topicId, subjectId, topicTitle, subjectTitle             │
  │  attempts: [{ date, correctCount, totalCount,             │
  │              questionResults?: [{questionId, correct}] }] │
  │  (append-only array; could grow large over time —        │
  │   cap at 50 most recent attempts per topic)               │
  └──────────────────────────────────────────────────────────┘
  ┌─ dataType: "EXAM#math-y7:set-1" ─────────────────────────┐
  │  userId, dataType="EXAM#<examId>"                         │
  │  examId, date, correctCount, totalCount, secondsUsed      │
  │  (one item per exam attempt)                              │
  └──────────────────────────────────────────────────────────┘
  ┌─ dataType: "LADDER#math-y7" ─────────────────────────────┐
  │  userId, dataType="LADDER#<courseId>"                     │
  │  levels: Record<level, { bestScore, completedAt }>        │
  └──────────────────────────────────────────────────────────┘
  ┌─ dataType: "FLASHCARD#math-yr7-algebra-1" ───────────────┐
  │  userId, dataType="FLASHCARD#<topicId>"                   │
  │  cards: Record<cardId, { status, lastReviewed, knownStreak }>│
  └──────────────────────────────────────────────────────────┘
```

This single-table design keeps all of a user's progress in one partition (efficient `Query` by userId), with the sort key separating data types. `GetItem` for META, `Query` for all topic progress, `BatchGetItem` for specific topics.

### 3.3 API contract

```
GET /api/progress
  Auth: required (cookie)
  Response: 200 { userProgress, topicProgress[], examResults[], ladderProgress, flashcardProgress }
            401 { "error": "Not authenticated." }
  Notes: Returns the full progress snapshot (same shape as localStorage StoredData).
        Called once on app load when authenticated.

POST /api/progress/sync
  Auth: required (cookie)
  Request: {
    events: [
      { type: "quizAttempt", topicId, subjectId, topicTitle, subjectTitle,
        correctCount, totalCount, questionResults, clientTimestamp },
      { type: "examResult", examId, correctCount, totalCount, secondsUsed, clientTimestamp },
      { type: "ladderResult", courseId, level, score, clientTimestamp },
      { type: "flashcardResult", cardId, status, clientTimestamp }
    ],
    clientMeta: { totalStars, currentStreakDays, lastStudyDate }
  }
  Response: 200 { "synced": <count>, "serverMeta": { totalStars, currentStreakDays, lastStudyDate } }
            401 { "error": "Not authenticated." }
  Notes: Batch endpoint — client sends all unsynced events.
        Server applies them idempotently (keyed by clientTimestamp + type + topicId).
        Returns the authoritative server-side meta for the client to reconcile.
```

### 3.4 Sync strategy: offline-first with background reconciliation

**Critical principle: the offline PWA UX must not change.** The app writes to localStorage immediately (as today), then syncs to the server in the background when online.

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  User action │     │  localStorage   │     │  Server API  │
│  (quiz etc)  │     │  (immediate)    │     │  (background)│
└──────┬───────┘     └────────┬────────┘     └──────┬───────┘
       │                      │                      │
       │ 1. recordAttempt()   │                      │
       ├─────────────────────▶│                      │
       │ 2. UI updates         │                      │
       │◀─────────────────────┤                      │
       │                      │ 3. Queue event in    │
       │                      │    syncQueue (LS)    │
       │                      │    ┌────────────┐    │
       │                      │    │ syncQueue  │    │
       │                      │    │ [{event}]  │    │
       │                      │    └─────┬──────┘    │
       │                      │          │ 4. If online,│
       │                      │          │    flush    │
       │                      │          ├───────────▶│
       │                      │          │            │ 5. POST /api/progress/sync
       │                      │          │            │ 6. Server returns authoritative meta
       │                      │          │◀───────────┤
       │                      │ 7. Clear synced      │
       │                      │    events from queue │
       │                      │    Update LS meta    │
       │                      │    from server       │
       └──────────────────────┴──────────────────────┘
```

**Implementation changes to `progress-store.ts`:**

1. `recordQuizAttempt`, `recordExamResult`, `recordLadderResult`, `recordFlashcardResult` — unchanged: they write to localStorage as today.
2. **New:** each record function also pushes an event to a `syncQueue` array in localStorage.
3. **New:** a `SyncManager` (background module, not React-bound) flushes `syncQueue` to `POST /api/progress/sync` when:
   - Online status changes to online (`useOnlineStatus` hook already exists)
   - 30 seconds have elapsed since the last queued event (debounced)
   - App regains focus (`visibilitychange` event)
4. **New:** on login (`GET /api/auth/me` returns a user), call `GET /api/progress` to fetch the server snapshot, merge with localStorage (server wins for conflicts — see below).

**Conflict resolution:**
- Each event has a `clientTimestamp`. The server stores events in a log (or appends to the attempts array).
- For `userProgress` meta (totalStars, streak): the server recomputes from the event log (authoritative). The client accepts the server's value after sync.
- For topic attempts/exam results: append-only (no conflicts — both client and server have the same events).
- For flashcard progress: last-write-wins per cardId (the `status` and `knownStreak` are overwritten, not merged).
- For ladder progress: `bestScore` = max(client, server) — the server takes the max.

### 3.5 Migration of existing localStorage data

When a user logs in for the first time:
1. Client checks localStorage for existing `iblearn_progress` data.
2. If present AND server has no progress for this user → upload all localStorage data as a single bulk sync.
3. If present AND server already has progress → merge (server wins for meta; append for attempts; max for ladder/exam best scores).
4. localStorage is NOT cleared — it remains the offline cache.

**Anonymous progress (before login):**
- Before a user logs in, progress is stored in localStorage under the existing key (no change).
- Optionally, assign an anonymous `deviceId` (UUID in localStorage) so progress can be attributed if the user later registers.
- On first login, the anonymous deviceId's progress is migrated to the user's account.

### 3.6 ProgressContext changes

`ProgressContext.tsx` changes minimally:

```typescript
// New: on mount, if authenticated, fetch server progress and merge
useEffect(() => {
  refresh(); // existing: load from localStorage
  if (isAuthenticated) {
    fetch('/api/progress').then(res => res.json()).then(serverData => {
      mergeServerProgress(serverData); // merge into localStorage + state
    });
  }
}, [isAuthenticated]);

// record* functions unchanged — still write to localStorage immediately
// SyncManager handles background server sync
```

The `recordAttempt`, `recordExam`, `recordLadder`, `recordFlashcard` functions stay exactly as they are. The SyncManager is a separate concern that reads the syncQueue and calls the API.

### 3.7 Read/write patterns and cost

| Operation | Frequency | DynamoDB cost |
|-----------|-----------|---------------|
| `GET /api/progress` (full snapshot) | 1x per app load (authenticated) | 1 Query (userId partition) ≈ $0.00025 |
| `POST /api/progress/sync` (batch events) | ~1x per 30s of activity | 1-5 BatchWriteItem ≈ $0.001 |
| Leaderboard score update | 1x per quiz/exam completion | 1 UpdateItem ≈ $0.00025 |

At family-use scale (<1000 DAU): **< $1/month for DynamoDB** (on-demand mode).

---

## 4. Leaderboard Architecture (Feature 3)

### 4.1 Metrics to rank on

| Metric | Source | Appeal |
|--------|--------|-------|
| **Current day streak** | `userProgress.currentStreakDays` | Encourages daily habit |
| **Total stars** | `userProgress.totalStars` | Cumulative achievement |
| **Topics mastered** | Derived from `computeGroupMastery()` across all topics | Deep measure of learning |
| **Weekly XP** | Computed: stars earned this week + quiz completion + flashcard reviews | Fresh weekly competition |

**Recommendation: rank on Weekly XP as the primary leaderboard metric.**
- Daily streak and total stars are shown on the user's own Progress page (not the leaderboard).
- Weekly XP resets every Monday → keeps the leaderboard fresh and gives new users a chance.
- XP formula: `quizCorrect * 10 + flashcardReview * 2 + examScore% * 100 + diagnosticComplete * 50`

### 4.2 Anonymization strategy

- **No real names.** Each child profile gets an auto-generated handle: `{adjective} {animal}` (e.g., "Brilliant Badger", "Clever Cat”). Generated on profile creation, changeable once.
- No email, no avatar photo, no PII on the leaderboard.
- The user sees their own handle highlighted; others appear as handles only.
- Parent accounts are NOT on the leaderboard (only child profiles).

### 4.3 Scope design

```
Leaderboard views:
  ├── Global (all users, all subjects)      — top 100, user's rank
  ├── Per subject (e.g., Math)              — top 100, user's rank
  ├── Per stage (KS3 / IGCSE / DP)          — top 100, user's rank
  └── Per course (e.g., Math — Year 7)      — top 50, user's rank
```

Default view: **per stage** (students compete with peers at their level). Toggle to global/subject/course.

### 4.4 Data model

**DynamoDB table: `octav-leaderboard`**

```
Table: octav-leaderboard
  PK: scope (string)          — e.g. "stage:ks3", "subject:math", "global", "course:math-y7"
  SK: score (number, reversed) — sorted descending so top scores sort first

  Attributes:
    userId        (string)
    profileId     (string)
    displayName   (string, anonymized handle)
    weeklyXP      (number)
    weekKey       (string, e.g. "2026-W33")
    rank          (number, computed at read time or cached)
  TTL: nextMonday (auto-expire last week's entries)
```

Using `score` as the sort key with reverse ordering means DynamoDB `Query` with `ScanIndexForward: false` + `Limit: 100` returns the top 100 in O(1) — no scan needed.

To find the user's own rank: `Query` the partition counting items with score > user's score, or store a `rank` attribute updated by a weekly batch job.

### 4.5 Update strategy

- **On quiz/exam/flashcard completion:** the sync Lambda updates the user's `weeklyXP` in the leaderboard table (atomic `ADD` operation).
- **Top 100:** served directly from the DynamoDB Query (≤5ms).
- **User's rank:** computed as `SELECT COUNT(*) WHERE scope = ? AND score > ?` — in DynamoDB this is a Query with a filter; for top-1000 users this is fine. For larger scale, maintain a rank attribute via a weekly DynamoDB Streams → Lambda job.
- **Weekly reset:** a scheduled EventBridge rule (cron: every Monday 00:00 UTC) creates new week entries. Old entries expire via TTL.

### 4.6 Privacy for minors

| Concern | Mitigation |
|---------|-----------|
| COPPA (US, <13) | Leaderboard is optional — parent must opt in per child profile. No PII collected (handles are auto-generated). |
| GDPR-K (EU, <16) | Same opt-in. Parental consent at registration. Right to erasure: delete user + all progress + leaderboard entries. |
| Cyberbullying | No direct messaging between users. No profile pages. Only handle + score visible. |
| Demotivation | Show "your rank" and "top 3" + "2 above you, 2 below you" instead of a raw top-100 list — reduces the demoralizing effect of being #87. |

### 4.7 Display design

- New nav item or tab on the Progress page: "Leaderboard".
- Shows: user's rank, user's handle, weekly XP, and a contextual list (top 3 + neighbors).
- Scope toggle (Global / Stage / Subject / Course).
- Time window toggle (This week / All-time).
- Empty state if user hasn't opted in: "Join the leaderboard to see how you compare — anonymous, just for fun."

---

## 5. Analytics Architecture (Feature 4)

### 5.1 Build vs buy analysis

| Solution | Type | Privacy | Cost (small scale) | Self-host | Integration effort |
|----------|------|---------|---------------------|-----------|-------------------|
| **PostHog** | Open-source product analytics | Self-hostable; cookieless option | Free self-hosted; ~$0 SaaS (free tier 1M events/mo) | ✅ Docker/K8s | Medium (JS SDK + event pipeline) |
| **Plausible** | Lightweight privacy-first analytics | Cookieless, GDPR-compliant, no PII | $9/mo SaaS or self-host (single binary) | ✅ Elixir/Elixir | Low (one script tag) |
| **Umami** | Open-source web analytics | Cookieless, anonymous | Free self-hosted; $9/mo cloud | ✅ Node.js/Docker | Low (one script tag) |
| **Custom (CloudFront logs + Lambda + DynamoDB/QA)** | Fully custom | Fully controllable | ~$1-5/mo (CloudFront logs + processing) | N/A | High (build event schema, pipeline, dashboard) |
| **Google Analytics 4** | SaaS | Cookies, privacy concerns | Free | ❌ | Low but privacy risk |

### 5.2 Recommendation: Umami (self-hosted on AWS)

**Why Umami?**
1. **Privacy-first:** cookieless, anonymous, GDPR/COPPA-friendly out of the box. No PII collected. Perfect for an education platform with minors.
2. **Self-hosted:** runs as a single Node.js app — deploy as a Lambda + DynamoDB (or RDS PostgreSQL) behind CloudFront, same pattern as the feedback Lambda.
3. **Low cost:** at family-use scale, DynamoDB on-demand + Lambda = ~$1-3/mo.
4. **Simple integration:** one `<script>` tag or a small React hook. Events are sent via `navigator.sendBeacon` (doesn't block page load).
5. **Dashboard included:** Umami has a built-in dashboard (page views, referrers, devices, event tracking). No need to build a custom dashboard.
6. **No vendor lock-in:** open-source (MIT). Can migrate to PostHog later if more advanced features (funnels, session replay) are needed.

**Why not PostHog?**
- More powerful (funnels, session replay, feature flags) but heavier to self-host (requires ClickHouse, Kafka, PostgreSQL — significant infra).
- Overkill for the current need (user journey + behavior analysis).
- Can migrate to PostHog later if analytics needs grow.

**Why not Plausible?**
- Excellent for page-view analytics but limited custom event tracking (you can send custom events but the dashboard is page-view-centric).
- Umami has better custom event support, which is needed for tracking quiz starts, flashcard sessions, etc.

### 5.3 Events to track

```yaml
# Page views (automatic)
page_view:
  url: "<current path>"
  referrer: "<document.referrer>"

# User journey events (custom)
quiz_started:
  subjectId, topicId, source: "topic_page" | "diagnostic" | "mixed_review" | "ladder"

quiz_completed:
  subjectId, topicId, correctCount, totalCount, durationSeconds

flashcard_session_started:
  subjectId, topicId, filter: "all" | "learning" | "due"

flashcard_session_completed:
  subjectId, topicId, cardsReviewed, knownCount, learningCount

diagnostic_started:
  courseId

diagnostic_completed:
  courseId, topicCount, weakAreaCount

exam_started:
  courseId, paperId

exam_completed:
  courseId, paperId, correctCount, totalCount, secondsUsed, timedOut: boolean

paper_marked_with_ai:
  courseId, paperId, questionCount, totalMarks

# Engagement events
cta_clicked:
  ctaId: "hero_diagnostic" | "hero_browse" | "diagnostic_card" | ...

search_performed:
  query, resultCount  (subject page filter)

# Auth events
auth_otp_requested: { emailDomain }
auth_login_completed: { role: "parent" | "student" }
auth_logout: {}

# PWA events
pwa_installed: {}
pwa_offline_banner_shown: {}
```

### 5.4 Privacy compliance

| Requirement | Implementation |
|-------------|---------------|
| **No cookies** | Umami is cookieless — uses a fingerprint hash that rotates. No cookie banner needed. |
| **No PII** | Analytics events contain only anonymous IDs (session ID, not email). Auth events use `emailDomain` not full email. |
| **COPPA** | No tracking of children under 13 without parental consent. Since parents register and create child profiles, analytics are enabled only after registration. Anonymous (pre-login) tracking is page-view only (no custom events with PII). |
| **GDPR** | No cookies → no consent banner required under ePrivacy Directive. Data is stored in ap-east-1 (user can request deletion). |
| **Data retention** | Umami retains data for a configurable period (default: unlimited; recommend 12 months). |

### 5.5 Session attribution

```
Anonymous user (pre-login):
  Umami assigns an anonymous session ID (cookieless fingerprint)
  Page views + CTA clicks tracked

User logs in:
  Auth Lambda sends an `identify` event to Umami with { userId, role }
  Umami links the anonymous session to the userId
  Future events are attributed to the userId

Result: full user journey from first visit → registration → learning activity,
  with anonymous-to-known attribution.
```

### 5.6 Infrastructure

**Self-hosted Umami on AWS:**

```
CloudFront /api/analytics/*  →  Lambda Function URL (Umami tracker API)
                                  ├── DynamoDB: octav-analytics-events
                                  │   (or PostgreSQL Aurora Serverless for richer queries)
                                  └── Lambda: octav-analytics (Umami Node.js app)

Umami dashboard:
  Served from the same Lambda at /api/analytics/dashboard (protected by basic auth or Umami's built-in auth)
  Or: deploy Umami separately on a small EC2 / App Runner instance with an RDS PostgreSQL
```

**Simpler alternative:** Use Umami Cloud ($9/mo) initially — no infra to manage, migrate to self-hosted when event volume justifies it.

**Client integration:**
```typescript
// src/lib/analytics.ts
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  navigator.sendBeacon('/api/analytics/event', JSON.stringify({ name, props, url: location.href, referrer: document.referrer }));
}

// Usage in components:
trackEvent('quiz_started', { subjectId: 'math', topicId: 'math-yr7-algebra-1', source: 'topic_page' });
```

---

## 6. Infrastructure Changes

### 6.1 New AWS resources

| Resource | Type | Purpose | Est. monthly cost |
|----------|------|---------|-------------------|
| `octav-users` | DynamoDB table (on-demand) | User accounts | $0.00 (free tier) |
| `octav-sessions` | DynamoDB table (on-demand) | Session management | $0.00 |
| `octav-otp-codes` | DynamoDB table (on-demand) | OTP storage (TTL 10m) | $0.00 |
| `octav-progress` | DynamoDB table (on-demand) | Progress persistence | $0.00-0.50 |
| `octav-leaderboard` | DynamoDB table (on-demand) | Leaderboard scores | $0.00 |
| `octav-analytics-events` | DynamoDB table (on-demand) | Analytics events (if self-hosted Umami) | $0.00-1.00 |
| Auth Lambda | Lambda Function URL | `/api/auth/*` endpoints | $0.00 (free tier) |
| Progress Lambda | Lambda Function URL | `/api/progress/*` endpoints | $0.00 |
| Leaderboard Lambda | Lambda Function URL | `/api/leaderboard/*` endpoints | $0.00 |
| Analytics Lambda | Lambda Function URL | `/api/analytics/*` endpoints | $0.00 |
| SES (email) | Simple Email Service | OTP email delivery | $0.10 per 1000 emails |
| EventBridge rule | Scheduled rule | Weekly leaderboard reset | $0.00 (free tier) |

**Total estimated additional cost at family-use scale: $1-3/month**

### 6.2 Terraform module structure

```
terraform/
├── bootstrap/           (existing — state bucket + lock table)
├── modules/
│   ├── site/            (existing — S3 + CloudFront)
│   ├── feedback_api/    (existing — Lambda + Function URL)
│   ├── ci/              (existing — GitHub OIDC + deploy role)
│   ├── dynamodb/        (NEW — all DynamoDB tables)
│   ├── auth_api/        (NEW — Auth Lambda + Function URL + SES)
│   ├── progress_api/    (NEW — Progress Lambda + Function URL)
│   ├── leaderboard_api/ (NEW — Leaderboard Lambda + Function URL + EventBridge)
│   └── analytics_api/   (NEW — Analytics Lambda + Function URL, or Umami cloud config)
├── envs/
│   ├── prod/            (existing — composes all modules)
│   └── dev/             (NEW or shared — compose for DEV environment)
```

Each new API module follows the `feedback_api` pattern: Lambda + Function URL + IAM role + CloudWatch logs. The `site` module's CloudFront distribution gains new `/api/auth/*`, `/api/progress/*`, `/api/leaderboard/*`, `/api/analytics/*` behaviors pointing to the respective Function URLs.

### 6.3 CloudFront behavior additions

```
Existing behaviors:
  /api/feedback/*  → feedback Lambda Function URL
  /*               → S3 origin

New behaviors:
  /api/auth/*          → auth Lambda Function URL
  /api/progress/*      → progress Lambda Function URL
  /api/leaderboard/*   → leaderboard Lambda Function URL
  /api/analytics/*     → analytics Lambda Function URL
```

All behaviors forward `Cookie`, `Authorization`, and `X-Forwarded-For` headers (the feedback behavior already forwards the latter). CORS origins match the existing `site_origins` variable (dev + apex + www).

### 6.4 CI/CD changes

New GitHub secrets/variables needed:

```
Secrets:
  SES_FROM_ADDRESS         — e.g. "noreply@octavlearning.com"
  JWT_SIGNING_KEY          — (if using JWT for inter-Lambda auth; not needed if using cookies only)
  UMAMI_SITE_ID            — (if using Umami cloud)

Variables:
  DYNAMODB_TABLE_PREFIX    — e.g. "octav" (or "iblearn" to match existing naming)
```

The CI deploy job (`ci.yml`) gains:
1. New `build:lambda` targets for each new Lambda (or a single `build:all-lambdas` script)
2. Terraform apply now provisions DynamoDB tables + new Lambdas + SES + EventBridge
3. Smoke checks after deploy: `GET /api/auth/me` returns 401 (unauthenticated), `GET /api/leaderboard` returns 200

### 6.5 SES setup

1. Verify the sending domain (`octavlearning.com`) in SES — add DKIM CNAME records in CloudFlare.
2. Verify the from-address (`noreply@octavlearning.com` or `login@octavlearning.com`).
3. Request production access for SES in **ap-southeast-1** (default is sandbox — can only send to verified addresses). Note: the first request was denied 2026-08-15 (case 178672296800802) — re-apply with a concrete use-case description; sandbox sends to verified addresses work meanwhile.
4. OTP email template: branded HTML, 6-digit code, "expires in 10 minutes", Octav Learning logo.

---

## 7. Migration Plan (Phased)

### Implementation order

```
Phase A: Analytics (Feature 4)     ← no dependencies, immediate value
    ↓
Phase B: Auth (Feature 1)          ← foundational for B and C
    ↓
Phase C: Progress sync (Feature 2) ← depends on auth
    ↓
Phase D: Leaderboard (Feature 3)   ← depends on auth + progress
```

**Why this order?**
- Analytics has no dependencies and provides immediate value (understand how users use the current site before redesigning).
- Auth is foundational — progress sync and leaderboard both need to know who the user is.
- Progress sync depends on auth (need a userId to store progress against).
- Leaderboard depends on both auth (userId) and progress (XP/score computation).

### Phase A — Analytics (1-2 weeks)

| Step | What | Risk | Verify |
|------|------|------|-------|
| A1 | Choose Umami cloud vs self-hosted | Low (reversible) | Cost comparison |
| A2 | Add `src/lib/analytics.ts` with `trackEvent()` | None | Unit test event shapes |
| A3 | Add event tracking to key user flows (quiz, flashcard, exam, diagnostic, CTA clicks) | Low | Umami dashboard shows events |
| A4 | If self-hosted: deploy Umami Lambda + DynamoDB + CloudFront behavior | Medium (infra) | Dashboard loads, events appear |
| A5 | Add analytics smoke check to CI deploy | None | Post-deploy smoke passes |

**Doesn't break anything:** the static export, PWA, and offline UX are unchanged. Analytics events are fire-and-forget (sendBeacon doesn't block).

### Phase B — Auth (2-3 weeks)

| Step | What | Risk | Verify |
|------|------|------|-------|
| B1 ✅ | Terraform: DynamoDB tables (users, sessions, otp-codes + progress, Phase 0) + SES + Auth Lambda (`terraform/modules/{dynamodb,ses,auth_api}`) | Medium (infra) | CI apply landed — tables/identity live |
| B2 ✅ | Auth Lambda: request-otp, verify-otp, logout, me + account mgmt (export/delete/sessions) — shared handler `src/lib/auth/http-handler.ts`, 4 rounds of review hardening | Medium (security) | 515+ auth unit tests, auth e2e 9/9 |
| B3 ⚠️ | SES domain verified (DKIM SUCCESS, MAIL FROM SUCCESS, ap-southeast-1) — **production access DENIED 2026-08-15 (case 178672296800802), re-apply needed; pre-launch blocker** | Low (operational) | Sandbox sends to verified addresses work |
| B4 ✅ | Client: `AuthContext`, `/login` page (email-OTP), `AccountButton` in header | Low | auth e2e: request OTP → verify → logged-in state |
| B5 ✅ | Client: profile picker for parent → child profiles (`/account` page) | Low | account e2e incl. profile switching |
| B6 ✅ | CI: `AUTH_ENV` secret + `build-lambdas` (3 zips) + `/api/auth/request-otp` smoke (200/429/502) | Low | deploys green on develop |

**Key risk:** breaking the existing anonymous (localStorage-only) flow. Mitigation: auth is additive — if not logged in, everything works as today.

### Phase C — Progress sync (2-3 weeks)

| Step | What | Risk | Verify |
|------|------|------|-------|
| C1 ✅ | Terraform: `octav-progress` table (Phase 0, pre-existing) + Progress Lambda (`terraform/modules/progress_api`, modeled on auth_api incl. index-ARN IAM + triggers_replace provisioner; `/api/progress/*` CloudFront behavior in both site modules) | Medium (infra) | fmt/validate/plan clean (11 add / 7 change / 2 destroy), no apply |
| C2 ✅ | Progress Lambda: GET /api/progress, POST /api/progress/sync, GET /api/progress/_health (shared handler `src/lib/progress/http-handler.ts`; session identity via shared `resolveSession`; per-profile SKs; atomic conditional writes; zod budgets) | Medium (data correctness) | 74 progress unit tests incl. IDOR, idempotent replay, parity dummy↔DynamoDB |
| C3 ✅ | Client: SyncManager background queue (`src/lib/sync-manager.ts`) — localStorage primary, 30s debounce, online/visibility flush, backoff, silent failures; SW already bypasses /api | Medium (offline UX) | e2e offline→online + sync-manager unit tests |
| C4 ✅ | Client: ProgressContext fetches/merges server data on login (`src/lib/progress-merge.ts` — union by attemptId, ladder max, flashcard LWW, META per-field max) | Medium (merge conflicts) | e2e cross-device merge + progress-merge unit tests |
| C5 ✅ | Migration: first-login bulk upload of anonymous `iblearn_progress`, server-side `migrationCompletedAt` META marker (exactly-once), idempotent replays | Low | e2e first-login migration (no duplicates) + marker unit test |
| C6 ✅ | CI: `/api/progress/_health` smoke in both deploy jobs (unauthenticated DynamoDB probe — 200 only) | Low | plan/validate; smoke asserts the real IAM failure class |

**Key risk:** offline UX regression. Mitigation: localStorage remains the primary store; server sync is background-only. If sync fails, the app works exactly as today.

### Phase D — Leaderboard (1-2 weeks)

| Step | What | Risk | Verify |
|------|------|------|-------|
| D1 | Terraform: create `octav-leaderboard` table + Leaderboard Lambda + EventBridge weekly rule | Medium (infra) | Table + rule created |
| D2 | Implement Leaderboard Lambda: GET top-100, GET my-rank, POST update-score | Medium (data model) | Unit tests for ranking, weekly reset |
| D3 | Integration: progress sync Lambda updates leaderboard on quiz/exam completion | Low | Score updates after quiz |
| D4 | Client: Leaderboard UI (Progress page tab or new page) | Low | E2E: can view leaderboard, see rank |
| D5 | Opt-in flow: parent enables leaderboard per child profile | Low (privacy) | E2E: opt-in → appears on leaderboard |
| D6 | CI: smoke checks for leaderboard API | Low | Post-deploy smoke passes |

**Key risk:** privacy (minors on a public leaderboard). Mitigation: opt-in only, anonymized handles, no PII.

### Keeping the static-export PWA working during migration

All 4 phases are additive — none require changing `output: 'export'`:
- New APIs are Lambdas behind CloudFront `/api/*` (same as feedback)
- Client-side changes are new React contexts/hook/components — they run after hydration
- The offline PWA continues to work: localStorage is always the primary store; server sync is background
- The service worker (`public/sw.js`) may need `CACHE_VERSION` bumped if new API paths should be cached or if the app shell changes

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **Static export blocks needed server features** (e.g., middleware for auth redirects) | Medium | High | Stay on Option A (Lambdas); if middleware becomes necessary, migrate to Option B (hybrid) as a separate project. Auth cookies work without middleware. |
| R2 | **Offline UX regression** (progress sync breaks offline studying) | Medium | High | localStorage remains primary; sync is background-only; SyncManager retries on reconnect. Extensive offline E2E testing. |
| R3 | **Cost overrun** (DynamoDB + Lambda + SES costs exceed budget) | Low | Medium | All services on free tier / on-demand billing. Set billing alarms. At family-use scale, < $5/mo total. |
| R4 | **Privacy compliance** (COPPA/GDPR-K violations with minors' data) | Medium | High | Leaderboard is opt-in only. No PII in analytics. Parental consent at registration. Right-to-erasure implemented (delete user + all data). |
| R5 | **SES deliverability** (OTP emails go to spam) | Medium | High | Verify domain (DKIM + SPF in CloudFlare). Use a branded from-address. Monitor bounce/complaint rates. Fallback: show OTP on-screen in dev mode. |
| R6 | **OTP abuse** (mass OTP requests drain SES quota or harass email owners) | Medium | Medium | Rate limiting (3 per 10 min per email+IP). SES sandbox initially (verified recipients only). Monitor sending volume. |
| R7 | **Session security** (cookie theft, session fixation) | Low | High | HTTP-only + Secure + SameSite=Lax cookie. Opaque session ID (not JWT). Server-side revocation. Rotate session ID on login. |
| R8 | **Data loss during migration** (localStorage → server sync loses data) | Low | High | localStorage is never cleared during migration. Server data is additive. First-login bulk upload. Extensive merge tests. |
| R9 | **Vendor lock-in** (Umami cloud or analytics SaaS) | Low | Low | Umami is open-source (MIT). Can self-host or migrate to PostHog. Analytics data is event logs (portable). |
| R10 | **Local terraform apply wipes new resources** (the existing FEEDBACK_ENV issue extends to new secrets) | Medium | High | All new secrets go to GitHub secrets, not local. Local terraform `plan`/`validate`/`fmt` only (existing policy). CI-only applies. |
| R11 | **CloudFront behavior limit** (too many /api/* behaviors) | Very Low | Medium | CloudFront allows up to 25 cache behaviors per distribution. Current: 2 (default + /api/feedback). Adding 4 more = 6 total. Well within limit. |
| R12 | **Leaderboard gaming** (users cheat for high scores) | Low | Low | Scores derived from server-side event log (not client-reported). Quiz/exam scoring is server-validated. Rate limit quiz completions. |

---

## 9. Open Questions for the Founder

### Q1: Single-user or parent→child model?
Is the primary use case a parent who manages multiple children's profiles, or individual students signing up directly? This affects:
- The account model (parent with child profiles vs. flat user accounts)
- Whether leaderboard entries are per-child or per-account
- Whether progress data needs a profile-switcher in the UI

**Recommendation:** Start with parent→child (the stated requirement), but design the data model so a "student" is just a parent with one child profile (themselves).

**Resolved 2026-08-14:** parent→child, per the recommendation.

### Q2: Should analytics be self-hosted or SaaS?
Self-hosted Umami (Lambda + DynamoDB) keeps all data in your AWS account and costs ~$0-3/mo. Umami Cloud ($9/mo) is zero-management but data lives on their servers.

**Recommendation:** Start with Umami Cloud for speed (1-day setup), migrate to self-hosted when you want full data ownership or when event volume exceeds the free tier.

### Q3: Should the leaderboard be real-time or daily-batched?
Real-time (DynamoDB atomic updates on every quiz completion) gives instant gratification but more write load. Daily-batched (compute scores once per day) is cheaper but less exciting.

**Recommendation:** Real-time — DynamoDB handles it easily at this scale, and instant feedback is better for engagement.

### Q4: What is the target user base and growth trajectory?
This affects cost projections and whether DynamoDB on-demand is sufficient or provisioned capacity is needed. At <10,000 MAU, on-demand is always cheaper. Above that, provisioned capacity may save costs.

### Q5: Do you need multi-region or is ap-east-1 sufficient?
All current users are presumably in Asia (ap-east-1 / Hong Kong). If expanding to Europe/US, CloudFront edges handle CDN, but Lambda + DynamoDB latency may increase. This is a future concern, not a blocker.

### Q6: Should anonymous (pre-login) users be tracked in analytics?
Tracking anonymous page views helps understand the conversion funnel (landing page → sign-up). But if minors are browsing without parental consent, tracking may raise COPPA concerns.

**Recommendation:** Track anonymous page views (no PII, cookieless) but NOT custom events (quiz scores etc.) for unauthenticated users. Custom events fire only after login.

### Q7: Email delivery — use SES directly or a transactional email service (Resend, Postmark)?
SES is cheapest ($0.10/1000 emails) but requires domain verification and deliverability management. Resend/Postmark are easier to set up and have better deliverability but cost more ($1-20/mo depending on volume).

**Recommendation:** SES — you already have the AWS infra, and OTP volume will be low. Add SPF/DKIM/DMARC records in CloudFlare for deliverability.

### Q8: Should progress data be exportable (data portability / right-to-erasure)?
GDPR requires the ability to export and delete user data. This means:
- `GET /api/progress/export` → JSON download of all user data
- `DELETE /api/account` → delete user + all progress + leaderboard entries + analytics data

**Recommendation:** Yes, implement both from the start — it's easier than retrofitting.

---

## Appendix A: New file structure (client-side)

```
src/
├── context/
│   ├── ProgressContext.tsx      (modified — fetch/merge server data)
│   ├── AuthContext.tsx          (NEW — login state, profile picker)
│   └── AnalyticsContext.tsx     (NEW — or just a lib, not a context)
├── lib/
│   ├── progress-store.ts        (modified — add syncQueue)
│   ├── sync-manager.ts          (NEW — background sync to /api/progress)
│   ├── auth-client.ts           (NEW — request-otp, verify-otp, logout, me)
│   ├── analytics.ts             (NEW — trackEvent wrapper)
│   └── leaderboard-client.ts    (NEW — fetch leaderboard data)
└── app/
    ├── api/                     (dev/e2e only — stashed in static build)
    │   ├── auth/
    │   │   ├── request-otp/route.ts
    │   │   ├── verify-otp/route.ts
    │   │   ├── logout/route.ts
    │   │   └── me/route.ts
    │   ├── progress/
    │   │   └── route.ts
    │   └── leaderboard/
    │       └── route.ts
    ├── (auth)/                  (NEW route group — login page)
    │   └── login/page.tsx
    └── leaderboard/             (NEW — leaderboard page or tab)
        └── page.tsx
```

## Appendix B: New Lambda structure

```
lambda/
├── feedback/              (existing)
│   ├── index.ts
│   └── dist/              (gitignored)
├── auth/                  (NEW)
│   ├── index.ts           (adapter — same pattern as feedback/index.ts)
│   └── dist/
├── progress/              (NEW)
│   ├── index.ts
│   └── dist/
├── leaderboard/           (NEW)
│   ├── index.ts
│   └── dist/
└── analytics/             (NEW — only if self-hosting Umami)
    ├── index.ts
    └── dist/

src/lib/
├── feedback/
│   └── http-handler.ts    (existing — shared handler pattern)
├── auth/
│   └── http-handler.ts    (NEW — shared auth handler, same pattern)
├── progress/
│   └── http-handler.ts    (NEW — shared progress handler)
├── leaderboard/
│   └── http-handler.ts    (NEW — shared leaderboard handler)
└── analytics/
    └── http-handler.ts    (NEW — shared analytics handler)
```

Each `http-handler.ts` is the single source of truth, imported by both the Next route (dev/e2e) and the Lambda adapter (prod) — exactly the pattern established by `src/lib/feedback/http-handler.ts`.

## Appendix C: Shared handler pattern (for new APIs)

The established pattern (`AGENTS.md` — Feedback handler contract) should be replicated for all new APIs:

```
src/lib/<domain>/http-handler.ts    ← single source of truth (validation, logic, response)
src/app/api/<domain>/route.ts       ← dev/e2e: thin Next route handler, delegates to http-handler
lambda/<domain>/index.ts            ← prod: Lambda adapter, delegates to http-handler
```

Benefits:
- Dev/e2e tests hit the real Next route (no Lambda emulation needed)
- Production uses the Lambda (behind CloudFront /api/*)
- Same validation and logic in both environments
- No logic duplication

The `build:lambda` script (`package.json`) should be extended to build all Lambda bundles, not just feedback.
