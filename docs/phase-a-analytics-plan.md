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

### A2 prompt (for DeepSeek)

```
Task: Phase A (Analytics) A2 — routes + Lambda entry + build wiring. Read docs/phase-a-analytics-plan.md first (A2 section), plus AGENTS.md and the top PROGRESS.md entry. Work on develop (pull latest — A1, the src/lib/analytics/ module, is merged at d309b89).

Scope: wire the A1 module into the dev/e2e and production request paths. NO client code (A3), NO instrumentation (A4), NO terraform (A6), NO new handler logic — A1's http-handler.ts is the single source of truth; everything here is thin delegation.

Pattern sources (mirror exactly):
- src/app/api/progress/route.ts, src/app/api/progress/sync/route.ts, src/app/api/progress/_health/route.ts — the 7-line Next route delegates
- lambda/progress/index.ts — the thin Lambda adapter (ROUTES map over lambda/shared/lambda-adapter.ts)
- tests/unit/auth-routes.test.ts — the route-delegation test pattern
- scripts/serve-static.ts — the AUTH_ROUTES / PROGRESS_ROUTES delegation maps

Changes:
1. Next routes (dev/e2e path), each a thin delegate with the same comment style as the progress routes:
   - src/app/api/analytics/event/route.ts    → POST → handleAnalyticsEvent
   - src/app/api/analytics/summary/route.ts  → GET → handleAnalyticsSummary
   - src/app/api/analytics/_health/route.ts  → GET → handleAnalyticsHealth
2. lambda/analytics/index.ts — thin adapter mirroring lambda/progress/index.ts exactly: ROUTES map { '/api/analytics/event': { POST }, '/api/analytics/summary': { GET }, '/api/analytics/_health': { GET } } → the A1 handlers; same 404/405/500 plumbing via lambda/shared/lambda-adapter.ts. Comment header notes CloudFront routes /api/analytics/* here (A6) and that dev/e2e uses the Next routes.
3. scripts/build-lambdas.sh — add: build_one "analytics" "lambda/analytics/index.ts" (4th zip).
4. scripts/serve-static.ts — add an ANALYTICS_ROUTES map (the 3 paths → '../src/app/api/analytics/<x>/route') and include it in the lookup alongside AUTH_ROUTES/PROGRESS_ROUTES.
5. tests/unit/analytics-routes.test.ts — mirror tests/unit/auth-routes.test.ts: assert each Next route delegates to its handler (dummy deps; POST a valid page_view envelope → 204; GET _health → 200; GET summary without session → 401). This is REQUIRED, not optional — the vitest coverage gate on src/app/api/** (85% lines) would fail otherwise.

Notes:
- scripts/build-static.sh stashes the whole src/app/api dir during static export — the new routes are covered automatically, no change needed there.
- The Lambda's IAM/env wiring is A6 (terraform); lambda/analytics running locally is NOT part of A2.

Verification (all must pass): npm run build:lambda → FOUR zips (feedback, auth, progress, analytics); npm test green; npx tsc --noEmit clean; npx eslint on changed files 0 errors. Manual smoke: npm run dev, then `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:<port>/api/analytics/event -H 'content-type: application/json' -d '{"name":"page_view","props":{},"url":"http://localhost/","sessionId":"s1","clientTs":"<now ISO>"}'` → 204, and `curl localhost:<port>/api/analytics/_health` → {"ok":true} (dummy mode, zero AWS). Then add the PROGRESS.md entry (AGENTS.md format, newest at top): "2026-08-17 — Phase A A2: analytics routes + lambda/analytics + 4th zip + serve-static". Leave the tree dirty; do NOT commit. Report files changed + smoke results.
```

### A5 prompt (for DeepSeek)

```
Task: Phase A (Analytics) A5 — the in-app admin dashboard at /admin/analytics. Read docs/phase-a-analytics-plan.md FIRST (A5 section + "API surface" + "Event schema" summary shape), plus AGENTS.md and the top 2 entries of docs/PROGRESS.md. Work on develop (A1–A4 are merged — the A4 instrumentation just landed, commit cdb6e00). This is a CLIENT page only; the /api/analytics/summary endpoint already exists (A1/A2) and needs NO backend change.

Scope: ONE new file, src/app/admin/analytics/page.tsx — a static-export-compatible client page. NO terraform, NO lambda, NO nav entry, NO new dependencies (charts are plain Tailwind divs — no chart library).

How the endpoint works (read src/lib/analytics/http-handler.ts handleAnalyticsSummary to confirm): GET /api/analytics/summary?days=7|30|90 (default 30; other values → 400). It requires a session (401 when none) AND the session user's email ∈ ANALYTICS_ADMIN_EMAILS comma-separated allowlist (403 otherwise). On success it returns the AnalyticsSummary shape from src/lib/analytics/types.ts:
  { days: number, dailySeries: Record<eventName, Record<'YYYY-MM-DD', count>>, topPages: {path,count}[], topReferrers: {referrer,count}[], totals: Record<eventName, count>, hosts: Record<host, count> }
The response ALSO sets a Set-Cookie (session refresh), so fetch MUST use credentials:'same-origin' (mirror src/lib/auth-client.ts, which uses `fetch(url, { credentials: 'same-origin' })`).

Auth state (src/context/AuthContext.tsx): the hook exposes `{ user, loaded }` — `loaded` is the flag (NOT "authLoaded"; the plan's "waits for authLoaded" is loose wording). Mirror src/app/account/page.tsx's guard exactly: `if (!loaded) return null; if (!user) <sign-in prompt linking to /login>`. On a 403 response body `{error:'Not authorized.'}`, render a friendly "You don't have access to analytics." state (do NOT auto-redirect). On 401 render the sign-in prompt. Any other fetch/network failure → a small "Couldn't load analytics." error with a Retry button.

Page behavior:
1. Days toggle: three buttons 7 / 30 / 90 (default 30), refetching summary?days=N on change; show the active one as pressed. Keep the previous data on screen while refetching (no full-screen skeleton flash — a subtle "loading" affordance only).
2. Render, top to bottom, all Tailwind-only (max-w-2xl card layout matching the account page; text-sm; every color class needs a dark: variant):
   a. Header + the days toggle.
   b. "Traffic by day" — for the `page_view` series, a CSS bar chart: a flex row of bars, one per date in ascending order, height proportional to count (divs, max height ~160px), date labels under bars. Empty series → "No page views in this window." This is the "how many visits" answer.
   c. "Sign-ups" stat — the `auth_login_completed` total for the window (read from totals), shown as a number next to a label. (Registrations = auth_login_completed; auth_otp_requested is requests, not accounts.)
   d. "Events" table — totals per event name, sorted desc (label each name human-readably, e.g. `quiz_completed` → "Quiz completed").
   e. "Top pages" — topPages list (path + count), and "Top referrers" — topReferrers list.
   f. "Traffic split" — hosts map (prod vs dev origin), one line per host with its count.
3. Accessibility: single <h1>; the bar chart is decorative (aria-hidden) with an adjacent visually-hidden/visible summary of the same numbers; use <table> with <thead> for the events list; buttons have aria-pressed for the toggle.

Notes:
- AnalyticsTracker (src/components/AnalyticsTracker.tsx) already skips /admin/* paths — no page_view pollution, no change needed.
- /admin/analytics is a fixed path (no generateStaticParams) — the static export prerenders it as a client page; the data loads client-side after auth, so this is fine.
- There is NO existing /admin directory — create it. Do NOT add it to Nav (direct URL only, per the plan).

Verification (all must pass): npx tsc --noEmit clean; npx eslint src/app/admin/analytics/page.tsx 0 errors; npm run build green (the static export must include /admin/analytics without error). Optional manual smoke: `ANALYTICS_ADMIN_EMAILS=you@example.com AUTH_STORAGE=dummy AUTH_EMAIL=dummy AUTH_TEST_MODE=1 npm run dev`, sign in with that email (dummy code 123456), visit /admin/analytics, confirm the dashboard renders (seed some events first by browsing + taking a quiz; page_view/quiz_completed should appear). Then add the PROGRESS.md entry (newest at top): "2026-08-22 — Phase A A5: /admin/analytics dashboard". Leave the tree dirty; do NOT commit. Report the file created + verification results.
```

### A6 prompt (for DeepSeek)

```
Task: Phase A (Analytics) A6 — deploy the analytics Lambda + table + CloudFront behavior (terraform only, mirrors progress_api). Read docs/phase-a-analytics-plan.md FIRST (A6 section + architecture diagram + "Notes & accepted trade-offs"), plus AGENTS.md (Terraform bullet: NO local terraform apply — CI-only; local fmt/validate/plan are OK; AWS_PROFILE=ib-learning-site) and the top 2 PROGRESS.md entries. Work on develop (A1–A5 merged). The A1/A2 code already exists and needs NO change — this is purely terraform + CI wiring.

Pattern sources (copy these exactly — same structure, names, comments):
- terraform/modules/progress_api/main.tf — the module template for analytics_api (Lambda + Function URL + least-privilege IAM + logs + the aws_lambda_permission.function_url + terraform_data provisioner with triggers_replace = <lambda>.last_modified convention). KEEP the provisioner block verbatim; it is the established convention (round 3, matches deployed state).
- terraform/modules/dynamodb/main.tf — where the new table lands; copy the rate_limits table block as the shape reference.
- terraform/modules/site/main.tf — the progress origin block (variable + origin, ~lines 25–36, 254–266) and the /api/progress/* ordered_cache_behavior (~lines 290–305); copy both for analytics.
- terraform/envs/prod/main.tf — the module "progress_api" call (~lines 244–270) + the two site module calls' progress_origin_domain wiring (~lines 281, 295).
- .github/workflows/ci.yml — TF_VAR_progress_env + the progress smoke step; mirror for analytics.

Env vars the analytics Lambda consumes (from src/lib/analytics/deps.ts — read it to confirm): ANALYTICS_STORAGE ("dynamodb"), AUTH_USERS_TABLE, AUTH_SESSIONS_TABLE, ANALYTICS_TABLE (the events table), AUTH_RATE_LIMITS_TABLE, ANALYTICS_ADMIN_EMAILS. Region uses AUTH_DYNAMODB_REGION ?? AWS_REGION ?? ap-east-1 (no extra var needed — the Lambda runs in ap-east-1).

IAM (least-privilege, mirror progress_api's per-statement style; derive actions from src/lib/analytics/dynamodb-storage.ts):
- octav-analytics-events table: dynamodb:PutItem (raw event), dynamodb:UpdateItem (aggregate ADD upserts), dynamodb:Query (getSummary over k="agg" AND the _health Limit-1 probe). No GetItem/DeleteItem/Scan. No GSI (single table, PK k + SK s) — no /index/* grant needed.
- octav-rate-limits table: dynamodb:UpdateItem ONLY (incrementAnalyticsEventCount bucket).
- octav-users table: dynamodb:GetItem ONLY (session validation getUserById).
- octav-sessions table: dynamodb:GetItem + dynamodb:UpdateItem + dynamodb:DeleteItem (resolveSession — same as progress_api).

Changes:
1. terraform/modules/dynamodb/main.tf: add resource "aws_dynamodb_table" "analytics_events" — name "${var.name_prefix}-analytics-events", PAY_PER_REQUEST, hash_key "k" (S), range_key "s" (S), ttl { attribute_name = "expiresAt"; enabled = true }. Add outputs analytics_events_table_name and analytics_events_table_arn (mirror the existing output style).
2. terraform/modules/analytics_api/main.tf (NEW): copy progress_api and adapt — resource/role/log-group names "iblearn-analytics" (name_prefix var, default "iblearn"); zip_path to the analytics zip; variables users_table_arn, sessions_table_arn, analytics_events_table_arn, rate_limits_table_arn, cors_allow_origins, reserved_concurrent_executions (default null, same quota note), environment (map, sensitive). The data-policy statements as specified above. Lambda function_name "${var.name_prefix}-analytics", runtime nodejs24.x, arm64, 256 MB, timeout 10, handler index.handler, source_code_hash filebase64sha256(zip_path). Function URL CORS allow_methods ["GET","POST"], allow_headers ["content-type"]. Outputs function_url + function_url_domain + function_name (mirror progress). Comment header notes CloudFront routes /api/analytics/* here and that dev/e2e uses the Next routes.
3. terraform/modules/site/main.tf: add variable "analytics_origin_domain" (default ""), an origin block for it (copy the progress origin), and an ordered_cache_behavior with path_pattern "/api/analytics/*" target_origin_id "lambda-analytics" — placed BEFORE the /api/* behavior (ordered behaviors are matched top-down; the comment in the auth/progress blocks explains this). Cached GET/HEAD only, cache policy caching-disabled, origin request all-except-host (copy the progress block verbatim, changing the names).
4. terraform/envs/prod/main.tf:
   a. Add variables: analytics_env (map(string), default {}, sensitive — "Analytics Lambda env overrides via CI TF_VAR_analytics_env (ANALYTICS_ENV secret); empty = base wiring below") and analytics_admin_emails (string, default "" — "Comma-separated admin email allowlist for /api/analytics/summary; set via the ANALYTICS_ADMIN_EMAILS repo variable").
   b. Add module "analytics_api": source "../../modules/analytics_api"; zip_path analytics zip; environment = merge({ ANALYTICS_STORAGE="dynamodb", AUTH_USERS_TABLE=module.dynamodb.users_table_name, AUTH_SESSIONS_TABLE=module.dynamodb.sessions_table_name, ANALYTICS_TABLE=module.dynamodb.analytics_events_table_name, AUTH_RATE_LIMITS_TABLE=module.dynamodb.rate_limits_table_name, ANALYTICS_ADMIN_EMAILS=var.analytics_admin_emails }, var.analytics_env); users/sessions/analytics_events/rate_limits table arns; cors_allow_origins = var.site_origins. (Read the progress_api call + the site module's origin wiring to get the exact merge/ARN style.)
   c. In BOTH site module calls (module "site" dev and module "site_prod" prod), add analytics_origin_domain = module.analytics_api.function_url_domain.
5. .github/workflows/ci.yml — in BOTH deploy jobs' env: TF_VAR_analytics_env: ${{ secrets.ANALYTICS_ENV || '{}' }} and TF_VAR_analytics_admin_emails: ${{ vars.ANALYTICS_ADMIN_EMAILS || '' }}. Add a smoke step next to the progress/auth smoke: `GET $SITE_URL/api/analytics/_health` must return 200 (mirror the existing curl smoke's format).
6. (Optional, defer-able) Update AGENTS.md with the analytics Lambda/behavior bullet; the smoke-200 note; and that ANALYTICS_ADMIN_EMAILS is a repo VARIABLE.

Notes:
- NO local terraform apply (CI-only rule). Local `terraform fmt -check -recursive` and `terraform validate` (in terraform/envs/prod, after `terraform init -backend=false` if needed) are the local checks; a read-only `AWS_PROFILE=ib-learning-site terraform plan` is allowed and should show: 1 table added, 1 Lambda + URL + IAM + log group added, both CloudFront distributions gain the /api/analytics/* behavior + origin. NO destroy of anything existing.
- Do NOT add reserved_concurrent_executions (leave null — the ap-east-1 quota is 10, same as auth/progress).
- The 4th Lambda shares the region quota; analytics ingest is the cheapest handler — no concern (plan "Notes & accepted trade-offs").
- `npm run build:lambda` must already produce lambda/analytics/dist/analytics-lambda.zip (A2) — the zip_path references it; no new build step.

Verification (all must pass before reporting done): terraform fmt -check -recursive clean; terraform validate in terraform/envs/prod clean; read-only terraform plan shows only the expected additions (and the KNOWN local-plan FEEDBACK_ENV env diff artifact — ignore it); npm run build:lambda (4 zips); npm test still green (no code change, sanity only). Do NOT apply, do NOT commit — leave the tree dirty for user review and CI deploy on push. Add a PROGRESS.md entry (newest at top): "2026-08-22 — Phase A A6: analytics terraform (table + Lambda + /api/analytics/* behavior)". Report exact resources added + plan summary.
```


