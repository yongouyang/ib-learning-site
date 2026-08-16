# Phase A — Analytics: custom Lambda + DynamoDB (self-hosted, AWS)

> **Status:** Approved direction (2026-08-16). Implementation delegated per-phase (A0, A1, …) via prompts — see "Implementation prompts" at the bottom.
> Companion to `architecture-evolution-plan.md` §5 (Analytics Architecture) — this document **supersedes §5.2/§5.6's Umami framing** (Umami requires PostgreSQL/MySQL; it cannot run on Lambda + DynamoDB).

## Locked decisions (2026-08-16)

1. **Custom build** — small analytics collect API + DynamoDB on the existing Lambda Function URL pattern. NOT Umami (requires PostgreSQL/MySQL; the earlier "Umami Lambda + DynamoDB" framing was wrong).
2. **Full §5.3 event taxonomy** (~17 event types: page views, quiz, flashcard, diagnostic, exam, AI-marking, CTA, search, auth, PWA).
3. **Anonymous only** — no userId attribution, no identify-on-login, no persistent visitor id, no fingerprint. Session id is a per-tab `sessionStorage` UUID. Honor `navigator.doNotTrack`.
4. **In-app admin page** — `/admin/analytics`, session-gated to an admin email allowlist.

## Architecture (mirrors the progress stack exactly)

```
Browser: src/lib/analytics.ts (trackEvent/trackPageView, sendBeacon, fire-and-forget)
    │ POST /api/analytics/event (never cached, offline = drop)
    ▼
CloudFront /api/analytics/* behavior (before /api/*) ──► Lambda: octav-analytics
    │                                                        │ shared handler: src/lib/analytics/http-handler.ts
    │                                                        │ (dev/e2e: Next routes src/app/api/analytics/*)
    ▼                                                        ▼
DynamoDB octav-analytics-events (raw events + daily aggregate counters)
DynamoDB octav-rate-limits (per-IP ingest budget, reused fixed-window pattern)
    ▲
GET /api/analytics/summary?days=30 (session-gated, admin email allowlist)
    └── /admin/analytics page (static export, client-side fetch after auth)
```

Every piece copies an existing, tested pattern: `src/lib/progress/*` module shape, `lambda/progress/index.ts` thin adapter, `terraform/modules/progress_api`, the site module's `/api/progress/*` behavior, the ci.yml `_health` smoke.

## Data model — `octav-analytics-events` (on-demand, TTL on `expiresAt`)

Single table, two item kinds (PK `k`, SK `s`):

- **Raw event** — `k = "ev"`, `s = "<date>#<ts>#<uuid>"`, attrs: `name`, `props` (map), `host`, `sessionId`, `ua` (truncated 80 chars), `expiresAt = now + 90d`.
- **Daily aggregate** — `k = "agg"`, `s = "<date>#<kind>#<key>"` where kind ∈ `event` (key = event name), `page` (key = path), `referrer` (key = host-only referrer, `"direct"` when empty), `host` (key = hostname — separates dev vs prod traffic). Atomic `ADD #c :one` upsert, `expiresAt = now + 400d` (12-month reporting + margin).

One ingest write = 1 Put (raw) + 1 Update (aggregate ADD) per event. Dashboard reads only aggregates: one `Query` on `k="agg"`, `s BETWEEN <oldest-date> AND <today>` — bounded, cheap, no scans.

## Event schema (`src/lib/analytics/types.ts`, zod)

- `name`: enum of the §5.3 taxonomy (`page_view`, `quiz_started`, `quiz_completed`, `flashcard_session_started`, `flashcard_session_completed`, `diagnostic_started`, `diagnostic_completed`, `exam_started`, `exam_completed`, `paper_marked_with_ai`, `cta_clicked`, `search_performed`, `auth_otp_requested`, `auth_login_completed`, `auth_logout`, `pwa_installed`, `pwa_offline_banner_shown`).
- `props`: per-name zod schemas mirroring §5.3 fields (bounded: strings ≤ 120 chars, numbers sane-capped, no free-form PII-shaped fields; `auth_otp_requested` carries `emailDomain` only, never the address).
- Envelope: `{ name, props, url, referrer, sessionId, clientTs }` — `clientTs` gets the same now+24h guard as progress; `url` is reduced to path-only server-side.

## API surface (shared handler `src/lib/analytics/http-handler.ts`)

- `POST /api/analytics/event` — public, unauthenticated. Guards: zod envelope validation (400 on invalid), body ≤ 4 KB, per-IP fixed-window budget in `octav-rate-limits` (bucket `analytics:<ip>:<epoch>`, 120 events/10 min, 429 on exceed). Always fast — no session lookup.
- `GET /api/analytics/summary?days=7|30|90` — session required via shared `resolveSession` (`src/lib/auth/session.ts`); admin iff session email ∈ `ANALYTICS_ADMIN_EMAILS` (comma-separated env). 403 otherwise. Returns: daily series per event name, top pages, top referrers, totals, dev/prod split.
- `GET /api/analytics/_health` — unauthenticated Limit-1 Query probe (CI smoke, mirrors progress `_health`).

## Implementation phases

### A0 — Docs reconciliation (small)

- `docs/architecture-evolution-plan.md`: correct §5.2/§5.6 (Umami → custom Lambda + DynamoDB; record decision + date + rationale: Umami needs Postgres), update the Phase A checklist intro to point at this document.
- `docs/future-tech-stack-evolution.md`: Step 3 row updated to the custom design.

### A1 — Shared analytics module (the core, ~1 day)

- New `src/lib/analytics/`: `types.ts` (schemas above), `dummy.ts` (`InMemoryAnalyticsStorage` — mirrors aggregate ADD semantics; shared-universe pattern like progress deps), `dynamodb-storage.ts` (raw Put + aggregate Update, TTL attrs, summary Query), `http-handler.ts` (3 endpoints above), `deps.ts` (`ANALYTICS_STORAGE=dummy|dynamodb`, same fail-closed-in-Lambda guard, dummy default).

### A2 — Routes + Lambda entry (small)

- Next routes: `src/app/api/analytics/event/route.ts`, `summary/route.ts`, `_health/route.ts` — thin delegates (dev/e2e path).
- `lambda/analytics/index.ts` — thin adapter with ROUTES map, mirrors `lambda/progress/index.ts` exactly (shared `lambda/shared/lambda-adapter.ts`).
- `scripts/build-lambdas.sh`: add `build_one "analytics" "lambda/analytics/index.ts"` (4th zip).
- `scripts/serve-static.ts`: add the three analytics routes to the delegation maps.

### A3 — Client library + page views (~0.5 day)

- `src/lib/analytics.ts`: `trackEvent(name, props)`, `trackPageView()`; `sendBeacon` with `fetch` keepalive fallback; silent catch; no-op when `navigator.doNotTrack === '1'`; session id from `sessionStorage` (`crypto.randomUUID()`, created lazily); reads nothing from localStorage progress.
- `src/components/AnalyticsTracker.tsx` (client): mounted in `src/app/layout.tsx`; fires `page_view` on mount + on `usePathname()` change; skips `/admin` paths.

### A4 — Instrument the taxonomy (~1 day)

- `quiz_started`/`quiz_completed` — quiz runner component (source prop: topic_page|diagnostic|mixed_review|ladder).
- `flashcard_session_started`/`flashcard_session_completed` — flashcards page.
- `diagnostic_started`/`diagnostic_completed` — diagnostics flow.
- `exam_started`/`exam_completed` — exams/paper runner (incl. `timedOut`).
- `paper_marked_with_ai` — AI marking call site.
- `cta_clicked` — Hero CTAs, dashboard cards, exams↔diagnostics cross-links (ctaId per site).
- `search_performed` — subject page filter.
- `auth_otp_requested` (emailDomain only), `auth_login_completed` (role), `auth_logout` — login page + AccountButton.
- `pwa_installed` (`appinstalled` listener), `pwa_offline_banner_shown` — SW registration/offline UI call sites.

### A5 — Admin dashboard (~1 day)

- `src/app/admin/analytics/page.tsx` — static-export client page; waits for `authLoaded`, fetches `/api/analytics/summary?days=N` (N toggle 7/30/90); renders: daily active-series table + CSS bar charts (no chart lib — Tailwind divs, no new deps), top pages, top referrers, event totals, dev/prod split. 403 → friendly "not authorized" state; logged-out → sign-in prompt.
- Not added to Nav (direct URL only).

### A6 — Terraform (mirrors progress_api)

- `terraform/modules/dynamodb`: add `octav-analytics-events` (PK `k`, SK `s`, TTL `expiresAt`, on-demand) + outputs.
- `terraform/modules/analytics_api` (new, copy of progress_api): Lambda + Function URL + IAM (least-privilege on analytics table + `octav-rate-limits` for the ingest budget + users/sessions Get for summary session validation) + logs + the `triggers_replace` provisioner convention. `reserved_concurrent_executions` variable defaulting null (quota still 10 — same note as auth/progress).
- `terraform/modules/site`: `analytics_origin_domain` variable + origin + `/api/analytics/*` ordered behavior **before** `/api/*` (copy the progress block); both site + site_prod instances in `terraform/envs/prod/main.tf`.
- `terraform/envs/prod/main.tf`: `module "analytics_api"` wiring, `analytics_env` TF_VAR (optional secret, empty = base wiring), `analytics_admin_emails` variable (CI repo variable `ANALYTICS_ADMIN_EMAILS`).
- `.github/workflows/ci.yml`: `TF_VAR_analytics_env` + `TF_VAR_analytics_admin_emails` in both deploy jobs; smoke: `GET /api/analytics/_health` must 200.

### A7 — Tests

- Unit (`tests/unit/`): `analytics-types.test.ts` (schema edges), `analytics-dummy.test.ts`, `analytics-dynamodb-storage.test.ts` (mock-client command shapes, TTL attrs, aggregate ADD), `analytics-parity.test.ts` (dummy vs independent simulated DDB — same aggregate outcomes; reuse the parity-harness pattern from `tests/unit/progress-parity.test.ts`), `analytics-http-handler.test.ts` (ingest validation, rate-limit 429, summary 401/403/200, days param), `analytics-client.test.ts` (sendBeacon mock, DNT no-op, session id lifecycle), summary aggregation math.
- e2e (`tests/e2e/analytics.spec.ts`): playwright webServer env gains `ANALYTICS_STORAGE: 'dummy'`, `ANALYTICS_TEST_MODE: '1'`, `ANALYTICS_ADMIN_EMAILS: 'admin@example.com'` — (a) quiz flow fires `quiz_started`/`quiz_completed` (intercept `/api/analytics/event`, assert payload names); (b) `page_view` fires on navigation; (c) admin page: dummy-OTP login as `admin@example.com` → dashboard renders; login as other user → "not authorized"; logged-out → sign-in prompt.
- Playwright config env also pins `PROGRESS_STORAGE: 'dummy'` (hermeticity gap found in the e2e review — one line, same edit).

### A8 — Finish: gates + docs

- `npm run build:lambda` (4 zips), `npm test`, lint, build, `npm run test:e2e` (Desktop Chrome at minimum), terraform `fmt`/`validate` (no local apply — CI-only).
- AGENTS.md: analytics Lambda/module/behavior bullet; dummy-dependency note; smoke mention.
- architecture-evolution-plan.md: Phase A rows checked off with verification evidence.
- PROGRESS.md session entry.

## Notes & accepted trade-offs

- **Quota:** a 4th Lambda shares the region's 10 concurrent executions (increase to 1000 pending) — analytics traffic is trivial; ingest is one of the cheapest handlers.
- **Dev+prod share one Lambda** (same as feedback/auth/progress today) — events carry `host` so the dashboard can split dev vs prod traffic; no separate infra.
- **Offline:** analytics events drop when offline (fire-and-forget, no queue) — accepted; queuing analytics in the sync manager would conflate anonymous telemetry with user data.
- **IP handling:** used only for the rate-limit bucket key (ephemeral, TTL'd in `octav-rate-limits`); never stored on events.
- **Bot traffic:** recorded as-is in v1 (UA stored truncated); add UA filtering later only if the dashboard shows noise.
- **SW:** `public/sw.js` already bypasses `/api` — verified by the existing pwa-sw test; no change needed.
- No new npm dependencies anywhere in this plan.

---

## Implementation prompts

### A0 prompt (for DeepSeek)

```
Task: Phase A (Analytics) docs reconciliation — step A0 of docs/phase-a-analytics-plan.md. Read that file first, plus AGENTS.md and the top 2 entries of docs/PROGRESS.md for project conventions.

Context: Phase A analytics has been re-decided as a CUSTOM Lambda + DynamoDB build (NOT Umami — Umami is a Next.js + Prisma app that requires PostgreSQL/MySQL and cannot run on Lambda + DynamoDB). Two docs still describe the old Umami framing and must be corrected. This is a docs-only change: no code, no terraform, no gates beyond keeping the markdown consistent.

1. docs/architecture-evolution-plan.md:
   a. §5.2 ("Recommendation: Umami (self-hosted on AWS)"): keep the build-vs-buy table in §5.1 as-is, but rewrite §5.2 to record the superseding decision — title it "Recommendation: custom Lambda + DynamoDB (decided 2026-08-16, supersedes the earlier Umami framing)". State: Umami requires PostgreSQL/MySQL (Next.js + Prisma) and cannot run on Lambda + DynamoDB; running real Umami means App Runner/ECS + RDS (~$25-45/mo) plus a new infra shape nothing else in the project uses; a small custom collect API + event table on the existing Lambda Function URL pattern costs ~$0-1/mo, follows the controllable-dummy directive, and reuses the progress stack's exact shape. Point readers to docs/phase-a-analytics-plan.md as the authoritative design. Note the trade-off vs Umami: we build the dashboard ourselves (in-app /admin/analytics page).
   b. §5.6 (Infrastructure): replace the "Self-hosted Umami on AWS" diagram + the "Simpler alternative: Umami Cloud" paragraph with the custom architecture (collect endpoint POST /api/analytics/event → CloudFront /api/analytics/* behavior → analytics Lambda → octav-analytics-events table with raw events + daily aggregate counters; GET /api/analytics/summary session-gated by an admin email allowlist; /admin/analytics static-export page). Keep the "Client integration" snippet but update the endpoint to /api/analytics/event and note the full client design is in docs/phase-a-analytics-plan.md.
   c. §5.4 privacy table: update the two rows that say "Umami" — the no-cookies row stays true (custom build is also cookieless: per-tab sessionStorage session id, no fingerprint, DNT honored); the data-retention row becomes "raw events TTL 90 days, daily aggregates TTL 400 days (12-month reporting)".
   d. §7 Phase A checklist: update the intro/rows to reference docs/phase-a-analytics-plan.md phases A0–A8 (row A1 "choose Umami cloud vs self-hosted" is obsolete — the decision is made: custom build). Do NOT check any rows off; just re-scope them.
2. docs/future-tech-stack-evolution.md: update the Step 3 row in the §4 migration table from "Plausible script + server-side event Lambda" to the custom design (analytics Lambda + octav-analytics-events, /api/analytics/* behavior, in-app /admin/analytics dashboard — see docs/phase-a-analytics-plan.md).
3. Add a PROGRESS.md entry per the AGENTS.md format (newest at top, after the header ---): title "2026-08-16 — Phase A analytics: direction locked (custom Lambda + DynamoDB), docs reconciled (A0)". Mention: 4 locked decisions (custom build, full §5.3 taxonomy, anonymous-only attribution, in-app admin dashboard); the Umami-needs-Postgres rationale; Next = A1 shared analytics module via a fresh prompt.

Constraints: docs-only — do NOT touch code, terraform, or tests. Follow the existing docs' tone/format (terse, factual, ISO dates). Do not commit; leave the working tree dirty for user review. Report the exact sections changed.
```

### A1 prompt (for DeepSeek)

```
Task: Phase A (Analytics) A1 — the shared analytics module src/lib/analytics/. Read docs/phase-a-analytics-plan.md FIRST (it is the authoritative design: data model, event schema, API surface), plus AGENTS.md and the top 2 entries of docs/PROGRESS.md. Work on develop (pull latest — A0 docs are merged).

Scope: build the server-side analytics module + its unit tests. NO Next routes, NO lambda/ entry, NO client code, NO terraform — those are A2/A3/A6.

Pattern sources (read these and mirror them exactly — same structure, same conventions, same comment style):
- src/lib/progress/types.ts, dummy.ts, dynamodb-storage.ts, http-handler.ts, deps.ts — the module shape to copy
- src/lib/auth/session.ts — resolveSession(req, storage); storage needs getSession(sessionId)
- src/lib/auth/dynamodb-storage.ts incrementOtpRequestCount + src/lib/auth/dummy.ts — the fixed-window rate-limiter pattern (window epoch in the bucket key, single UpdateCommand, dummy mirrors with injectable clock)
- src/lib/progress/deps.ts — getSharedDummyUniverse() (the in-memory universe shared with auth so dummy-OTP login sessions resolve in dev/e2e)
- tests/unit/progress-parity.test.ts — the dummy↔simulated-DDB parity harness pattern
- zod v4 is used (see src/lib/progress/types.ts for the house schema style)

Files to create:
1. src/lib/analytics/types.ts — zod schemas per the plan: 17-name enum; per-name props schemas from architecture-evolution-plan.md §5.3 (bounded: strings ≤120 chars, numbers sane-capped; auth_otp_requested carries emailDomain only); envelope { name, props, url, referrer, sessionId, clientTs }. Types for the raw event item, aggregate item, and the summary response.
2. src/lib/analytics/dummy.ts — InMemoryAnalyticsStorage: recordEvent (raw append + aggregate increments), incrementAnalyticsEventCount(ip, limit, windowSeconds) fixed-window budget (mirror the auth dummy, injectable clock), getSummary(days) reading the in-memory aggregates. Mirrors the aggregate ADD semantics exactly.
3. src/lib/analytics/dynamodb-storage.ts — DynamoAnalyticsStorage: recordEvent = 1 PutCommand (raw: k="ev", s="<date>#<ts>#<uuid>", attrs name/props/host/sessionId/ua≤80 chars, expiresAt = now+90d epoch seconds) + 1 UpdateCommand per aggregate kind (k="agg", s="<date>#<kind>#<key>", kinds event/page/referrer/host, ADD #c :one upsert, expiresAt = now+400d); incrementAnalyticsEventCount against the rate-limits table (bucket "analytics:<ip>:<epoch>"); getSummary = ONE Query k="agg", s BETWEEN oldest-date# and today#~ — loops LastEvaluatedKey (never truncates, per the listProgressByUser lesson). Server-side normalization BEFORE write: url → path-only (strip query+hash), referrer → host-only or "direct", empty referrer → "direct".
4. src/lib/analytics/http-handler.ts — three handlers:
   - POST event: body ≤4KB guard, zod envelope (400 on invalid, error message without internals), clientTs now+24h guard (400, same as progress), per-IP budget 120 events/10min via incrementAnalyticsEventCount (429 on exceed; clientIp = last X-Forwarded-For entry like the auth handler, fallback 'local'), success → 204. No session lookup — public endpoint.
   - GET summary?days=7|30|90 (default 30, 400 on other values): resolveSession via src/lib/auth/session.ts (401 when no session); admin iff the session user's email ∈ ANALYTICS_ADMIN_EMAILS env (comma-separated, case-insensitive) → 403 otherwise. Returns { days, dailySeries (per event name per date), topPages (≤20), topReferrers (≤10), totals, hosts }.
   - GET _health: unauthenticated Limit-1 Query probe on the events table → 200 {ok:true} only (mirrors progress _health).
5. src/lib/analytics/deps.ts — getAnalyticsDeps(env): ANALYTICS_STORAGE = "dummy" (default) | "dynamodb"; same fail-closed guard as auth/progress (inside AWS Lambda, dummy wiring or NODE_ENV=test refused unless AUTH_ALLOW_DUMMY=1). Dummy mode: analytics storage + session resolution BOTH against getSharedDummyUniverse() from ../progress/deps (so a dummy-OTP login resolves for /summary). Dynamodb mode: DynamoDBDocumentClient (region AUTH_DYNAMODB_REGION ?? AWS_REGION ?? ap-east-1), DynamoAnalyticsStorage with requiredEnv ANALYTICS_TABLE + AUTH_RATE_LIMITS_TABLE, and DynamoSessionStorage (users/sessions only, from src/lib/auth/dynamodb-storage) for resolveSession.

Unit tests to create in tests/unit/ (REQUIRED in A1, not deferred to A7 — vitest coverage gates on src/lib/** (90% lines / 85% branches) fail if the module ships untested):
- analytics-types.test.ts — schema edges (unknown event name, oversized strings, bad clientTs, per-name props validation)
- analytics-dummy.test.ts — raw+aggregate recording, fixed-window budget across window rollover, getSummary shapes
- analytics-dynamodb-storage.test.ts — mock DocumentClient: assert Put/Update command shapes (keys, ADD expression, ExpressionAttributeNames/Values, TTL values, table names), summary Query (BETWEEN, LastEvaluatedKey loop), rate-limit bucket key format
- analytics-parity.test.ts — dummy vs INDEPENDENT simulated DocumentClient (re-implement the ADD-upsert semantics from scratch like tests/unit/progress-parity.test.ts): identical event sequences → identical aggregates and identical budget allow/deny sequences
- analytics-http-handler.test.ts — 400 invalid envelope, 400 far-future clientTs, 429 after 120 events from one IP, 204 success, summary 401 (no session) / 403 (non-admin) / 200 (admin; seed the shared dummy universe via a dummy-OTP login like tests/unit/auth-routes.test.ts does), days param validation, _health 200
- analytics-deps.test.ts — dummy default, dynamodb wiring requires env names, fail-closed in Lambda without AUTH_ALLOW_DUMMY=1

Verification (must all pass before reporting done): npm test green (coverage gates included), npx tsc --noEmit clean, npx eslint on changed files 0 errors. Then add a PROGRESS.md entry (AGENTS.md format, newest at top): "2026-08-16 — Phase A A1: shared analytics module (src/lib/analytics/) + unit tests". Leave the working tree dirty for user review; do NOT commit. Report files created + test counts.
```
