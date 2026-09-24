# Re-opening PROD for sale — outreach pack and checklist

> **Status:** working document, engineering-authored, not legal advice. It exists so that the
> three user-owned items on `docs/privacy-notice-draft.md`'s review checklist (items **2** DPIA,
> **4** transfer mechanism, **10** Art 27 representative) can be started without re-reading the
> code. Nothing here changes what is published: `/terms` and `/privacy` are rendered from
> `docs/terms-of-use-draft.md` and `docs/privacy-notice-draft.md`, and those two files remain the
> single source of truth for what the site says. **Do not duplicate clause text here** — quote a
> section number and link the file.

Production is currently **off sale** and nothing else is blocking it: `BILLING_DISABLED_ENVS = "prod"`
in `terraform/envs/prod/main.tf` makes `POST /api/subscriptions/checkout` answer
`503 billing_disabled`, `GET /status` report `billingAvailable: false`, and `BillingPanel` skip
loading Stripe.js entirely. Content, entitlements, the content API boundary and the deploy
pipeline are all shipped and verified. **Re-opening is one line plus a deploy — the reason not to
delete it yet is the legal chain below, not a technical gap.**

---

## 1. Who needs to do what

| # | Item | Owner | Blocking what |
|---|---|---|---|
| 1 | **EU + UK Art 27 representatives** — appoint and name | user (commercial decision) | §1 of the notice; EU/UK customers |
| 2 | **DPA/SCCs (or replacement) with the AI-marking provider** | user (contract) | §8 item 1 — the PRC transfer of a child's free text |
| 3 | **DPIA** — children's data + AI free-text + leaderboard visibility + analytics | user + engineering input | not legally a publication gate, but it must exist before scaling |
| 4 | **Counsel pass** on the published positions | user | the two reversals below |
| 5 | Delete `BILLING_DISABLED_ENVS` and deploy | engineering | revenue |

## 2. Art 27 representative — what to buy, and what to ask

The obligation applies because the controller is established outside the EU/UK and offers the
Service to people in them (GDPR Art 27; UK GDPR Art 27). The published §1 currently says nothing
about a representative — **an omission chosen deliberately so the notice stays true** — so
appointing one is an *addition* to §1 plus the two obligations that come with the role:

- **Records of processing** (Art 30(4)-style) must be kept for the representative to point at.
  This repo has no RoPA; the field list at the top of `docs/privacy-notice-draft.md` plus §3/§4/§6
  and the DynamoDB retention table are the raw material, so the RoPA is a document task, not a
  code task.
- **The representative must be named in the notice, and reachable by data subjects and
  supervisory authorities** — an address (or equivalent) that is not a generic support inbox.

Questions to put to a candidate (all three of the compared providers answer these in writing):

1. Which territories do you cover — EU only, UK only, or both, and are the two contracts separate
   (they are separate regimes: an EU representative does not discharge the UK one)?
2. Are you named as the representative on our behalf in the notice, and is the published contact
   address a real monitored channel?
3. Do you handle data-subject requests directly, and what is the SLA before it reaches us? (Our
   own rights workflow is `/account` → export and delete, plus `info@octavlearning.com`.)
4. Do you maintain the Art 30 records, or do we supply them? In what format?
5. Are you a joint controller for anything, or strictly an Art 27 representative (the answer must
   be the latter — a representative must not become a second controller)?
6. **Do you have a relationship with Stripe / Resend / AWS that conflicts?** We already rely on
   their DPAs; a representative should not silently become a fourth processor of the same data.
7. Price, term, and what happens on termination (the notice must stop naming you the day the
   contract ends).

**Cheap alternative worth pricing:** the EU/UK Art 27 duty attaches to the *controller*. If a
UK/EU entity is ever incorporated (checklist item 11 anticipates this), the obligation disappears
for that territory — so the decision is "buy a representative now" vs "bring the incorporation
forward", and only the first is available today.

## 3. The AI-marking provider — the DPA/DPS request

§8 item 1 is the most sensitive transfer in the notice: **a child's free-text answer sent to a
provider established in the PRC**, with no adequacy decision and currently *no instrument we can
point to*. §8 says exactly that ("made under that provider's standard terms, and we do not claim
a data-processing addendum with that provider that we cannot point to") — which is honest, and is
the reason this is the highest-value contract to obtain.

Send the provider these questions verbatim; each one is a sentence in §8 or §9 that would change
if the answer is yes:

1. **Do you offer a data-processing addendum (DPA) for API customers, and does it incorporate the
   EU Standard Contractual Clauses (2021/914) and the UK Addendum?** If a DPA exists but the SCCs
   are not incorporated, say so — that is the difference between an instrument we can name and one
   we cannot.
2. **Can the SCCs be signed as a standalone module** (processor-to-controller, Module 2/3) if the
   DPA does not incorporate them?
3. **Where is inference performed, and is the data stored?** §9 currently states nothing is
   persisted by us beyond the quota counter; §8 should be able to say where the request lands.
   If prompts or answers are retained for abuse monitoring or training, §9 gains a retention row
   and §8 gains a location — **that changes the published text and must be re-verified either
   way.**
4. **Is the data used for model training by default, and is there an opt-out?** A default-on
   training clause is the difference between "processed to answer your question" and "used for
   our own purposes", and it changes the lawful-basis wording in §4.
5. **Do you support a zero-retention or no-training endpoint** (many providers have one), and is
   it configured per request or per account?
6. **What sub-processors do you use**, and do you notify before changing them?
7. **What are your breach-notification terms** — how many hours to notify us? We are the
   controller and §4/§11 make promises that depend on this number.
8. **Do you have an EU or UK establishment or representative?** If so, the transfer analysis gets
   simpler and §8 can say so.

**If the answers are "no DPA, default training, retained prompts", the cheaper path is to switch
provider**: `src/lib/feedback/deps.ts` selects the provider from `FEEDBACK_ENV`, so moving to a
provider with a signable DPA is a secret change plus one deploy, and the two files that must then
be edited together are §7/§8 of the notice plus the DeepSeek name at checklist item 7.

## 4. DPIA — the parts engineering can supply now

Item 2 on the notice checklist says the DPIA is **required and not started**. The inputs that
already exist in the repo, by section:

| DPIA input | Where it already lives |
|---|---|
| What is collected, field by field | `docs/privacy-notice-draft.md` §3 + the "field list verified against the code" note at the top of that file; sources: `src/lib/auth/types.ts`, `src/lib/progress/*`, `src/lib/analytics/http-handler.ts`, `src/lib/leaderboard/*`, `src/lib/contact/*`, `src/lib/subscriptions/*`, `src/lib/auth/session.ts` |
| Retention per store | `terraform/modules/dynamodb/main.tf` (TTLs) and §9, including the 35-day PITR window decided 2026-09-17 |
| Children's-data risk | §5 (16+, or parent/guardian-held); §5.4's decision and the AADC question are item 1 on the checklist |
| AI free-text flow | §6.3 + §13; provider selection in `src/lib/feedback/deps.ts`; the monthly AI-mark quota in `src/lib/entitlements/features.ts` |
| Leaderboard child-visibility | §6 (opt-in per child profile, `childProfiles[i].leaderboardOptIn`), handle generation in `src/lib/leaderboard/handles.ts` — **pseudonymous, and opt-in is the mitigation to record** |
| Analytics | `src/lib/analytics/http-handler.ts`, 90-day raw TTL, 400-day aggregates |
| Cookie inventory | §12, re-measurable with `node scripts/verify-checkout-cookies.mjs` |
| Premium attribution marker | §6.5 + §9 + `handlePremiumPaperGet`; masked email + 10-hex account ref, **nothing persisted** |
| Deletion path | `/account` export/delete, `listProgressByUser` pagination, the auth erasure of leaderboard rows — §10 rights |

The DPIA itself is a judgement document (likelihood × severity, mitigations, residual risk,
sign-off). The table above is the factual half; **it is not a substitute for one.**

## 5. Re-open-the-shop checklist (in order)

1. Items 1–4 above closed, or consciously waived in writing by the owner.
2. Delete the `BILLING_DISABLED_ENVS = "prod"` line in `terraform/envs/prod/main.tf`, commit, push
   to `main` (one line, no other change).
3. **Deploy-prod's own gates do the rest** — do not skip them: the `_health` probe requires the
   LIVE key set for a request carrying `X-Octav-Env: prod`, the job asserts
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is `pk_live_…`, and `scripts/webhook-probe.mjs` runs
   `STRIPE_PROBE_MODE=live` with a per-price **tax-code** assertion (Managed Payments refuses a
   session whose product has no tax code — the failure mode that looks green everywhere else).
4. Verify on the live origin, not in the repo (the 2026-09-23 lesson):
   `curl -s https://octavlearning.com/api/subscriptions/status` while signed in must report
   `billingAvailable: true`, `/pricing` must mount the embedded checkout rather than "coming
   soon", and `POST /api/subscriptions/checkout` must no longer answer 503 `billing_disabled`.
5. Confirm the live product has the tax code **`txcd_20060058`** and that the seven webhook
   events are subscribed in LIVE mode (list in `STRIPE_INTEGRATION_TODO.md` step 6) — a missing
   live webhook means subscriptions exist but `tier` never flips.
6. Re-read §8 and §9 against whatever the provider answered, and update both files together with
   the Terraform retention if anything moved.
7. Only then announce. `docs/privacy-notice-draft.md` item 9 is still open and is **legally the
   more important half of "published"**: the privacy link at signup and at checkout (the latter is
   a Stripe Dashboard setting, not code).

## 6. What is NOT a blocker (checked, so it does not get re-litigated)

- **Server-side premium content, entitlements and the content API boundary** — shipped and pinned
  by `tests/unit/content-iam.test.ts` (the premium/public cache split) and `npm run audit:leaks`,
  which runs inside `build:static` for both deploys.
- **Tier derivation, quotas, trials, the DEV allowlist** — E4 code shipped; `withTierDefault` fails
  closed, so a manual DDB grant is the only way in until checkout returns.
- **The tax position** — Stripe is the merchant of record under Managed Payments
  (`automatic_tax.liability.type = "stripe"`), so indirect-tax registration and filing are
  Stripe's. The open question is only whether Stripe is a processor or an independent controller
  for that transaction (notice checklist item 3, "counsel to confirm").
- **Data residency** — storage is ap-east-1 by design and §8 states it; nothing needs to move.
