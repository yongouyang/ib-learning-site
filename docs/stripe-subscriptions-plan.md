# E4 — Stripe Subscriptions (Implementation Plan)

> Status: **DRAFT — awaiting your confirmation of §0.2 before any code.**
> Implements `docs/entitlement-implementation-plan.md` §E4 and closes the last
> monetisation gap: today `user.tier` can only be set by a manual DynamoDB grant.
> Companion docs: `docs/entitlement-policy.md` (tier policy),
> `docs/future-tech-stack-evolution.md` §2.9 (Feature/Entitlement tables).

---

## 0. Decisions

### 0.1 Locked by you (2026-09-05)

| # | Decision |
|---|---|
| 1 | **Prices:** USD **$20 / month**, USD **$200 / year** (≈2 months free vs $240). |
| 2 | **Markets:** UK, UAE, Singapore, Germany, Switzerland, India, Australia **+ Hong Kong**. |
| 3 | **v1 scope:** Stripe hosted **Checkout** + **Customer Portal**, two prices on one product, and **defer** the §2.9 `Feature`/`Entitlement` DynamoDB tables + `/api/features`. Keep the static `TIER_FEATURES` map. |
| 4 | **Family coverage:** one subscription covers **all child profiles** under the parent account (matches existing policy — AI quota is already per-account, not per-profile). |
| 5 | **Trial:** **14 days**, no charge until it ends. |
| 6 | **Card storage:** Stripe stores the card; we never do (see §4 — this is the answer to your concern). |
| 7 | **Business base:** **Hong Kong**. No Stripe account yet. |
| 8 | **Premium content:** move to **server-served** (do not keep the "ships in the static export" accepted risk). |
| 9 | **Secrets:** keep everything in **GitHub Actions secrets**; **no** move to SSM, **no** local `terraform apply`. |
| 10 | **Trial card collection:** **collect the card at trial start** (`payment_method_collection=always`). |
| 11 | **Stripe account type:** **individual / sole proprietor with HKID**, if Stripe HK supports it. |
| 12 | **Settlement currency:** **USD**, contingent on being able to pay out USD to the HK HSBC USD line. |
| 13 | **Stripe Tax:** **Tax Complete** (threshold monitoring + registrations + filings). |
| 14 | **DEV access control:** on `dev.octavlearning.com`, `/api/*` serves only 4 allowlisted accounts; every other request is rejected (§6.8). |

### 0.2 To verify during E4.0 setup (I could not confirm these from Stripe's docs)

1. **Individual + HKID (decision 11).** Stripe's HK requirements page is JS-rendered and I could not
   read it directly. Confirm the **Individual / sole proprietor** option appears at signup and that
   **HKID + proof of address** are accepted. If Stripe requires a registered company instead, the
   options are: register an HK company, or use whatever individual option Stripe does offer.
2. **USD payout to an HSBC HK USD account (decision 12).** Stripe documents **multi-currency settlement
   as available in Hong Kong** — that is the mechanism for holding a USD balance. But Stripe also says
   bank accounts "generally must be located in a country where the settlement currency is an official
   currency", which is why a USD payout destination may need to be **US-based**. Confirm in the
   dashboard or with Stripe support.
   **Fallback:** settle to HKD and accept the ~2% conversion — monthly net ≈ **$18.52** instead of
   ≈ **$19.02**, a ~2.5% revenue difference. **Not a blocker**, just less margin.
3. Confirm **Stripe Tax Complete** pricing at your volume, and the current refund-fee policy (whether
   the original processing fee is returned).

> ⚠️ **I am not a tax adviser.** §3.2 explains the mechanics and what Stripe automates; the
> registration obligations themselves are a question for an HK accountant familiar with cross-border
> digital services.

---

## 1. Goal & non-goals

**Goal:** a parent can start a 14-day trial, convert to a paid monthly or annual plan, manage or cancel
it themselves, and have `user.tier` (and therefore every premium surface) update automatically — with
all entitlement checks enforced **server-side**.

**Non-goals for v1:** promotional/coupon codes, proration experiments, seat-based or per-child pricing
(rejected — §0.1 #4), the §2.9 Feature/Entitlement tables, invoicing for schools, and any local payment
method beyond cards + wallets Stripe already offers.

---

## 2. Product & packaging

### 2.1 Prices

| Plan | Price (USD) | Billing period | Notes |
|---|---|---|---|
| Premium monthly | **$20** | monthly | |
| Premium annual | **$200** | yearly | $40 off vs 12 × $20 (2 months free) |

Both are **`recurring` prices on a single Product** (`prod_octav_premium`), currency `usd`.
Price IDs are **mode-specific** (test and live each have their own) → they live in env, never in code.

### 2.2 Free trial (14 days)

Implemented on the Checkout Session as `subscription_data.trial_period_days: 14`.

- Checkout's newer "trial offers" are **Subscriptions-API only**; Checkout uses the classic
  `trial_period_days` (Stripe calls it the legacy free-trial path).
- Max trial length is 730 days; 14 is well within limits.
- **Decision 10 — collect the card at trial start** (`payment_method_collection=always`, Checkout's
  default): the card is captured and stored **by Stripe** (§4), **no charge is made during the
  trial**, and the subscription auto-converts on day 15.
- **No invoice is created and no money moves during the trial.**
- Mitigation for "forgot to cancel": Stripe's **trial-will-end reminder email** (Billing settings;
  fired from `customer.subscription.trial_will_end`), plus self-serve cancel in the Customer Portal.
- Switching to `payment_method_collection=if_required` later is a one-line change if conversion data
  ever argues for it.

### 2.2.1 No-charge guarantees (cancelling during the trial)

You are right that this is the crux: **no refund should ever be needed**, because with
`trial_period_days` Stripe does not create a chargeable invoice until the trial ends. Cancelling
before then means the scheduled charge never happens. Concretely:

| Moment | Stripe state | Charge? | Our tier |
|---|---|---|---|
| Checkout completed | `trialing`, card saved | **no invoice, no charge** | premium |
| Day 3, user cancels | `trialing`, `cancel_at_period_end=true` | **no charge** | premium (until day 14) |
| Day 14, cancelled trial ends | subscription ends, `customer.subscription.deleted` | **no charge** | → free |
| Day 14, not cancelled | `active`, invoice created + charged | charged | premium |

**Cancellation semantics we will implement:** cancel sets **`cancel_at_period_end = true`**, not an
immediate delete. The customer keeps the trial access they were promised, the subscription ends at the
trial boundary, and **no invoice is ever generated**. Stripe documents this as the subscription
completing "the duration of time the customer has already paid for" — for a trial that duration is the
trial, and the amount was zero. Reactivation before the boundary is `cancel_at_period_end = false`.

**Guard rails against the erroneous-charge / dispute scenario you raised:**

1. **Never create an upfront charge.** `trial_period_days` on the Checkout Session is the only
    mechanism; we never pass an upfront line item and never call `invoice.pay()` ourselves.
2. **Trial reminder email.** Stripe fires `customer.subscription.trial_will_end` **three days before**
   the trial ends (Stripe can email the customer from this). We also surface "trial ends on <date>"
   and the saved card (brand + last4) in `/account` so the upcoming charge is never a surprise.
3. **One-click cancel** via the Customer Portal, linked from `/account`.
4. **Safety net for the `if_required` path** (only if we ever switch to it): set
   `trial_settings.end_behavior.missing_payment_method = cancel`, so a trial ending with no card
   cancels instead of erroring.
5. **Reconciliation, not blind trust** — see §6.4.1. Stripe remains the source of truth.

### 2.3 What Premium unlocks

Unchanged from `docs/entitlement-policy.md`:

- **Unlimited AI marking** (free tier stays at **30 marks / calendar month per account**; premium
  safety cap 1000/month).
- **Full practice-exam tier:** paper sets **2+** per course (set 1 stays free), revision-ladder
  **levels 3–5** (1–2 stay free), and **timed mock mode**.

Study notes, flashcards, topic quizzes, diagnostics and the leaderboard stay free forever.

---

## 3. Money: fees, tax, and what you keep

### 3.1 Stripe fees (Hong Kong account)

From Stripe's HK pricing pages:

| Item | Fee |
|---|---|
| Domestic cards (HKD-settled) | **3.4% + HK$2.35** |
| **Cards settled in USD** | **3.4% + US$0.30** |
| International cards | **+0.5%** (when currency conversion is required) |
| Currency conversion | **+2%** |
| Setup / monthly / minimum | **none** |
| Refunds (card) | no additional fee to *issue* one |
| **Stripe Tax** | **0.5% per transaction** where you are registered to collect (pay-as-you-go; subscription plans exist) |

**Worked example** (monthly $20, USD-settled, domestic card):

```
Gross                        $20.00
Stripe card fee  3.4% + 0.30  -$0.98
                             -------
Net to you                   $19.02   (95.1%)
```

Annual $200: `3.4% + $0.30 = $7.10` → **$192.90 net** (96.5%).

With an international card needing conversion, add ~0.5% + 2% → roughly **$18.52 net** on the monthly.
So: **present in USD and settle in USD** whenever possible (§3.1 + decision **C**).

> Verify the exact numbers on your own dashboard — Stripe publishes standard rates and negotiates
> custom pricing at volume.

### 3.2 Tax — the part that actually needs attention

**Hong Kong has no VAT/GST**, so domestic HK sales carry no sales tax. The complexity is entirely
**cross-border digital services supplied B2C**. Your target markets each have their own regime, and
several require a **non-resident seller to register from the very first sale** (no threshold):

| Market | Regime | Rough rate |
|---|---|---|
| United Kingdom | VAT on digital services | 20% |
| EU (incl. Germany) | VAT on digital services | 17–27% |
| Switzerland | VAT | 8.1% |
| Australia | GST on digital products | 10% |
| Singapore | GST (OVR regime for overseas vendors) | 9% |
| UAE | VAT | 5% |
| India | GST (OIDAR for overseas suppliers) | 18% |
| Hong Kong | none | — |

Two things matter for us:

1. **Tax is collected from the customer on top of our price** — it does **not** come out of the $20.
   A UK customer might pay $20 + $4 VAT; we still net ~$19.02 and the $4 is remitted to HMRC.
2. **The burden is registration + filing, not arithmetic.** Stripe Tax is supported for businesses
   based in **Hong Kong** (Stripe lists HK among the APAC locations where it can collect tax).
   - **Tax Basic** — automatic calculation/collection only.
   - **Tax Complete** — adds threshold monitoring, registrations and filings in 90+ countries.

**Decision 13: Stripe Tax Complete** — threshold monitoring, registrations and filings, not merely
calculation. Given §3.2 (non-resident registration can be owed from the first sale in several target
markets), the filing automation is the part worth paying for.

We will set the product's tax code to a **digital services / electronically supplied services** code so
the correct rules apply, and enable Stripe Tax on Checkout.

### 3.3 Refunds

- Stripe charges no additional fee to issue a card refund; note the **original processing fee is
  generally not returned** — confirm current policy in your dashboard.
- Refund policy itself is a product decision I have **not** assumed. Given decision **A** (card on
  file, charge at day 15), I'd suggest a simple, generous, self-serve one: **cancel any time from the
  Portal, and refund within 14 days of a renewal on request.** Say the word and I'll put it in the
  pricing page + terms.

---

## 4. Card data & PCI — "do we store credit cards?"

**Short answer: no, and we must never.** Stripe stores them; we hold only an opaque ID.

- We use **Stripe-hosted Checkout**, so the card fields are on Stripe's page, not ours. Card numbers,
  CVV and expiry are submitted **directly to Stripe** and never touch our CloudFront, our Lambda, or
  DynamoDB.
- That keeps us in **PCI DSS SAQ A** — the lightest self-assessment, for merchants who outsource all
  cardholder-data functions to a validated third party and "do not store, process, or transmit any
  cardholder data in electronic format."
- Stripe is a **PCI DSS Level 1** certified service provider — the highest level. This is exactly how
  essentially every SaaS handles cards, and it is the safe answer to your question.

**What we will store** (all non-sensitive, all safe):

| Field | Example | Purpose |
|---|---|---|
| `stripeCustomerId` | `cus_…` | links our user to Stripe |
| `stripeSubscriptionId` | `sub_…` | current subscription |
| `subscriptionStatus` | `trialing` / `active` / `past_due` / `canceled` | entitlement source of truth |
| `currentPeriodEnd` / `trialEndsAt` | ISO date | show renewal date |
| `cancelAtPeriodEnd` | bool | "cancels on …" copy |
| `cardBrand`, `cardLast4`, `cardExpMonth`, `cardExpYear` | `visa`, `4242`, `4`, `2029` | billing UI — **last4 is explicitly permitted** |

**What we must never store or log:** full card number (PAN), CVV/CVC (nobody may store this
post-authorisation), magnetic-stripe/EMV data, or raw webhook bodies containing any of the above.
Logging rule for the new Lambda: **log the Stripe event `id` and `type`, never the payload.**

---

## 5. Stripe account setup (Hong Kong) — step by step

Do all of this in **test mode first**; §8.3 repeats the live steps.

1. **Create the account** at <https://stripe.com> → country **Hong Kong SAR**, account type
   **Individual / sole proprietor** (decision 11 — **verify this option is offered**, §0.2 item 1).
2. **Business details:** legal name, **HKID**, business address, website
   `https://octavlearning.com`, industry **Education / Software**, and a description of the service
   (digital subscription study platform).
3. **Verify identity** — expect to upload **HKID**, plus proof of address. Approval is usually quick
   but can take a few days.
4. **Bank account for payouts** — add your HK bank account. For decision 12, add the **HSBC HK USD
   line** and confirm Stripe will pay out USD to it (§0.2 item 2). If Stripe rejects a non-US USD
   account, either settle **HKD** (fallback: ~2% conversion) or add a US-based USD account.
5. **Enable 2FA** and add any team members.
6. **Create the Product + Prices** (test mode): Product `Octav Learning Premium`; two recurring
   prices — **$20 USD monthly**, **$200 USD yearly**. Copy the `price_…` IDs.
7. **Enable Stripe Tax:** Dashboard → Tax settings; set the product's tax code to a digital-services
   code; start with calculation enabled and decide Basic vs Complete (decision **D**).
8. **Configure the Customer Portal:** allow **cancel**, **switch plan (monthly ↔ annual)**, and
   **update payment method**; set branding and the return URL.
9. **Configure Billing emails:** trial-will-end reminder, successful payment, failed payment,
   cancellation. These are the emails that make decision **A** safe.
10. **Add the webhook endpoint:** `https://octavlearning.com/api/subscriptions`, and select the
    events in §6.4. Copy the **signing secret** (`whsec_…`).
11. **Test:** Stripe CLI (`stripe listen --forward-to localhost:3000/api/subscriptions`) plus
    `stripe trigger …` for each event. Use test cards (`4242…` success, `4000 0000 0000 0341`
    attaches but fails on charge).
12. **Go live:** repeat steps 6–10 in **live mode** (price IDs differ!), then set the secrets in
    §6.7 and deploy.

---

## 6. Architecture

### 6.1 Constraint that shapes everything: prod is a static export

There is no Next.js server in production — `out/` is served from S3 behind CloudFront, and every API
is a **Lambda behind a CloudFront behaviour**. So the new subscription API must follow the existing
pattern (feedback / auth / progress / leaderboard / contact), not be a Next route handler.

**Second constraint — dev and prod share the same Lambda.** Per `AGENTS.md`, both CloudFront
distributions proxy `/api/*` to the **same** Lambda functions and the same Terraform module. That means
a single `subscriptions` Lambda serves `dev.octavlearning.com` **and** `octavlearning.com`.

> **Design decision (important):** store **both** key sets in the one secret and **select by request
> origin** — `dev.octavlearning.com` → **test** keys; `octavlearning.com` → **live** keys. Add a hard
> assertion that a dev-origin request can never resolve the live key, and log the selected mode.
> Without this, either dev can charge real cards or prod can't take real money.

### 6.2 Endpoints

All under the new CloudFront behaviour **`/api/subscriptions`** + `/api/subscriptions/*`
(exact path matters — the Checkout success POSTs to the bare path), listed **before** `/api/*`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/subscriptions/checkout` | session | Create a Checkout Session (plan = monthly/annual); returns `{ url }` |
| `POST` | `/api/subscriptions/portal` | session | Create a Customer Portal session; returns `{ url }` |
| `GET` | `/api/subscriptions/status` | session | Billing state for `/account` (plan, status, renewal date, card last4, trial end) |
| `POST` | `/api/subscriptions` | **Stripe signature** | Webhook receiver |
| `GET` | `/api/subscriptions/_health` | none | CI smoke probe (fixed-key read, 200 only) |

### 6.3 Data model

The user record (DynamoDB `octav-users`) gains — mirroring how `childProfiles` were added:

```ts
stripeCustomerId?: string;      // cus_…
stripeSubscriptionId?: string;  // sub_…
subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
subscriptionPlan?: 'monthly' | 'annual';
currentPeriodEnd?: string;      // ISO
trialEndsAt?: string;           // ISO
cancelAtPeriodEnd?: boolean;
cardBrand?: string; cardLast4?: string; cardExpMonth?: number; cardExpYear?: number;
```

`tier` stays the single entitlement source of truth and is derived:
`subscriptionStatus ∈ { trialing, active }` → `premium`; otherwise `free`.
**Trial users get premium** — that is the point of a trial, and the AI-mark quota logic
(`aiMarkQuotaForTier`) already keys off tier.

Per the standing convention, writes are **one conditional DynamoDB command** so replays are no-ops.

### 6.4 Webhook events

Handle: `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
`customer.subscription.trial_will_end` (→ trigger reminder / analytics event),
`invoice.payment_succeeded`, `invoice.payment_failed`.

Rules:

1. **Verify the signature** (`Stripe-Signature` header) before parsing — reject on failure.
2. **Idempotent by event id** — Stripe retries; a replayed event must not double-apply. Use a
   conditional write keyed on the event id (the progress-handler convention).
3. **Order-independent** — Stripe does not guarantee delivery order. Read current state from Stripe
   (or from the event's subscription object) rather than assuming an update sequence.
4. **Fail loudly, retry safely** — return non-2xx on unhandled errors so Stripe retries; return 200
   for events we intentionally ignore.

### 6.4.1 Tier sync, cancellation, and reconciliation

**Status → tier mapping** (single source of truth, server-side):

| `subscriptionStatus` | tier |
|---|---|
| `trialing` | **premium** |
| `active` | **premium** |
| `past_due` | premium (grace — Stripe is retrying; do not punish a failed card instantly) |
| `canceled`, `incomplete`, absent | **free** |

Note `cancel_at_period_end = true` does **not** change `status` — the subscription stays `trialing`
until the boundary. So a user who cancels on day 3 correctly keeps premium until day 14, and the
`customer.subscription.deleted` event at the boundary is what downgrades them. Access ends *because*
the subscription ended, not because we raced the cancel click.

**The failure mode to defend against:** a missed or failed webhook leaves a cancelled user on premium
forever (revenue leak, and the opposite of the dispute risk). Two mitigations:

1. **Stripe is the source of truth; DynamoDB is a cache.** `GET /api/subscriptions/status` re-reads
   from Stripe whenever the cached copy is **stale** — i.e. `trialEndsAt` or `currentPeriodEnd` is in
   the past — and writes the corrected state back. This self-heals after any webhook gap without
   needing a cron job.
2. **Idempotent handlers** (§6.4 rule 2) so Stripe's retries are harmless, plus alerting on repeated
   webhook failures.

### 6.5 Entitlement enforcement

- **Server-side is the only real gate.** The AI-marking quota (30/month free, 1000 premium) already
  checks server-side; E4 makes the tier it reads trustworthy.
- **Replace the client-side derivation.** `AGENTS.md` is explicit that E4 must replace
  `AuthContext.login`'s client-side tier derivation with the **server-provided `entitlements` list**
  from `me()`. Client gating (`EntitlementsContext.has()` + `LockedFeature`) stays UX-only.
- **Family coverage:** entitlement is read from the **parent account**, so every `childProfile`
  inherits it automatically — no per-profile entitlement rows (consistent with §0.1 #4 and the
  existing per-account AI quota).

### 6.6 Dummy dependency (repo convention)

The standing directive is that every external dependency gets a controllable dummy. So:

- `src/lib/subscriptions/deps.ts` — seam selecting `SUBSCRIPTION_STORAGE=dummy|dynamodb` and
  `STRIPE_MODE=test|live|dummy`, **fail-closed in Lambda** via the same `AUTH_ALLOW_DUMMY`-style guard.
- Dummy Stripe joins the **shared in-memory universe** (auth → progress → analytics → feedback →
  leaderboard → contact → subscriptions) so an e2e test can create a session, complete a checkout, and
  observe the tier flip without touching Stripe.
- Per-test injection for tier/status, matching `src/lib/feedback/dummy.ts`.

### 6.7 Terraform, CloudFront, secrets

- New **`terraform/modules/subscriptions_api`** — Lambda (`nodejs24.x`, provider pinned `~> 6.0`) +
  Function URL + least-privilege IAM: `GetItem`/`UpdateItem` on `octav-users`, session validation
  grants on users/sessions, and **no** `reserved_concurrent_executions` (the ap-east-1 quota is 10 and
  any reservation fails — existing rule).
- Function URL permissions need **both** `lambda:InvokeFunctionUrl` **and** `lambda:InvokeFunction`
  with `InvokedViaFunctionUrl`.
- `terraform/envs/prod`: CloudFront behaviours `/api/subscriptions` (exact) and
  `/api/subscriptions/*`, ordered **before** `/api/*`.
- Add the new Lambda to `scripts/build-lambdas.sh` (8 → 9 functions).
- New GitHub **secret** `STRIPE_ENV`, **single-line JSON with straight quotes** (Terraform parses it as
  HCL and rejects multi-line/curly quotes), e.g.
  `{"SECRET_KEY_TEST":"sk_test_…","SECRET_KEY_LIVE":"sk_live_…","WEBHOOK_SECRET_TEST":"whsec_…","WEBHOOK_SECRET_LIVE":"whsec_…","PRICE_MONTHLY_TEST":"price_…","PRICE_ANNUAL_TEST":"price_…","PRICE_MONTHLY_LIVE":"price_…","PRICE_ANNUAL_LIVE":"price_…"}`

### 6.8 DEV environment access control (allowlist)

**Motivation — bigger than Stripe.** The dev and prod distributions share the **same Lambdas and the
same DynamoDB tables**. Today anyone who finds `dev.octavlearning.com` can register and use the app
against **production data**. Putting live Stripe keys into that shared Lambda raises the stakes, so
this gate should land **before** E4.2.

**Rule.** On `dev.octavlearning.com`, `/api/*` serves only:

- `yong.ouyang@gmail.com`
- `evanling@gmail.com`
- `louise.rx.ouyang@gmail.com`
- `gzkerry@hotmail.com`

Every other request is rejected.

**How a handler knows it is DEV.** A CloudFront **viewer-request Function** on the dev distribution
sets `X-Octav-Env: dev` **unconditionally, overwriting any client-supplied value** — otherwise a client
could spoof the header to bypass the gate entirely. This mirrors the existing `api_host_header` Function
already used for analytics. One shared helper reads it; anything other than `dev` is treated as prod.

**What is gated**

| Request | DEV behaviour |
|---|---|
| Authenticated `/api/*` | session email must be in `DEV_ALLOWED_EMAILS`, else **403 `dev_allowlist`** |
| `POST /api/auth/request-otp` | `email` must be allowlisted, else **403** — non-staff can never obtain a dev session |
| `/api/auth/me` (no session) | unchanged **401** |
| `*/_health` probes | **open** — CI smoke and uptime checks must keep working |
| Analytics ingest + Contact POST (public, unauthenticated) | **open** (rate-limited). Gating is an option, but closing analytics ingest would also remove the dev/prod traffic split that the host-preserving Function exists to keep |

**CI smoke — the wrinkle.** `deploy-dev` currently asserts `POST /api/auth/request-otp` returns
**200/429** using the Resend probe address `delivered@resend.dev`. Under the gate that becomes **403**.
Recommended fix: keep **prod** asserting 200/429 and change the **dev** job to assert **403** — which
turns the smoke test into a positive check that the allowlist is actually live. Do **not** fix this by
adding the probe address to the allowlist; that reopens the hole the gate exists to close.

**Local dev and e2e are unaffected (the "smart" part).** The marker header is only set by CloudFront,
so `next dev`, the Next route handlers and `test:e2e` see no `X-Octav-Env` → treated as prod → no
allowlist. The guard is additionally inert whenever any dummy storage mode is active. **No test changes
and no local workflow changes needed.**

**Scope note.** This touches **every** `/api/*` Lambda (auth, progress, feedback, leaderboard,
analytics, contact, admin, subscriptions), so it belongs in **one shared helper** —
`src/lib/auth/dev-gate.ts`, called from the shared `resolveSession` path — not per handler. Small but
cross-cutting: its own commit, its own e2e coverage, and a decision on whether to surface a
"staging only" message in the UI.

---

## 7. Phase 2 (E5): server-served premium content

You chose to close the "premium JSON ships in the static export" risk rather than accept it. This is
the right call for a paid tier, but it is a **meaningful chunk of work that depends on E4 being done
first** — there is no point gating content until the entitlement signal is trustworthy. Sequencing it
as E5, immediately after E4.

**What moves server-side:**
- Paper sets **2+** per course (`src/content/data/papers/<courseId>/<courseId>-set-<n>.json`).
- Revision-ladder **levels 3–5**.
- Timed **mock** mode content.

**Sketch:**

- The premium JSON files are **excluded from the static export** (the `build-static.sh`/registry
  pipeline ships only set 1 and ladder 1–2 to `out/`).
- A new entitlement-checked endpoint (on the subscriptions Lambda or a sibling `content` Lambda)
  returns the requested set/level **only when the session resolves to `premium`**.
- `PaperRunnerClient` / ladder clients fetch at runtime instead of importing the JSON; the existing
  `LockedFeature` component becomes the loading/locked state.
- Keep the free-tier UX identical: set 1 and levels 1–2 remain static and instant.

**Risks to design around:** added latency and a network dependency in the exam flow (needs a loading
state and graceful failure); a new failure mode where a paying user is wrongly denied (mitigation:
fail **open** to a cached/entitled response if the entitlement read errors, and log loudly); and no
offline access to premium papers (acceptable — offline studying is a free-tier study-notes use case).

---

## 8. Testing, rollout, ops

### 8.1 Gates (unchanged, all must pass)

`npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run validate:content` ·
`npm run audit:content` · `npm run build:lambda` · `npm run build:static` (now incl.
`verify:sitemaps`) · `npm run test:e2e:static` · `terraform fmt -check` / `validate` / `plan`
(apply is CI-only) · `npm run security`.

Plus new unit tests: webhook signature rejection, idempotent replay, each event → correct tier
transition, dev-origin never resolves live keys, and dummy↔DynamoDB parity.

### 8.2 Stripe test mode

`stripe listen --forward-to localhost:3000/api/subscriptions` + `stripe trigger` for every event in
§6.4. Explicitly test: trial start → trial-will-end → conversion; card declined at conversion;
cancel mid-trial; cancel after renewal; annual↔monthly switch.

### 8.3 Rollout

1. Land E4 behind the dummy/inert path (no UI entry point) — deploy is safe.
2. Add the `/account` billing section + pricing-page CTAs, still against **test** keys in prod? **No** —
   test keys in prod would take no real money and silently do nothing for real users. Instead: ship
   with live keys *and* the real Stripe account verified, but soft-launch the CTA to yourself first.
3. Self-purchase a monthly plan, confirm the tier flip, AI-mark quota lift, and premium surfaces.
4. Cancel via Portal, confirm the downgrade to free.
5. Announce.

### 8.4 Ops

- **Stripe Dashboard is the source of truth for money disputes** — set email alerts for failed
  payments and disputes.
- Add an analytics event for `subscription_started` / `subscription_canceled` so the daily report can
  show MRR movement.
- Add `/api/subscriptions/_health` to the CI smoke checks alongside the existing
  `/api/progress/_health`, `/api/contact/_health`, `/api/auth/me`.

---

## 9. Phasing

| Phase | Scope | Depends on |
|---|---|---|
| **E4.0** | Stripe account setup (§5) — **you**; confirm §0.2 items 1–3 | — |
| **E4.1** | **DEV access control (§6.8)** — shared gate + CloudFront Function + CI smoke change | — |
| **E4.2** | Data model + `subscriptions` Lambda + CloudFront + secrets + dummy + `_health` | E4.0 |
| **E4.3** | Checkout + Portal + `/account` billing section + pricing CTAs | E4.2 |
| **E4.4** | Webhook handling, idempotency, tier sync, replace client-side tier derivation | E4.2 |
| **E4.5** | Test-mode verification, live soft-launch, analytics + alerts | E4.3, E4.4 |
| **E5** | Server-served premium content (§7) | E4.4 |

**Recommended order: E4.1 before E4.2.** The gate closes a hole that exists **today** (dev writes to
production tables), it is small, and it means live Stripe keys only ever land in an environment that is
already restricted. E4.0 (your Stripe setup) can run in parallel since it needs no code.

**Deferred:** §2.9 Feature/Entitlement tables + `/api/features` (your call, §0.1 #3).

---

## 10. Sources

- Stripe HK pricing: <https://stripe.com/en-hk/pricing> ·
  <https://stripe.com/en-hk/pricing/local-payment-methods>
- Stripe Tax: <https://stripe.com/en-hk/tax> · <https://stripe.com/en-hk/tax/pricing> ·
  <https://docs.stripe.com/tax/supported-countries/asia-pacific>
- Checkout free trials: <https://docs.stripe.com/payments/checkout/free-trials>
- PCI SAQ A: <https://www.pcisecuritystandards.org/documents/SAQ_A_v3.pdf>
- Multi-currency settlement (HK): <https://docs.stripe.com/payouts/multi-currency-settlement>
