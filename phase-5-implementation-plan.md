# Phase 5 — AI Feedback: Detailed Implementation Plan

> Parent doc: `revised-implementation-plan.md` §5 Phase 5 (user-approved: API route).
> Goal: `app/api/feedback/route.ts` marks a student's free-response answer against the markscheme with an LLM and returns marks + per-point feedback — rate-limited, API key server-side only, graceful degradation to self-marking when no key is configured. The PaperRunnerClient already holds the payload shape (`{questionId, studentAnswer, ticks}`).
> Sized for: **2 focused sessions** (breakdown in §5).
>
> **Standing testing mindset (user directive, applies beyond this phase):** every external dependency gets a *controllable* dummy implementation — unit tests mock it outright; e2e and local dev run a dummy provider that returns deterministic defaults **and accepts per-test injected responses**. The same injection path is how we replicate production issues locally: capture the real response that misbehaved, feed it through the dummy, debug against the real UI.

---

## 1. Scope

**In:**
- Provider abstraction (`src/lib/feedback/`) with two implementations:
  - **`dummy`** — deterministic, zero-token local provider with default responses + per-test injection (see §3.3) for development, e2e, and production-issue reproduction.
  - **`openai-compatible`** — works with any OpenAI-style chat-completions endpoint (Moonshot/Kimi, OpenAI, others) via configurable base URL + model.
- `POST /api/feedback` route: validation (zod), rate limiting, payload caps, LLM call with strict JSON output + zod-verified response, one retry on parse failure, clean error semantics so the UI can fall back to self-marking.
- UI: "Mark with AI" button in PaperRunnerClient's mark stage → pre-fills the checklist ticks + shows per-point comments and overall feedback; student can still override ticks (self-marking stays the source of truth).
- Test strategy: unit tests with a mocked provider, e2e against the mock provider, an opt-in live contract test (never in CI).
- Docs: env setup, deployment guide, cost/safety guidance.

**Out (deliberately):**
- **No hint mode, no photo/handwriting input** (parent plan defers these).
- **No accounts/per-user quotas** — Phase 7. Rate limiting is per-IP best-effort (see §3.5 honest limitation).
- **No streaming** — one shot request/response keeps the contract simple; answers are short.
- **No AI marking for MC questions** — free-response only.

---

## 2. Answering the two open questions (user, 2026-07-25)

### 2.1 "How do we test locally without consuming real tokens?"

Three layers, all token-free except the last (which is opt-in):

1. **Unit tests** — the provider module is injected/mocked (Vitest `vi.mock`), so route logic (validation, rate limit, mapping, fallback) is tested with zero network.
2. **`FEEDBACK_PROVIDER=dummy`** — the Dummy AI feedback provider (§3.3): deterministic default responses, **plus per-test response injection** when `FEEDBACK_TEST_MODE=1`. `npm run dev` with these env vars gives the full UI flow locally with complete control over what the "AI" returns — including malformed responses and edge cases. Playwright's webServer runs the same way, so **e2e exercises the real API route end-to-end without any LLM, with each test case injecting exactly the response it wants to assert against**. The same injection path replicates production issues locally (feed the captured real response through the dummy).
3. **Live contract test** (`tests/live/`, skipped unless `FEEDBACK_LIVE=1` **and** a real key is set) — one tiny request asserting the real provider's response shape. Run manually when changing the provider/prompt; costs fractions of a cent. Never in CI, never in the default test scripts.

### 2.2 "Should I share my Kimi API token with the deployed app?"

**Short answer: yes, it's reasonable for initial deployment — with the safeguards below, and with a dedicated Moonshot open-platform key, not a CLI/subscription credential.**

- **Architecture is safe by construction**: the key lives only in server-side env (`FEEDBACK_API_KEY`) on Vercel — never prefixed `NEXT_PUBLIC_`, never bundled to the client, requests come from the serverless function only. This is the standard pattern and matches the parent plan.
- **Caveat to verify**: a Kimi Code (CLI) subscription token is a *product credential*, not necessarily a Moonshot open-platform API key. Get a dedicated key from the Moonshot open platform (platform.moonshot.cn / api.moonshot.ai), which is billed separately per token — the open platform issues API keys with their own balance and lets you set limits. Do not reuse the CLI login.
- **Abuse exposure is the real risk** (anyone can POST to the route and spend your tokens), mitigations in scope:
  - Per-IP rate limit (default: 10 requests/min, 50/day — generous for a student, cheap for you).
  - Payload caps: student answer ≤ 2,000 chars, ≤ 10 marks per question, one question per request.
  - Provider-side: set a monthly budget/balance alert on the Moonshot console before deploying.
  - Later (Phase 7 accounts): move quota enforcement to per-user.
- **Rollout order**: deploy first with no key (feature hidden — zero risk), add the key in Vercel env when ready, watch the Moonshot dashboard for a week.

---

## 3. Design decisions

### 3.1 API contract

```
POST /api/feedback
{ "stem": string, "markscheme": string[], "modelAnswer": string,
  "studentAnswer": string, "maxMarks": number }
→ 200 { "marks": number, "perPoint": [{ "point": string, "awarded": boolean, "comment": string }], "feedback": string }
→ 400 validation error · 413 payload too large · 429 rate limited · 501 provider not configured · 502 provider error
```

- `perPoint.length === markscheme.length`; `marks === count(awarded)` (route enforces, not the LLM).
- 501 when no key → UI hides the button (feature discovery via `GET /api/feedback` → `{ configured: boolean }`, no key leak).

### 3.2 Provider interface

```ts
// src/lib/feedback/types.ts
export interface MarkRequest { stem, markscheme, modelAnswer, studentAnswer, maxMarks }
export interface MarkResult { marks, perPoint: { point, awarded, comment }[], feedback }
export interface FeedbackProvider { markAnswer(req: MarkRequest): Promise<MarkResult> }
export function getFeedbackProvider(): FeedbackProvider // picks by env, throws if unconfigured
```

- **Prompt design** (openai-compatible): system prompt = "strict exam marker; award each markscheme point independently; M marks need the method, A marks need method first; respond ONLY with JSON matching the given schema"; user message = stem/markscheme/model answer/student answer. Response via JSON mode; parsed + validated with zod (`perPoint` length must match, `awarded` booleans, comments ≤ 280 chars); one retry with a "return valid JSON" nudge on parse failure.
- **Env config**: `FEEDBACK_PROVIDER` (`dummy` | `openai-compatible`), `FEEDBACK_API_KEY`, `FEEDBACK_MODEL` (e.g. `moonshot-v1-8k`), `FEEDBACK_BASE_URL` (default `https://api.moonshot.ai/v1`), optional `FEEDBACK_RATE_LIMIT` overrides, `FEEDBACK_TEST_MODE` (injection switch, never in production), optional `FEEDBACK_DUMMY_RESPONSE` (custom default). No provider SDK dependency — plain `fetch` keeps the bundle and cold start small.

### 3.3 The Dummy provider (zero tokens, controllable)

`DummyFeedbackProvider` — deterministic, dependency-free, and **controllable by the caller in test mode**:

- **Default response** (no injection): every markscheme point awarded with a canned comment (`"Dummy marker: point awarded"`), overall feedback `"Dummy marker — configure FEEDBACK_API_KEY for real AI feedback"`. Optionally overridden wholesale via `FEEDBACK_DUMMY_RESPONSE` (JSON string) for a fixed custom default.
- **Per-test injection**: when the server runs with `FEEDBACK_TEST_MODE=1`, the API route honors a `_testResponse` field in the POST body and passes it straight to the dummy provider as its return value — still validated by the same zod response schema as real provider output. E2e cases use this to assert against exact mark patterns, comments, and malformed responses (retry → 502 path).
- **Production safety**: `_testResponse` is ignored unless `FEEDBACK_TEST_MODE=1` is explicitly set; it is never set in Vercel/production (documented in the deployment guide, and the route logs a warning if test mode is on outside `NODE_ENV=development/test`).
- Every dummy response flows through the identical zod validation as the real provider, so the UI never sees a different shape.

This is the template for future external dependencies: default + injectable, always.

### 3.4 UI integration (PaperRunnerClient)

- Mark stage gains a "Mark with AI" button (Sparkles icon) shown only when `GET /api/feedback` reports configured — so local dev without a key still shows the button when using `FEEDBACK_PROVIDER=dummy` (dummy counts as configured).
- Click → POST for the current question → ticks pre-filled from `perPoint.awarded`, per-point comments shown under each checklist row, overall `feedback` in a banner; button disabled while loading, error banner + manual checklist on failure (graceful degradation).
- Student can still toggle ticks after AI marking — the recorded marks are the final ticks (self-marking remains the source of truth; AI is an advisor).
- Rate-limit feedback: 429 → friendly "AI marker is busy — try again in a minute, or mark yourself below".

### 3.5 Rate limiting (honest limitation)

In-memory sliding window per IP in the route module. **Caveat**: Vercel serverless runs multiple instances, so the limit is per-instance, not global — fine as a first line against casual abuse at our traffic, not a hard quota. If usage grows: Upstash Redis rate limit (~10 lines, free tier) — noted as a follow-up, not in scope.

### 3.6 Tests

- **Unit** (`tests/unit/api-feedback.test.ts`): route with provider mocked — 400 on bad payloads (missing fields, markscheme/marks mismatch, answer > 2,000 chars), 501 when unconfigured, marks recomputed from perPoint (LLM can't inflate), retry-once on invalid JSON then 502, 429 after limit, `_testResponse` ignored when test mode is off.
- **Unit** (`tests/unit/feedback-dummy.test.ts`): dummy provider — default shape passes the same zod schema, injection honored in test mode, custom default via `FEEDBACK_DUMMY_RESPONSE`.
- **Live** (`tests/live/feedback-live.test.ts`): skipped unless `FEEDBACK_LIVE=1` + key; one 1-mark question; asserts shape + latency logging.
- **E2E** (`tests/e2e/ai-feedback.spec.ts`): Playwright webServer env `FEEDBACK_PROVIDER=dummy` + `FEEDBACK_TEST_MODE=1` — (a) default-dummy flow: answer → Check → Mark with AI → ticks pre-filled + canned comments → result recorded; (b) injected-response flow: a specific `perPoint` pattern (some points not awarded) asserted against the UI; (c) injected malformed response → graceful error banner, manual checklist still usable; (d) 429 path via lowered `FEEDBACK_RATE_LIMIT`. Existing papers spec (no button when unconfigured) must stay green — it runs without the env, proving graceful degradation.

---

## 4. Task breakdown (ordered)

**Session 1 — provider + route**
1. `src/lib/feedback/types.ts` + `dummy.ts` (default + injectable responses, test-mode guard) + `openai-compatible.ts` (fetch, JSON mode, zod-validated, one retry) + `index.ts` (`getFeedbackProvider` env switch).
2. `src/app/api/feedback/route.ts`: GET (configured check) + POST (zod validation → caps → rate limit → provider → enforce marks=count(awarded) → response); `_testResponse` honored only when `FEEDBACK_TEST_MODE=1`.
3. Unit tests (route + dummy provider); `FEEDBACK_*` documented in `.env.example` if the repo has one (check; otherwise README/docs section).
4. Live contract test (skipped by default) + manual smoke: `FEEDBACK_PROVIDER=dummy FEEDBACK_TEST_MODE=1 npm run dev` → curl the route (default + injected).

**Session 2 — UI + e2e + docs**
5. PaperRunnerClient "Mark with AI" (configured check, loading/error states, tick pre-fill, comments, banner).
6. E2E: default-dummy flow + injected-response flows (specific marks, malformed) + unconfigured-degradation + 429.
7. Docs: `docs/ai-feedback.md` (env vars, Vercel setup, Moonshot key guidance from §2.2, rate-limit caveat, live-test invocation, **how to reproduce a production marking issue locally via injection**) + AGENTS.md conventions (incl. the dummy-provider testing mindset) + PROGRESS.md.
8. Full gate suite; deploy note: merge to develop auto-deploys with feature hidden until the Vercel env is set.

---

## 5. Sizing & session plan

| Session | Content | Est. | Done when |
|---|---|---|---|
| **1** | Provider abstraction, mock provider, API route, unit + live-contract tests | 2–3 h | Route passes unit tests; mock curl returns valid marks; zero-token local flow works |
| **2** | UI button + states, e2e (mock/429/degraded), docs, full gates | 2–3 h | E2e green incl. degradation path; docs published; full suite green |

## 6. Open questions (resolve in Session 1)

1. **Model choice** — default `moonshot-v1-8k` (cheap, sufficient for short marking) vs a K2 model (better reasoning, pricier). Start with the cheap default; the model is one env var away. Verify current model names against the Moonshot docs when wiring the key.
2. **Rate-limit defaults** — 10/min + 50/day per IP as the starting point; tune after a week of real usage.
3. **Marking strictness** — the system prompt should match our self-marking convention (M before A). Check AI vs self-mark agreement on a handful of real answers during the live smoke; adjust prompt once, not iteratively.
