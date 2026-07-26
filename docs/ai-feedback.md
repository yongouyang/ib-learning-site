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

## Deployment (Vercel)

1. Deploy first **without** any `FEEDBACK_*` env — the feature stays hidden (zero risk).
2. Get a dedicated API key from the **Moonshot open platform** (platform.moonshot.cn / api.moonshot.ai). Note: a Kimi Code CLI subscription credential is a product login, not an open-platform API key — the open platform bills separately and lets you set budget limits/alerts. Set a monthly budget alert before going live.
3. Add env vars in the Vercel project settings (Production): `FEEDBACK_PROVIDER=openai-compatible`, `FEEDBACK_API_KEY=sk-...`, optionally `FEEDBACK_MODEL` / `FEEDBACK_BASE_URL`.
4. Watch the Moonshot dashboard for the first week. Abuse exposure is bounded by per-IP rate limits + payload caps (2,000 chars, one question per request), but on serverless the in-memory limiter is **per-instance, not global** — if usage grows, move to Upstash Redis rate limiting.

Never set `FEEDBACK_TEST_MODE` in Vercel/production (the route logs a loud warning if it detects test mode in production).

## Contract

```
POST /api/feedback
{ stem, markscheme[], modelAnswer, studentAnswer, maxMarks }
→ 200 { marks, perPoint: [{ point, awarded, comment }], feedback }
→ 400 invalid payload · 429 rate limited · 501 not configured · 502 provider failure
GET  /api/feedback → { configured: boolean }
```

`perPoint.length === markscheme.length` and `marks === count(awarded)` are enforced by the route — the LLM cannot inflate scores. Students can always override AI ticks in the UI; self-marking remains the source of truth for recorded marks.
