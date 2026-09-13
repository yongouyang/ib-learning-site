# Stripe integration — Embedded Checkout with Managed Payments

**This file is the single source of truth for what is left to do.** Everything
under *What is already done* is implemented and tested; everything under
*Your manual steps* is yours.

---

## What is already done

**Scenario A** — the repository already had a Checkout Session call
(`StripeRestClient.createCheckoutSession`), so the integration is a change to that
one call plus the client wiring. No new route, no refactor, no new dependency
(Stripe.js is loaded from Stripe's CDN, never bundled — PCI).

| Piece | Where |
|---|---|
| Session created with `ui_mode=embedded_page`, Managed Payments ON, all Checkout Studio fields | [src/lib/subscriptions/stripe-rest.ts](src/lib/subscriptions/stripe-rest.ts) |
| `POST /api/subscriptions/checkout` → `{ client_secret }` (JSON, not a redirect) | [src/lib/subscriptions/http-handler.ts](src/lib/subscriptions/http-handler.ts) |
| Stripe's checkout mounted in the page, secret fetched by Stripe when it needs it | [src/components/BillingPanel.tsx](src/components/BillingPanel.tsx) |
| Stripe.js loaded from Stripe's own domain, in the document head | [src/app/layout.tsx](src/app/layout.tsx) |
| Entitlement granted (unchanged, already live) | webhook → `POST /api/subscriptions` |

### Configured parameters (`fixed_by_ui`, set exactly as configured)

**File:** [src/lib/subscriptions/stripe-rest.ts](src/lib/subscriptions/stripe-rest.ts)

| Parameter | Value |
|-----------|-------|
| `ui_mode` | `embedded_page` — see the constraint below for why not `form` |
| `billing_address_collection` | `auto` |
| `phone_number_collection` | `{ enabled: false }` |
| `automatic_tax` | `{ enabled: true }` |
| `payment_method_collection` | `always` (included because `mode` is `subscription`) |
| `submit_type` | `auto` |
| `integration_identifier` | `custom_embedded_web_0001` |
| `mode` | `subscription` — kept from your existing code (real value, not a placeholder) |
| `line_items[].price` | `this.priceIds[plan]` — real ids from `STRIPE_ENV`, no `price_...` literals |
| `managed_payments` | `{ enabled: true }` — **required** for the next section |
| API version | `Stripe-Version: 2026-03-25.dahlia` (no beta flag) |
| `appearance` | **deliberately NOT sent** — embedded checkout rejects it: *“Invalid initEmbeddedCheckout(options) parameter: appearance is not an accepted parameter”* (measured in a real browser). Colours/logo/fonts come from Checkout Studio + Dashboard → Settings → Branding. |

Removed because Stripe **rejects** them for this UI mode (measured — the API names
the parameter): `success_url`, `cancel_url`. The post-payment destination rides on
`return_url` (`/account?billing=updated`).

`metadata` and `subscription_data.metadata` are still sent: the webhook attributes
a subscription to a user by reading `sub.metadata.userId`, and the 14-day
`trial_period_days` + `trial_settings.end_behavior.missing_payment_method=cancel`
are what make the no-surprise-charge guarantee work.

---

## ⚠️ The one constraint that shaped this integration

**The custom Checkout *Form* SDK (`ui_mode=form`) cannot be used with Managed
Payments.** Measured on your sandbox account (`acct_1UDQFaJb0a9Fh6tv`), not read
in a doc:

```
ui_mode=form        → 400 "Invalid ui_mode: form. Managed Payments currently only
                           supports ui_mode: hosted_page and ui_mode: embedded_page."
ui_mode=embedded_page → 200, managed_payments.enabled=true,
                           automatic_tax.liability.type="stripe"
ui_mode=hosted_page   → 200, managed_payments.enabled=true (returns a redirect url)
```

There is **no manual step that removes this** — it is Stripe-side. So the choice was:

* **`embedded_page` (what is implemented — recommended).** Stripe's checkout renders
  in an iframe **on your page**, Stripe stays the merchant of record and keeps
  handling tax, fraud and disputes. This is the closest thing to the original
  "embedded" request that is compatible with your account.
* `hosted_page` (alternative, one line). Change `ui_mode: 'embedded_page'` to
  `'hosted_page'` in `stripe-rest.ts`, send `success_url`/`cancel_url` instead of
  `return_url`, and have the client redirect to `session.url` instead of mounting
  Stripe.js. Simpler, but the customer leaves your site.
* `form` (what the Checkout Studio snippet assumed). Only possible with
  `managed_payments.enabled=false`, which makes **you** the merchant of record and
  makes indirect-tax registration/filing your job again. Not recommended given
  your requirements.

**Also note for Checkout Studio:** configure the Studio integration as an
**embedded page** variant, not the custom form — the Studio's live preview uses the
same API and will fail with the form type while Managed Payments is on.

---

## Your manual steps

### 1. Browser (publishable) key — DONE locally, one step left for prod

| Field | State | What to set |
|-------|-------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ in `.env.local` (test key) | — |
| GitHub environment `dev` → secret `STRIPE_PUBLISHABLE_KEY` | ✅ created by you | — |
| GitHub environment `prod` → secret `STRIPE_PUBLISHABLE_KEY` | ⏳ when you go live | the `pk_live_…` for the promoted account |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the deploy jobs' `env:` | ✅ wired | — |

It is a **browser** variable in Next.js, so the `NEXT_PUBLIC_` prefix is mandatory
and the secret key must **not** have it; and because Next inlines `NEXT_PUBLIC_*`
at **build** time, it is the deploy jobs' build — not the Lambda env — that needs it.

`ci.yml` now has (already committed):

```yaml
# deploy-dev: declares `environment: DEV`, so it can see that environment's secret
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY || '' }}
# deploy-prod: declares `environment: PROD`, same line
```

The names are **uppercase** (`DEV` / `PROD`) and must match the environments you
created — an environment name mismatch is the dangerous kind of wrong, because the
value simply comes through empty. Two defences against that: the deploy jobs declare
the environment at all (an environment secret is invisible without it), and the DEV
deploy job has an **`Assert the browser publishable key is wired` step that fails the
deploy** on an empty value — green CI with a dead checkout button is not acceptable.
PROD gets the same guard with the live-key promotion (it legitimately has no key
until then). GitHub creates the `PROD` environment on first use, so declaring it
before the secret exists is harmless.

**Verify:** run `node scripts/check-embedded-checkout.mjs` locally (step 5), or open
`/pricing` signed in on dev and click a plan — Stripe's checkout must appear **in the
page**, not as a redirect.

### 2. Confirm Managed Payments is on (and read what it commits you to)

Dashboard → **Settings → Managed payments** (`.../settings/managed-payments`).

It is on by default for new accounts and the session now sends
`managed_payments.enabled=true` **explicitly**, so the tax stance cannot drift if
the account default ever changes. What Stripe does for you in this mode: indirect
tax (sales tax, VAT, GST) **registration and filing** in 80+ countries, fraud
prevention, dispute management and transaction-level customer support — Stripe is
the merchant of record.

What stays yours even so:
* **Tax code on every product** — Managed Payments refuses a Checkout Session whose
  product has no tax code. Ours is **`txcd_20060058`** (“Training Services –
  Self-study Web-based”). Already applied to the test product; see step 4 for live.
* **Do NOT enable plan switching in the Customer Portal.** While Managed Payments is
  on, subscriptions may only be created through Checkout or Payment Links, so a
  Portal plan switch would create one outside that path. Cancel / update payment
  method / invoice history are all fine.
* Business details / statement-descriptor questions in the MP settings page, and
  whether MP's fee is worth it (see `docs/stripe-subscriptions-plan.md` §0.2 item 0).

### 3. Nothing to do for tax (that is the point of Managed Payments)

No registrations, no filings, no accountant hand-off for indirect tax. Confirm it
is really Stripe's liability rather than assuming it — this is the check your
account already passes:

```bash
curl -s https://api.stripe.com/v1/checkout/sessions -u "$STRIPE_TEST_SECRET_KEY:" \
  -d mode=subscription -d ui_mode=embedded_page \
  -d 'line_items[0][price]='"$STRIPE_TEST_PRICE_MONTHLY" -d 'line_items[0][quantity]=1' \
  -d 'managed_payments[enabled]=true' \
  -d return_url=https://dev.octavlearning.com/account -o /tmp/session.json
node -e "const s=require('/tmp/session.json');
  console.log('managed_payments:', s.managed_payments,'| tax liability:', s.automatic_tax?.liability?.type,
  '| client_secret:', Boolean(s.client_secret));"
# expect  managed_payments: { enabled: true } | tax liability: stripe | client_secret: true
```

### 4. Create the LIVE product and prices (test mode is already done)

Test mode already has “Octav Learning Premium” + `$20/month` + `$200/year` with the
tax code (created by `node scripts/stripe-sandbox.mjs setup`). **Live mode needs its
own objects** — products and prices are per-mode.

In the Dashboard (Test-mode toggle → **off**, then): Products → **Add product**
named “Octav Learning Premium”, add a recurring **$20 / month** price and a
recurring **$200 / year** price, then **Edit product → Tax code →
`txcd_20060058`** (Training Services – Self-study Web-based). Managed Payments
rejects a session whose product has no tax code, which is exactly how this bites
after everything else looks green.

Or via the API (same shape the sandbox script uses):
```bash
curl -s https://api.stripe.com/v1/products -u "$STRIPE_LIVE_SECRET_KEY:" \
  -d name='Octav Learning Premium' \
  -d description='Unlimited AI marking and the full exam tier.' \
  -d tax_code=txcd_20060058
# then, with the returned prod_… id:
curl -s https://api.stripe.com/v1/prices -u "$STRIPE_LIVE_SECRET_KEY:" \
  -d product=prod_… -d currency=usd -d unit_amount=2000 -d 'recurring[interval]=month'
curl -s https://api.stripe.com/v1/prices -u "$STRIPE_LIVE_SECRET_KEY:" \
  -d product=prod_… -d currency=usd -d unit_amount=20000 -d 'recurring[interval]=year'
```

### 5. Run the checkout once end-to-end locally (5 minutes)

**Automated browser-half check** (needs the publishable key from step 1):
```bash
node scripts/check-embedded-checkout.mjs
```
It signs in with the dummy OTP, creates a REAL test-mode session, and asserts the
session POST returns a `client_secret`, Stripe's iframe mounts, and the checkout
actually **renders** (plan, trial, card fields) — plus that Stripe.js raised no
`IntegrationError`. It also refuses to run against a `pk_live_` key, and it prints
the port-release state so a leaked dev server is visible instead of breaking the
next run. This is the check that caught `appearance` being rejected; the unit
tests cannot see it because they stub `window.Stripe`.

**Manual click-through:**
```bash
# 1. pk in .env.local (step 1), test keys already in STRIPE_ENV
AUTH_STORAGE=dummy AUTH_EMAIL=dummy AUTH_TEST_MODE=1 SUBSCRIPTIONS_STORAGE=dummy \
  STRIPE_MODE=test npm run dev
# 2. in a second terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/subscriptions
# 3. sign in at /login with any email + code 123456, then /pricing → click a plan
# 4. pay with 4242 4242 4242 4242, any future expiry, any CVC/postcode
```

Then `node scripts/stripe-sandbox.mjs check` proves the whole chain
(session → payment → webhook signature → subscription re-read → `tier=premium`).

### 6. Webhook endpoint for production (when you go live)

Dev already has a test-mode endpoint (`we_1UF8hiJb0a9Fh6tvXP0zUak5` →
`https://dev.octavlearning.com/api/subscriptions`). For live, create the same
endpoint in live mode with exactly these 7 events, and put its signing secret in
`STRIPE_ENV` as `WEBHOOK_SECRET_LIVE`:

```
checkout.session.completed            customer.subscription.deleted
customer.subscription.created         customer.subscription.trial_will_end
customer.subscription.updated         invoice.payment_succeeded
invoice.payment_failed
```

Reminder from a past incident: the `stripe listen` CLI secret and the endpoint
secret are **different values under the same env var name** — pasting the CLI's
into the deployed config silently 400s every delivery.

### 7. Go-live checklist (in order)

1. Activate the Stripe account (charges + payouts).
2. Step 4: live product + 2 prices **with the tax code**.
3. Live webhook endpoint + `WEBHOOK_SECRET_LIVE` (step 6).
4. `STRIPE_ENV` gains `SECRET_KEY_LIVE`, `WEBHOOK_SECRET_LIVE`,
   `PRICE_MONTHLY_LIVE`, `PRICE_ANNUAL_LIVE` (all four, or the key set is ignored).
5. `STRIPE_PUBLISHABLE_KEY` secret in the **prod** environment (step 1).
6. Flip the deferred `_health` gate so a deploy fails when the LIVE key set is
   incomplete, and add the prod webhook probe (tracked in `docs/PROGRESS.md`).
7. Deploy, then click through `/pricing` once with a real card (refund it).

### 8. Optional polish

* **Checkout appearance.** Not configurable from code — embedded checkout rejects
  an `appearance` option (verified in a real browser; the appearance docs describe
  the Elements API, not this SDK), so the palette that was configured in Checkout
  Studio must be reproduced in **Dashboard → Settings → Branding → Checkout**.
  Worth knowing: the rendered checkout is light, and the site has a dark theme, so
  in dark mode the iframe is a white card inside a dark panel.
* **Local-currency presentment is ON for this account** (`HKD`/`USD` selector in the
  rendered checkout, “Charges will vary based on exchange rates”). Decision 12
  settles on USD, so decide in the Dashboard whether customers may be charged in
  their local currency and who carries the FX (flagged in
  `docs/stripe-subscriptions-plan.md` §0.2).
* **Stripe.js is loaded site-wide** (one async request on every page, per the
  integration guide's `<head>` requirement). Scoping it to `/pricing` + `/account`
  is a small, safe follow-up if you care about the extra request.
* **Blocked Stripe.js.** Ad blockers block `js.stripe.com` for a minority of
  users; the panel then shows *“Couldn’t load the checkout”* after a bounded 5s
  wait (it cannot hang silently — that was a real defect found and fixed here).

### Test cards

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | succeeds (any future expiry, any CVC, any postcode) |
| `4000 0025 0000 3155` | requires 3-D Secure authentication |
| `4000 0000 0000 9995` | declined (insufficient funds) |
| `4000 0000 0000 0002` | declined (generic) |

### Resources

- <https://support.stripe.com>
- <https://docs.stripe.com/mcp>
- <https://docs.stripe.com/checkout/embedded/quickstart>
- <https://docs.stripe.com/js/embedded_checkout/create> (`createEmbeddedCheckoutPage`)
- <https://docs.stripe.com/payments/checkout/customization/appearance>
- Internal: `docs/stripe-subscriptions-plan.md`, `docs/entitlement-policy.md`
