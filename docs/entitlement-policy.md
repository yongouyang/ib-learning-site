# Entitlement Policy — Octav Learning

> **Status:** Agreed 2026-08-22. This is the tier *policy* (what goes where and why);
> the build sequence lives in `docs/entitlement-implementation-plan.md`.
> Machinery design: `docs/future-tech-stack-evolution.md` §2.9.

## Tiers

Three tiers, two independent questions per feature: **does it need identity?** (login
gate) and **does it need payment?** (premium gate). Login gates convert anonymous
users into accounts; premium gates cover real cost or proven exam-practice value.

### Tier 0 — Anonymous (no login)

The acquisition funnel / SEO surface. BBC Bitesize is free — we cannot charge for
what BBC gives away, only for what it doesn't do.

- All study notes, flashcards, topic quizzes (every subject, every stage)
- Diagnostics — take the test anonymously; "save your results / track weak areas
  over time" is the login hook
- Local (per-device) progress tracking, as today

### Tier 1 — Free with login

Features that are *meaningless without identity* or create switching cost. Serving
cost is ~zero; the point is converting anonymous → account.

- Cross-device progress sync + parent/child profiles (already live)
- Mixed review & weak areas backed by server-side history
- Exam / revision-ladder / paper results history
- **Leaderboard (Phase D)** — identity is inherent to the design; the
  minor-privacy rules (architecture-evolution-plan §4.6) need the account model.
  Kept free: a paywalled leaderboard never reaches the density it needs to work.
- **AI marking, quota-limited: 30 marks per calendar month per account**
  (the only Tier-1 feature with per-request cost — a free taste that drives
  conversion; the durable per-user budget machinery already exists from the
  progress-sync rate limiter)

### Tier 2 — Premium (subscription)

Real per-request cost, or the proven paid tier at every benchmark (SME all-access
~£40/yr; RV $249–499 — both charge for exactly exam practice + marking).

- **Unlimited AI marking** (free tier capped at the 30/month quota above)
- **Full practice-exam tier:** paper sets beyond the first set per course,
  revision-ladder upper levels, timed mock mode. "First set free, rest premium"
  is the SME playbook.
- Later candidates (not committed): predicted papers, parent progress reports.

### Explicitly NOT gated

- Study notes / flashcards / topic quizzes — never login- or premium-gated
  (see the enforcement constraint below)
- The leaderboard — never premium (density argument above)

## Enforcement constraint (why services, not content)

All topic content ships inside the static export — a determined user can read the
question JSON no matter what the UI gates. So:

- **Service gating = strong enforcement.** The API re-checks the entitlement
  server-side from the session on every call (AI marking quota, future
  server-served content). This is where the premium line is drawn.
- **Content gating = weak enforcement (UX only).** The `LockedFeature` tease for
  premium paper sets is a conversion surface, not a security boundary; accepted
  risk until/unless premium content moves to server-served delivery
  (future-tech-stack-evolution §2.3, §2.9 — decide at subscription build time).

Client gating is always UX only; every premium API must re-check server-side.

## Quota details (AI marking, free tier)

- **30 marks per calendar month per account** (per userId — not per child profile;
  a family's profiles share the account quota)
- Window: calendar month (UTC), bucket `aimark:<userId>:<YYYY-MM>` in
  `octav-rate-limits`, TTL ~40 days — same durable conditional-increment pattern
  as `incrementOtpRequestCount` / `incrementProgressSyncCount`
- Quota check happens **after** payload validation, **before** any LLM call —
  an exhausted quota never spends money
- Responses: logged-out → `401`; quota exhausted → `429` with a distinct
  `error: "quota_exceeded"` code (UI shows the upgrade prompt, not
  "try again later"); the existing per-IP in-memory lines stay as the first
  line against unauthenticated abuse
- Premium tier: effectively unlimited (a high safety cap, e.g. 1,000/month,
  to bound runaway-cost bugs — revisit when real usage data exists)

## Data model (minimal, pre-subscription)

Until Stripe lands, entitlement is **derived from a tier field on the user
record** (`tier: "free" | "premium"`, default `"free"`, set manually or by
admin grant for now) via a static `tier → featureId[]` map in code. The §2.9
DynamoDB design (`Feature` + `Entitlement` tables, per-feature grants) is the
subscription-time upgrade — adding it earlier buys nothing while there is no
payment provider.

`GET /api/auth/me` gains `entitlements: featureId[]` alongside the user object;
the client gets an `EntitlementsContext` (same pattern as `ProgressContext`)
with a deterministic dummy in dev/e2e (per-test entitlement injection — the
standing dummy-dependency directive, same as `src/lib/feedback/dummy.ts`).
