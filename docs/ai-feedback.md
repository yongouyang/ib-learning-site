# AI Feedback (Phase 5)

`POST /api/feedback` marks a student's free-response answer against the markscheme with an LLM and returns marks + per-point feedback. The API key is server-side only; when no provider is configured the feature hides itself and students self-mark.

## Providers

| `FEEDBACK_PROVIDER` | Purpose | Needs key? |
|---|---|---|
| `dummy` | Local dev, e2e, production-issue reproduction. Deterministic default responses + per-request injection. | No |
| `openai-compatible` | Real LLM via any OpenAI-style chat endpoint (Moonshot/Kimi, OpenAI, …). | Yes |

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `FEEDBACK_PROVIDER` | — (unset = feature off) | `dummy` or `openai-compatible` |
| `FEEDBACK_API_KEY` | — | **Server-side only. Never `NEXT_PUBLIC_`.** |
| `FEEDBACK_MODEL` | `moonshot-v1-8k` | Model id at the provider |
| `FEEDBACK_BASE_URL` | `https://api.moonshot.ai/v1` | OpenAI-compatible endpoint |
| `FEEDBACK_RATE_LIMIT_PER_MIN` | `10` | Per-IP sliding window |
| `FEEDBACK_RATE_LIMIT_PER_DAY` | `50` | Per-IP sliding window |
| `FEEDBACK_TEST_MODE` | — | `1` enables `_testResponse` injection (dummy provider only). **Never set in production.** |
| `FEEDBACK_DUMMY_RESPONSE` | — | JSON string overriding the dummy's default response |

## Local development (zero tokens)

```bash
FEEDBACK_PROVIDER=dummy FEEDBACK_TEST_MODE=1 npm run dev
```

The "Mark with AI" button appears in paper sets and the route answers with the dummy default (all points awarded, canned comments). To control the exact response — e.g. to reproduce a production marking issue — POST with `_testResponse`:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H 'Content-Type: application/json' \
  -d '{
    "stem": "Work out 347 + 586.",
    "markscheme": ["M1: correct column-addition method", "A1: 933"],
    "modelAnswer": "Column addition gives 933.",
    "studentAnswer": "947",
    "maxMarks": 2,
    "_testResponse": {
      "marks": 0,
      "perPoint": [
        {"point": "M1: correct column-addition method", "awarded": true, "comment": "method ok"},
        {"point": "A1: 933", "awarded": false, "comment": "wrong final value"}
      ],
      "feedback": "Check your carrying."
    }
  }'
```

Injected responses pass the same zod validation as real provider output, and `marks` is always recomputed server-side from `perPoint`. **This is the standard way to replicate a production issue locally:** capture the real LLM response that misbehaved, run with the dummy provider + test mode, inject the captured payload (from the browser e2e-style via route interception, or curl), debug against the real UI.

## Testing

- **Unit**: `tests/unit/api-feedback.test.ts` (route via real env-wiring), `tests/unit/feedback-dummy.test.ts`. Run: `npm test`.
- **E2E**: `tests/e2e/ai-feedback.spec.ts` — the Playwright webServer sets `FEEDBACK_PROVIDER=dummy` + `FEEDBACK_TEST_MODE=1`; per-case responses are injected by rewriting the outgoing POST body (`page.route` + `route.fetch`). Run: `npx playwright test tests/e2e/ai-feedback.spec.ts`.
- **Live contract test** (costs tokens, opt-in):

  ```bash
  FEEDBACK_LIVE=1 FEEDBACK_API_KEY=sk-... npx vitest run --config vitest.live.config.ts
  ```

## Deployment (AWS)

1. The site deploys fine **without** any provider env — the feature hides itself (zero risk).
2. Production uses **DeepSeek** (`deepseek-v4-flash` at `https://api.deepseek.com/v1`, chosen 2026-08-09). Why not Moonshot: a Kimi Code CLI subscription credential is a product login, not an open-platform API key; and while Moonshot platform keys work from a local machine, `api.moonshot.cn` sits behind mainland ingress that gets intermittently **blackholed from AWS ap-east-1** (verified with a probe Lambda: TLS connects fine at first, then 8/8 connect timeouts). `api.moonshot.ai` only accepts international-platform keys. DeepSeek's endpoint is globally fronted and stable from AWS.
3. Set the repo secret `FEEDBACK_ENV` (single-line JSON, straight quotes — terraform parses it as HCL and rejects multi-line/curly-quoted values):

   ```
   {"FEEDBACK_PROVIDER":"openai-compatible","FEEDBACK_API_KEY":"sk-...","FEEDBACK_BASE_URL":"https://api.deepseek.com/v1","FEEDBACK_MODEL":"deepseek-v4-flash"}
   ```

   The deploy job maps it to the Lambda env via `TF_VAR_feedback_env`.
4. Provider quirks handled in code: `temperature` is omitted (Kimi k2 rejects any value but 1) and reasoning models return `reasoning_content` alongside `content` — we only read `content`.
5. Watch the DeepSeek dashboard for the first week. Abuse exposure is bounded by per-IP rate limits + payload caps (2,000 chars, one question per request), but on serverless the in-memory limiter is **per-instance, not global** — if usage grows, move to a shared store (e.g. DynamoDB) for rate limiting.

Never set `FEEDBACK_TEST_MODE` in production (the route logs a loud warning if it detects test mode in production).

## Contract

```
POST /api/feedback
{ stem, markscheme[], modelAnswer, studentAnswer, maxMarks }
→ 200 { marks, perPoint: [{ point, awarded, comment }], feedback }
→ 400 invalid payload · 429 rate limited · 501 not configured · 502 provider failure
GET  /api/feedback → { configured: boolean }
```

`perPoint.length === markscheme.length` and `marks === count(awarded)` are enforced by the route — the LLM cannot inflate scores. Students can always override AI ticks in the UI; self-marking remains the source of truth for recorded marks.
