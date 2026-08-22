# Entitlement Implementation Plan — Octav Learning

> **Status:** Drafted 2026-08-22, pending implementation. Policy: `docs/entitlement-policy.md`
> (agreed 2026-08-22 — incl. the 30 marks/month free AI-marking quota per account).
> Machinery design: `docs/future-tech-stack-evolution.md` §2.9.
> Follows the architecture-evolution-plan phase letters (A analytics ✅, B auth ✅,
> C progress ✅, D leaderboard planned) — these are **Phase E** (entitlements).

## Guiding constraints

- Client gating is UX only; every premium API re-checks server-side from the session.
- External dependencies get a controllable dummy (standing directive) — the
  entitlement/quota storage joins the SHARED in-memory auth→progress→analytics
  universe so dummy-OTP sessions resolve end-to-end in dev/e2e.
- Fail closed in AWS Lambda (`AUTH_ALLOW_DUMMY=1` guard), same as auth/progress/analytics.
- No Stripe in E0–E3. `tier` on the user record is set manually (admin grant)
  until E4.
- No local `terraform apply` (CI-only) — applies land via `deploy-dev`.

---

## E0 — Tier model + entitlement derivation (no DynamoDB yet)

Smallest real version of §2.9: derive entitlements from a tier field, keep the
DynamoDB Feature/Entitlement tables for E4.

- `src/lib/entitlements/features.ts` (new): the `FeatureId` union
  (`'ai-marking'`, `'ai-marking-unlimited'`, `'exam-sets-full'`, …) and the
  static `TIER_FEATURES: Record<Tier, FeatureId[]>` map, plus
  `AI_MARK_FREE_MONTHLY_QUOTA = 30` and `AI_MARK_PREMIUM_MONTHLY_CAP = 1000`.
- `src/lib/auth/types.ts`: `User` gains `tier: "free" | "premium"` (default
  `"free"` on registration; zod schema + `PublicUser` updated).
- Storage: `DynamoAuthStorage` reads/writes `tier` (missing attribute ⇒ `"free"`
  — existing users need no migration); dummy mirrors it.
- Tests: tier default on registration, schema parse, dummy↔DDB parity for the
  new field.
- Gates: `npm test`, tsc, eslint, `build:lambda`.

## E1 — `/api/auth/me` entitlements + client context

- `src/lib/auth/http-handler.ts`: the `me` payload gains
  `entitlements: featureId[]` (derived from `user.tier` via the E0 map — ONE
  source of truth, server-side).
- `src/context/EntitlementsContext.tsx` (new): same pattern as
  `ProgressContext` — populated from `me()`, exposes `has(featureId)`, settles
  with `authLoaded`. Dummy: deterministic defaults + per-test injection.
- `src/components/LockedFeature.tsx` (new): visible-but-disabled wrapper with
  benefit copy + link to `/pricing` (a stub pricing page is fine — content at E4).
- Tests: me() payload shape, context gating, LockedFeature rendering states.
- Gates: as E0 + e2e for a gated surface.

## E2 — AI marking: login gate + 30/month quota (the first real enforcement)

This is the cost-protection deliverable; everything else is tease UI until E4.

**Server (`src/lib/feedback/`):**

- Introduce a deps seam (`src/lib/feedback/deps.ts`) — the handler currently
  reads env directly; it needs injectable `storage` (session validation +
  quota counter) and the shared clock. Dummy joins the SHARED in-memory
  universe; `AUTH_ALLOW_DUMMY=1` fail-closed guard, same convention.
- `handleFeedbackPost` (`src/lib/feedback/http-handler.ts`), in order:
  1. parse + validate payload (unchanged)
  2. per-IP in-memory limits (unchanged — first line)
  3. **session required**: `resolveSession` (shared `src/lib/auth/session.ts`)
     → `401 { error: "login_required" }` when anonymous
  4. **durable quota**: conditional increment on bucket
     `aimark:<userId>:<YYYY-MM>` in `octav-rate-limits` (TTL ~40 d), limit from
     tier (30 free / 1000 premium cap) → `429 { error: "quota_exceeded", resetAt }`
     when exhausted — BEFORE any LLM call, so an exhausted quota never spends money
  5. provider call + result validation (unchanged)
- `handleFeedbackGet` gains quota state for the session user
  (`{ configured, remaining, resetAt }`) so the UI can render "N marks left
  this month" without a wasted POST.
- Constants in `src/lib/feedback/types.ts`; `incrementAiMarkCount(userId, limit, monthKey)`
  added to the storage contract + DDB (one conditional UpdateCommand — the
  `incrementProgressSyncCount` pattern) + dummy (shared clock).

**Terraform (`modules/feedback_api`):** the feedback Lambda has NO DynamoDB
access today — add least-privilege grants: users GetItem, sessions
Get/Update/Delete (session validation only, same subset as progress_api),
rate-limits UpdateItem + the new env vars. `envs/prod` wires the table names.

**Client (`PaperRunnerClient.tsx`, the only "Mark with AI" surface):**

- Logged out → button becomes a login prompt ("Sign in to use AI marking —
  30 free marks/month").
- `quota_exceeded` → upgrade tease via `LockedFeature` copy.
- Show remaining quota from the GET response.
- Self-marking stays available in every state (graceful degradation preserved).

**Tests:** unit (handler 401/429/quota-decrement ordering, DDB command shapes,
dummy window roll across a month boundary, parity), e2e (dummy-OTP login →
mark → quota decrement → exhausted state; logged-out prompt). Playwright config
pins the dummy storage as usual.
**Gates:** full quality-gate list incl. `build:lambda` (feedback zip changes)
and a read-only terraform plan review.

## E3 — Premium tease UI for exam sets (UX-only gate)

- Course/papers pages: first set per course free; remaining sets + ladder upper
  levels + timed mock mode wrapped in `LockedFeature` (benefit copy, pricing link).
- Enforcement is UX-only (static-bundle constraint, policy doc §Enforcement) —
  recorded as an accepted risk; server-served premium content is an E4+ decision.
- `entitlements` from E1 drive the lock state; `exam-sets-full` feature id.

## E4 — Subscriptions (Stripe) — outline only, deferred

- Stripe webhook → `/api/subscriptions` → sets `user.tier` (+ expiry handling).
- NOW promote the §2.9 DynamoDB design: `Feature` + `Entitlement` tables replace
  the E0 static map; `/api/features` public endpoint feeds the real pricing page.
- Per-family question: does one subscription cover all child profiles? (Policy
  default: yes — quota is already per account.)
- Revisit the premium safety cap with real usage data.

## Sequencing & dependencies

```
E0 (tier model) ──► E1 (me + context) ──► E2 (AI quota) ──► E3 (tease UI) ──► E4 (Stripe)
```

E0+E1 are one small PR. E2 is the substantive one (new DynamoDB access for the
feedback Lambda). E3 can ship any time after E1. Phase D (leaderboard) is
independent and can interleave — it lands as Tier-1 free-with-login per policy.

## Out of scope (recorded)

- Server-served premium question content (E4+ decision)
- Rollout toggles (ops-owned axis of §2.9) — no need identified yet
- Regional pricing, school licenses, app-store billing — subscription design time
