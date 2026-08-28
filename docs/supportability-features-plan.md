# Supportability Features — Implementation Plan

> **Status:** Implemented — Feature 2 (2026-08-23), Feature 1 (2026-08-24), Feature 3 (2026-08-25). Remaining: the manual CloudFlare Email Routing step (Feature 3) and post-deploy verification.
> Three independent features to improve day-to-day operations and user support:
> 1. **Daily analytics report** — emailed HTML snapshot of the admin dashboard at 7pm HKT
> 2. **DynamoDB CRUD dashboard** — admin web UI for browsing/editing all DynamoDB tables
> 3. **Contact Us** — floating help button + form that stores messages and emails the admin

---

## Feature 1 — Daily Analytics Report (7pm HKT)

**Objective:** Every day at 7pm HKT, receive an HTML email with the key analytics
metrics for the last 24 hours (prod only), without needing to log into the
admin dashboard.

### Architecture

```
EventBridge (cron: 0 11 * * ? *) → Lambda: octav-analytics-report
                                       │
                                       ├─ DynamoDB octav-analytics-events (aggregates only)
                                       └─ Resend → ANALYTICS_ADMIN_EMAIL
```

- **Trigger:** EventBridge scheduled rule, `cron(0 11 * * ? *)` = 11:00 UTC = 19:00 HKT
- **Lambda** `lambda/analytics-report/index.ts` — queries the daily aggregate rows
  (`k="agg"`, `s BETWEEN <24h-ago> AND <now>`) from `octav-analytics-events` for
  `host = "octavlearning.com"` only, generates an HTML email, and sends via Resend
- **IAM:** `dynamodb:Query` on `octav-analytics-events` + SSM access for Resend API key
- **Email recipient:** `ANALYTICS_ADMIN_EMAIL` (GitHub Actions variable, already
  wired into the analytics summary endpoint)

### Report content (HTML email)

Mirrors the `/admin/analytics` dashboard layout:

| Section | Content |
|---|---|
| Header | "Octav Analytics — <date> (last 24h, prod)" |
| DAU | Unique daily active users |
| Events | Totals per event type (page_view, quiz_completed, exam_completed, paper_marked_with_ai, etc.) |
| Subjects | Breakdown by subject (quiz/exam/diagnostic completions) |
| AI marks | Total AI marks used this period |
| Devices | Mobile vs desktop split |
| Top pages | Top 10 paths by page_view |

### Implementation phases

#### R1 — Lambda handler core
- `lambda/analytics-report/index.ts`: thin adapter that calls the shared handler
- `src/lib/analytics-report/http-handler.ts`: queries DynamoDB aggregates,
  builds HTML, sends via Resend
- `src/lib/analytics-report/deps.ts`: environment wiring (ANALYTICS_ADMIN_EMAIL,
  Resend config, DynamoDB client)
- Unit tests: storage query + HTML generation + email sending

#### R2 — Terraform
- New module `terraform/modules/analytics_report`:
  - Lambda function (nodejs24.x, `lambda/analytics-report/dist/`)
  - IAM role: `dynamodb:Query` on `octav-analytics-events`, Resend API key access
  - EventBridge rule (`cron(0 11 * * ? *)`) + target + Lambda permission
  - CloudWatch log group (14-day retention)
- Wire into `terraform/envs/prod/main.tf`

#### R3 — build:lambda + CI
- Add `analytics-report` to `scripts/build-lambdas.sh`
- CI deploy job: build + terraform apply (no CloudFront behavior needed — this
  Lambda has no Function URL, it's invoked by EventBridge only)

---

## Feature 2 — DynamoDB CRUD Dashboard

**Objective:** An admin-only web page that lets you browse, query, and edit all
DynamoDB tables (`octav-*`) without using the AWS Console. Authenticated by the
same session + `ANALYTICS_ADMIN_EMAIL` check as the analytics dashboard.

### Architecture

```
Browser: /admin/dynamodb (static page, client-side fetch)
    │ POST /api/admin/dynamodb (session + admin email check)
    ▼
CloudFront /api/admin/* behavior (before /api/*) ──► Lambda: octav-admin
    │                                                    │ shared handler: src/lib/admin/http-handler.ts
    │                                                    │ (dev/e2e: Next route src/app/api/admin/dynamodb/*)
    ▼                                                    ▼
DynamoDB (all octav-* tables — full CRUD via AWS SDK)
```

### API surface

Single endpoint `POST /api/admin/dynamodb`:

```
Request:  { operation, table, key?, expression?, expressionValues?, item?, limit? }
Response: { result }  (shape depends on operation)
```

| Operation | Request fields | Response |
|---|---|---|
| `listTables` | (none) | `string[]` of table names |
| `scan` | `table`, `limit?` | `{ items, count, lastEvaluatedKey? }` |
| `query` | `table`, `expression`, `expressionValues`, `limit?` | `{ items, count, lastEvaluatedKey? }` |
| `get` | `table`, `key` | `{ item }` |
| `put` | `table`, `item` | `{ success: true }` |
| `update` | `table`, `key`, `expression`, `expressionValues` | `{ success: true }` |
| `delete` | `table`, `key` | `{ success: true }` |

Auth: session cookie required → resolve email → check against
`ANALYTICS_ADMIN_EMAIL` (comma-separated, same as analytics summary). 403 if not
admin.

### Dashboard page (`/admin/dynamodb`)

- **Table selector** — dropdown populated via `listTables`, filtered to `octav-*`
- **Operation selector** — Scan / Query / Get / Put / Update / Delete
- **Key input** — JSON textarea for Get/Update/Delete key
- **Query builder** — KeyConditionExpression + ExpressionAttributeValues (JSON)
- **Item editor** — JSON textarea for Put/Update item data
- **Results** — scrollable table (first 50 items, with pagination via
  LastEvaluatedKey)
- **Layout** — consistent with `/admin/analytics` (card-based, responsive)
- **Access** — no nav link; reachable only by typing the URL

### Implementation phases

#### D1 — Shared handler + deps
- `src/lib/admin/deps.ts`: DynamoDB client + admin email check
- `src/lib/admin/http-handler.ts`: `POST /api/admin/dynamodb` handler
  (auth gate → validate operation → call DynamoDB SDK → return result)
- Unit tests: auth gate, operation validation, DynamoDB call shapes

#### D2 — Next.js route + Lambda
- `src/app/api/admin/dynamodb/route.ts`: wraps the shared handler
- `lambda/admin/index.ts`: Lambda entry point
- `src/app/admin/dynamodb/page.tsx`: the dashboard UI
- E2E tests: admin access, non-admin 403, CRUD operations

#### D3 — Terraform
- New module `terraform/modules/admin_api`:
  - Lambda function (nodejs24.x)
  - IAM role: `dynamodb:Scan|Query|GetItem|PutItem|UpdateItem|DeleteItem` on all
    `octav-*` tables (explicit resource ARNs)
  - Function URL with CORS for dev + prod origins
- CloudFront behavior: `/api/admin/*` → admin Lambda (listed BEFORE `/api/*`)
- `_health` smoke probe in CI

#### D4 — build:lambda + CI
- Add `admin` to `scripts/build-lambdas.sh`
- CI: build + terraform apply + `_health` smoke

---

## Feature 3 — Contact Us

**Objective:** A floating "Help" button that lets any user (logged in or not)
send a message to the admin. Messages are persisted in DynamoDB and emailed via
Resend.

### Architecture

```
Browser: ContactButton (floating bottom-left, modal form)
    │ POST /api/contact (rate-limited, public)
    ▼
CloudFront /api/contact/* behavior (before /api/*) ──► Lambda: octav-contact
    │                                                       │ shared handler: src/lib/contact/http-handler.ts
    │                                                       │ (dev/e2e: Next route src/app/api/contact/*)
    ▼                                                       ▼
DynamoDB octav-contact (persist) + Resend → ANALYTICS_ADMIN_EMAIL
```

### API surface

`POST /api/contact`:
```
Request:  { name, email, subject, message }
Response: { success: true }
```

- **Rate limit:** per-IP fixed-window budget in `octav-rate-limits`
  (bucket `contact:<ip>:<epoch>`, 3 requests/hour, 429 on exceed)
- **Validation:** name (1–100 chars), email (valid format), subject (enum:
  `bug_report`, `feature_request`, `question`, `other`), message (1–2000 chars)
- **Side effects:** PutItem in `octav-contact` + Resend email to
  `ANALYTICS_ADMIN_EMAIL`

### Data model — `octav-contact`

| Attribute | Type | Description |
|---|---|---|
| `messageId` (PK) | S | UUID v4 |
| `name` | S | User-provided name |
| `email` | S | User-provided email |
| `subject` | S | One of the enum values |
| `message` | S | Message body |
| `userId` | S | Nullable — set when user is logged in |
| `createdAt` | S | ISO-8601 timestamp |
| `status` | S | `"new"` (default), `"read"`, `"replied"`, `"spam"` |
| `expiresAt` | N | TTL (createdAt + 365 days) |

### Frontend (`ContactButton`)

- **Position:** fixed bottom-left (`bottom-20 left-4 md:bottom-4`), above the
  mobile nav, below the floating account/theme cluster on mobile
- **Appearance:** circular button with "?" icon, subtle "Help" label on hover
- **Modal:** slides up from bottom on mobile, centered dialog on desktop.
  Fields:
  - Name (text input, pre-filled if logged in)
  - Email (text input, pre-filled if logged in)
  - Subject (dropdown: "Bug Report", "Feature Request", "Question", "Other")
  - Message (textarea, 2000 char limit with counter)
  - Submit button (with loading state)
- **States:** idle → submitting → success toast / error toast
- **a11y:** focus trap in modal, labelled inputs, aria-live region for
  success/error

### CloudFlare Email Routing (manual step)

The user needs to perform this one-time setup in CloudFlare so that
`info@octavlearning.com` forwards to their personal email:

1. Log into [CloudFlare Dashboard](https://dash.cloudflare.com)
2. Select `octavlearning.com`
3. Go to **Email** → **Email Routing**
4. Click **Enable Email Routing** (CloudFlare adds the necessary MX records
   automatically)
5. Under **Routes**, click **Create address**
6. Custom address: `info@octavlearning.com`
7. Destination: your personal email (e.g. Gmail)
8. Click **Save**

After this, anyone emailing `info@octavlearning.com` directly will have their
message forwarded to your inbox. The contact form on the website is a separate
path (API → Resend → your admin email) and does not depend on this setup.

### Implementation phases

#### C1 — Shared handler + deps
- `src/lib/contact/deps.ts`: DynamoDB client (octav-contact + rate-limits),
  Resend sender, admin email
- `src/lib/contact/http-handler.ts`: `POST /api/contact` (validate → rate-limit
  → persist → email → respond)
- Unit tests: validation, rate limiting, storage, email

#### C2 — Next.js route + Lambda
- `src/app/api/contact/route.ts`: wraps the shared handler
- `lambda/contact/index.ts`: Lambda entry point

#### C3 — Frontend component
- `src/components/ContactButton.tsx`: floating button + modal form
- Wire into `src/app/layout.tsx`
- E2E tests: form submit, validation errors, rate limiting, success flow

#### C4 — DynamoDB table
- Add `octav-contact` table definition to `terraform/modules/dynamodb`:
  - PK: `messageId` (String)
  - TTL: `expiresAt`
  - On-demand billing

#### C5 — Terraform (contact API)
- New module `terraform/modules/contact_api`:
  - Lambda function
  - IAM role: `dynamodb:PutItem` on `octav-contact`,
    `dynamodb:GetItem|UpdateItem` on `octav-rate-limits`, Resend API key access
  - CloudFront behavior: `/api/contact/*` → this Lambda
  - CloudWatch log group

#### C6 — build:lambda + CI
- Add `contact` to `scripts/build-lambdas.sh`
- CI: build + terraform apply + smoke

---

## Implementation Order

| Order | Feature | Rationale |
|---|---|---|
| 1 | Feature 2 — CRUD Dashboard | Establishes the admin Lambda + API pattern; most complex; useful for debugging the other two features |
| 2 | Feature 1 — Analytics Report | Reuses email-sending pattern; adds EventBridge scheduling |
| 3 | Feature 3 — Contact Us | New table + Lambda + frontend component; CloudFlare setup is manual and independent |

## Infrastructure summary

| Component | New Lambda | New DynamoDB table | CloudFront behavior | EventBridge |
|---|---|---|---|---|
| Analytics Report | `octav-analytics-report` | — | — | Yes |
| CRUD Dashboard | `octav-admin` | — | `/api/admin/*` | — |
| Contact Us | `octav-contact` | `octav-contact` | `/api/contact/*` | — |

**Total:** 3 new Lambdas, 1 new DynamoDB table, 2 new CloudFront behaviors,
1 EventBridge rule.

## Gates (per feature)

- `npm run validate:content` — no content changes expected
- `npm test` — unit tests for all new handlers
- `npm run build:static` — static export with new admin page
- `npm run build:lambda` — all Lambda bundles build
- `terraform validate` — infrastructure changes
- `npm run test:e2e` — smoke tests for CRUD dashboard admin access + contact form
- Manual: CloudFlare Email Routing (Feature 3 only)