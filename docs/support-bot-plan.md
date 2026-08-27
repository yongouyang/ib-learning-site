# Agentic Support Bot — Architecture & Implementation Plan

> **Status:** Draft — awaiting user decisions on open questions (§9) before implementation.
> **Last updated:** 2026-08-27

An agentic support bot that monitors user questions (contact form + email), platform stats, and error logs, then raises alerts with proposed resolutions through configurable delivery channels (email, webhook). Built entirely within the existing AWS Lambda + DynamoDB + Resend infrastructure and conventions established by the analytics-report and contact features.

---

## 1. Goal

Automate first-line operational awareness for Octav Learning:

- **Monitor** new contact-form messages, analytics anomalies, Lambda error logs, and (future) forwarded emails
- **Triage** each signal into a severity level with a proposed resolution
- **Alert** the admin via Resend email and/or webhook (Slack/Discord/Telegram/Teams)
- **Persist** every alert in DynamoDB so nothing is lost even if delivery fails
- **Deduplicate** so the same underlying issue doesn't generate repeated noise

The bot is a single EventBridge-scheduled Lambda — no new AWS services, no SQS/SNS/Step Functions. It follows the exact patterns established by `lambda/analytics-report` (scheduled, non-HTTP, deps seam, fail-closed).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES (read-only)                         │
│                                                                     │
│  octav-contact ──────────── new messages (status="new")             │
│  octav-analytics-events ─── aggregate anomalies (error spikes,      │
│                             traffic drops, AI-mark quota exhaust.)  │
│  CloudWatch Logs ────────── Lambda ERROR/WARN log events            │
│  info@octavlearning.com ─── CloudFlare Email Routing → personal     │
│                             inbox (manual step; see §3.4)           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ EventBridge cron (every N minutes)
                           ▼
              ┌────────────────────────┐
              │  Lambda:               │
              │  octav-support-bot     │
              │                        │
              │  1. Poll each source   │
              │  2. Deduplicate vs     │
              │     octav-support-alerts│
              │  3. Triage (rule-based │
              │     or LLM)            │
              │  4. Persist alert      │
              │  5. Deliver via        │
              │     Resend + webhook   │
              └───────────┬────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   octav-support-alerts        Delivery Channels
   (DynamoDB)                  ├─ Resend email → ANALYTICS_ADMIN_EMAILS
                               └─ Webhook POST → SUPPORT_WEBHOOK_URL
                                  (Slack / Discord / Telegram / Teams)
```

---

## 3. Data Sources & Signal Definitions

### 3.1 Contact Form Messages (`octav-contact`)

Already implemented (Feature 3, `docs/supportability-features-plan.md`). The bot scans for items with `status = "new"` that haven't yet generated an alert.

| Signal | Severity | Proposed Resolution Template |
|--------|----------|------------------------------|
| New message, `subject = bug_report` | HIGH | "User reported bug: {summary}. Check /admin/dynamodb → octav-contact → messageId={id}. Suggested: reproduce via {url/path if available}, check related Lambda logs." |
| New message, `subject = question` | MEDIUM | "User question from {name} ({email}): {summary}. Suggested: reply via email; if recurring, consider FAQ/content update." |
| New message, `subject = feature_request` | LOW | "Feature request from {name}: {summary}. Review against roadmap; acknowledge receipt." |
| New message, `subject = other` | MEDIUM | "Contact form message from {name} ({email}): {summary}. Manual review needed." |

### 3.2 Analytics Anomalies (`octav-analytics-events`)

Aggregate rows (`k="agg"`) are already computed by the analytics ingest handler. The bot compares recent windows against baselines.

| Signal | Severity | Proposed Resolution Template |
|--------|----------|------------------------------|
| Error-rate spike (>3× baseline in 1h window) | CRITICAL | "Error events spiked {n}× above baseline at {time}. Top affected: {paths}. Check CloudWatch logs for auth/feedback/progress Lambdas." |
| Traffic drop (>50% DAU vs 7-day avg) | HIGH | "DAU dropped to {n} (7-day avg: {avg}). Possible causes: deployment regression, DNS issue, PWA service worker breakage. Check recent deploys + CloudFront." |
| AI-mark quota exhaustion rate >20%/day | MEDIUM | "{n} users hit AI-mark quota today. Consider tier adjustment or quota increase. Current: free=30/mo, premium=1000/mo." |
| Zero events for >2 consecutive hours (prod) | HIGH | "No analytics events received from prod for {duration}. Possible: site down, CloudFront misconfiguration, analytics ingest broken. Check /api/analytics/_health." |

### 3.3 CloudWatch Logs (Opt-in, Deferred)

Lambda error/warn log events via `FilterLogEventsCommand`. This requires unstructured log parsing and is recommended as a v1.1 addition.

| Signal | Severity | Proposed Resolution Template |
|--------|----------|------------------------------|
| Lambda ERROR count >threshold/hour | HIGH | "{function} logged {n} errors in last hour. Recent error: {sample}. Check deployment + env vars + downstream API health." |
| Lambda duration p99 >timeout×0.8 | MEDIUM | "{function} p99 latency {ms}ms approaching timeout. Consider memory increase, query optimization, or timeout bump." |
| Lambda throttles >0 in window | CRITICAL | "{function} was throttled {n} times. Account concurrent-execution quota (10) may be exhausted. Request Service Quotas increase." |

### 3.4 Email Monitoring (Manual Step, External to AWS)

CloudFlare Email Routing (`info@octavlearning.com` → personal inbox) is the manual step documented in Feature 3. The bot **cannot** programmatically read a personal Gmail/inbox without OAuth complexity.

**v1 approach:** The bot monitors `octav-contact` (the structured path). Direct emails to `info@` are handled by the human reading their inbox.

**Future enhancement (out of v1 scope):** A CloudFlare Email Worker could POST incoming emails to a new `/api/support/email-ingest` endpoint, which would persist them to `octav-contact` (or a separate table) and make them visible to the bot. This would unify both paths but requires CloudFlare Workers setup + a new authenticated API endpoint.

---

## 4. New DynamoDB Table: `octav-support-alerts`

Added to `terraform/modules/dynamodb/main.tf` alongside the existing tables.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| `alertId` (PK) | S | UUID v4 |
| `source` | S | `"contact"` \| `"analytics"` \| `"cloudwatch"` \| `"email"` |
| `sourceRef` | S | messageId / aggregate-key / log-group-name / email-id |
| `severity` | S | `"critical"` \| `"high"` \| `"medium"` \| `"low"` |
| `title` | S | Short human-readable summary (≤200 chars) |
| `body` | S | Full context + proposed resolution (≤4000 chars) |
| `status` | S | `"open"` \| `"acknowledged"` \| `"resolved"` \| `"muted"` |
| `createdAt` | S | ISO-8601 (server clock) |
| `updatedAt` | S | ISO-8601 (server clock) |
| `resolvedAt` | S? | ISO-8601 (nullable) |
| `dedupKey` | S | Hash of (source + sourceRef + time-window) for idempotency |
| `expiresAt` | N | TTL (createdAt + 90 days) |

### GSI

- **GSI1:** `status` (PK) → `createdAt` (SK) — for dashboard listing filtered by status, ordered newest-first.

### Deduplication Strategy

Each signal type has a natural dedup key:

| Source | Dedup Key Format | Rationale |
|--------|-----------------|-----------|
| Contact message | `contact:{messageId}` | One alert per message, ever |
| Analytics anomaly | `analytics:{kind}:{YYYY-MM-DD}:{HH}` | One alert per anomaly-type per hour |
| CloudWatch error | `cloudwatch:{functionName}:{YYYY-MM-DD}:{HH}` | One alert per function per hour |
| Email (future) | `email:{messageId}` | One alert per ingested email |

The bot issues a `GetItem(dedupKey)` before creating. If it exists and `status ≠ "resolved"`, skip. If `status = "resolved"`, create a new alert (re-open).

Conditional `PutItem` with `attribute_not_exists(alertId)` ensures concurrent invocations are idempotent — only one wins.

---

## 5. Triage Engine

### 5.1 Rule-Based Triage (v1 Default)

Deterministic mapping from signal type + properties → severity + title + body. Implemented as a pure function with no external dependencies. Fully testable with unit tests.

```typescript
interface TriageProvider {
  triage(signal: RawSignal): Promise<TriageResult>;
}

interface TriageResult {
  severity: AlertSeverity;
  title: string;       // ≤200 chars
  body: string;        // ≤4000 chars
  suggestedActions: string[];
}
```

The rule-based provider uses the templates in §3. No LLM dependency. Never fails.

### 5.2 LLM-Enhanced Triage (v1.1, Optional)

For contact messages specifically, an LLM can produce better summaries and more contextual resolutions than template substitution. Uses DeepSeek `deepseek-v4-flash` (same provider as feedback).

- Sends raw message text + metadata to the LLM
- Receives structured JSON matching `TriageResult`
- Falls back to rule-based on any failure (timeout, parse error, API error)
- Gated by `SUPPORT_BOT_TRIAGE_PROVIDER=deepseek` env var
- Requires `FEEDBACK_ENV` secret (reuses existing DeepSeek config)

**Recommendation:** Ship v1 rule-based. Add LLM triage as v1.1 once the alert pipeline is proven stable.

---

## 6. Delivery Channels

### 6.1 Resend Email (Primary)

Reuses the existing `ResendReportSender` seam from `src/lib/analytics-report/resend-sender.ts`. Same `EMAIL_PROVIDER` env var, same `ANALYTICS_ADMIN_EMAILS` recipients, same `SES_FROM_ADDRESS`.

**Email format:**
- Subject: `[Octav Alert] [{SEVERITY}] {title}`
- HTML body: inline-styled (same pattern as analytics-report email), all user-controlled values escaped
- Plain-text fallback included
- Link to `/admin/dynamodb` with query pre-filled for the alertId

**Failure semantics:** Same as contact handler — persist-first, email best-effort. A send failure logs the error but does NOT fail the invocation (the alert is durable in DynamoDB regardless). This differs from analytics-report (which throws to trigger EventBridge retry) because duplicate alerts are worse than a missed email.

### 6.2 Webhook (Secondary, Optional)

New env var `SUPPORT_WEBHOOK_URL` (optional repo variable). When set, the bot POSTs a JSON payload after persisting the alert.

**Platform auto-detection from URL hostname:**

| Hostname Pattern | Format |
|-----------------|--------|
| `hooks.slack.com` | Slack Block Kit |
| `discord.com/api/webhooks` | Discord embed |
| `api.telegram.org` | Telegram MarkdownV2 |
| `*.webhook.office.com` | Microsoft Teams Adaptive Card |
| Anything else | Generic JSON |

**Generic JSON payload:**
```json
{
  "alertId": "...",
  "severity": "high",
  "title": "...",
  "body": "...",
  "source": "contact",
  "createdAt": "2026-08-27T12:00:00Z",
  "status": "open"
}
```

**Failure semantics:** Best-effort. Log error on failure; never block or retry. The alert is persisted regardless.

---

## 7. Lambda: `octav-support-bot`

### Trigger

EventBridge scheduled rule: `rate(5 minutes)` (adjustable via Terraform variable; see §9 Open Questions).

### Handler Flow

```
1. Load deps (getSupportBotDeps)
2. For each enabled source:
   a. Poll for new signals since last run
   b. For each signal:
      i.   Compute dedup key
      ii.  GetItem(octav-support-alerts, dedupKey)
      iii. If exists && status ≠ "resolved" → skip
      iv.  Run triage provider → TriageResult
      v.   PutItem (conditional, attribute_not_exists)
      vi.  Deliver via Resend email
      vii. Deliver via webhook (if configured)
3. Log summary: { polled, newAlerts, delivered, skipped, errors }
4. Return { ok: true, ...summary }
```

### Error Semantics

- Config problems (no recipients, no storage) → return `{ ok: false, error }` without throwing (avoids retry storm; same as analytics-report)
- Transient failures (DynamoDB timeout, Resend 5xx) → throw → EventBridge retries (exponential backoff, max 3 attempts)
- Individual alert delivery failure → log + continue (never abort the batch)

### IAM (Least Privilege)

| Resource | Actions | Rationale |
|----------|---------|-----------|
| `octav-support-alerts` | GetItem, PutItem, UpdateItem | Alert CRUD + dedup check |
| `octav-contact` | Query | Scan for new messages |
| `octav-analytics-events` | Query | Aggregate anomaly detection |
| `/aws/lambda/iblearn-*` log groups | FilterLogEvents | CloudWatch polling (opt-in) |
| CloudWatch Logs | CreateLogStream, PutLogEvents | Basic execution role |

**NO write access to any source table.** The bot is a read-only monitor.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPPORT_BOT_STORAGE` | Yes | `"dynamodb"` \| `"dummy"` |
| `SUPPORT_ALERTS_TABLE` | DynamoDB mode | Table name for alerts |
| `CONTACT_TABLE` | DynamoDB mode | octav-contact table name |
| `ANALYTICS_TABLE` | DynamoDB mode | octav-analytics-events table name |
| `AUTH_USERS_TABLE` | DynamoDB mode | Session validation (contact attribution) |
| `AUTH_SESSIONS_TABLE` | DynamoDB mode | Session validation |
| `EMAIL_PROVIDER` | Yes | `{"NAME":"resend","API_KEY":"..."}` — reuse existing secret |
| `ANALYTICS_ADMIN_EMAILS` | Yes | Comma-separated recipients — reuse existing variable |
| `SES_FROM_ADDRESS` | No | Default `noreply@octavlearning.com` |
| `SUPPORT_WEBHOOK_URL` | No | Webhook endpoint (optional) |
| `SUPPORT_BOT_CLOUDWATCH_ENABLED` | No | `"true"` to enable log polling (default `"false"`) |
| `SUPPORT_BOT_TRIAGE_PROVIDER` | No | `"rule-based"` (default) \| `"deepseek"` |
| `FEEDBACK_ENV` | Only if deepseek triage | Reuse existing DeepSeek config |

### Runtime Configuration

- Runtime: `nodejs24.x` (arm64)
- Memory: 256 MB
- Timeout: 60 seconds (polling multiple sources + LLM call if enabled)
- Reserved concurrency: `null` (unmanaged — account quota is 10; see AGENTS.md)

---

## 8. Module Layout & File Structure

### Shared Handler (`src/lib/support-bot/`)

```
src/lib/support-bot/
  types.ts                — Alert, RawSignal, TriageResult, AlertSeverity, constants
  http-handler.ts         — pollAndAlert(deps) — the core orchestration loop
  deps.ts                 — getSupportBotDeps() — env-driven wiring (fail-closed)
  dynamodb-storage.ts     — SupportBotStorage (alerts CRUD + source queries)
  dummy.ts                — InMemorySupportBotStorage (extends shared universe)
  triage/
    types.ts              — TriageProvider interface
    rule-based.ts         — Deterministic severity + resolution templates
    deepseek.ts           — LLM-enhanced triage (v1.1)
  delivery/
    types.ts              — AlertDelivery interface
    resend-sender.ts      — Reuses ResendReportSender seam
    webhook-sender.ts     — Platform-aware webhook POST
    dummy-sender.ts       — No-op for tests
  html.ts                 — Alert email HTML template (inline-styled, escaped)
```

### Lambda Adapter (`lambda/support-bot/`)

```
lambda/support-bot/
  index.ts                — EventBridge adapter (mirrors analytics-report pattern)
```

### Terraform Module (`terraform/modules/support_bot/`)

```
terraform/modules/support_bot/
  main.tf                 — Lambda + EventBridge rule + IAM + log group
```

Wired into `terraform/envs/prod/main.tf` after `contact_api`, following the `analytics_report` module pattern exactly (no Function URL, no CloudFront behavior).

### Tests

```
tests/unit/support-bot/
  types.test.ts           — Constants, helpers
  handler.test.ts         — Core orchestration (mock deps)
  rule-based-triage.test.ts — All signal types → expected severity/title/body
  dedup.test.ts           — Dedup key generation + collision handling
  dynamodb-storage.test.ts — Storage operations
  dummy.test.ts           — Dummy storage parity
  webhook-sender.test.ts  — Platform detection + payload formatting
  html.test.ts            — Email template rendering + escaping
```

---

## 9. Open Questions (Awaiting User Decision)

### Q1. Polling Frequency

How often should the bot check for new signals?

| Option | Trade-off |
|--------|-----------|
| **5 minutes** (recommended) | Good balance. ~288 invocations/day × <5s each ≈ negligible cost. Alerts arrive within 5 min of signal. |
| 1 minute | Faster alerts but 5× more invocations. Still cheap at on-demand pricing. May be overkill for a learning site. |
| 15 minutes | Cheaper, but a critical bug report could sit for 15 min before alerting. |

### Q2. Webhook Platform Priority

Which messaging platform should be tested/verified first?

- **Slack** — most common for team ops
- **Discord** — common for community/dev projects
- **Telegram** — simple bot API, good for personal alerts
- **Microsoft Teams** — enterprise environments
- **Generic JSON only** for v1, platform-specific formatting deferred

The auto-detect approach covers all, but verification needs a real target URL. Which do you use?

### Q3. CloudWatch Logs Monitoring: v1 or v1.1?

CloudWatch log polling requires:
- `logs:FilterLogEvents` IAM permission
- Unstructured log text parsing (regex or heuristic)
- Threshold tuning (what counts as "too many errors"?)

**Option A:** Include in v1 — broader coverage from day one.
**Option B (recommended):** Defer to v1.1 — keeps v1 focused on structured data sources (contact + analytics) that are fully testable with deterministic inputs. CloudWatch adds complexity and false-positive risk that benefits from a stable base pipeline first.

### Q4. LLM Triage: v1 or v1.1?

**Option A:** Include DeepSeek triage in v1 — better contact-message summaries immediately.
**Option B (recommended):** Ship v1 rule-based, add LLM in v1.1. Rule-based is deterministic, fully testable, and has zero external dependency. The LLM adds value for unstructured content but introduces a failure mode (API timeout, parse error) that must be handled gracefully. Proving the pipeline works end-to-end with rules first makes the LLM integration safer.

### Q5. Alert Retention Period

How long should alerts persist in DynamoDB before TTL expiry?

| Option | Trade-off |
|--------|-----------|
| **90 days** (recommended) | Sufficient for operational review. Matches raw-event TTL. Low storage cost. |
| 180 days | Longer history for trend analysis. Moderate cost increase. |
| 365 days | Full year of alert history. Higher cost; consider S3 archive for old resolved alerts instead. |

### Q6. Alert Acknowledgment Workflow

Should the bot support acknowledging/resolving alerts beyond the DynamoDB CRUD dashboard?

**Option A (recommended for v1):** Use `/admin/dynamodb` to update alert status. No new UI needed.
**Option B:** Build a dedicated `/admin/alerts` page with real-time polling, bulk actions, mute rules, and severity filtering. Significant frontend effort; defer until alert volume justifies it.
**Option C:** Add reply-to-email actions (e.g., reply "ACK" to acknowledge). Requires inbound email processing; complex and out of scope.

### Q7. Mute/Suppression Rules

Should the bot support muting specific signal types or sources?

**Option A (recommended for v1):** No mute rules. Manually resolve/mute individual alerts via status update. Simple.
**Option B:** Add a `muteRules` configuration (env var or DynamoDB table) that suppresses alerts matching patterns (e.g., mute all "low" severity contact messages, mute a specific Lambda's errors during a known deploy window). Useful at scale but adds configuration complexity.

### Q8. Escalation Policy

Should unresolved alerts escalate (e.g., re-alert after N hours if still open)?

**Option A (recommended for v1):** No escalation. Single alert per signal. Admin reviews at their pace.
**Option B:** Re-alert on CRITICAL/HIGH alerts that remain `"open"` after configurable thresholds (e.g., 1 hour for CRITICAL, 4 hours for HIGH). Prevents missed urgent issues but risks alert fatigue.

### Q9. Integration with Existing Daily Report

Should the daily analytics report (Feature 1) include an alert summary section?

**Option A (recommended):** Yes — add an "Open Alerts" section to the existing daily email showing count by severity + top 3 unresolved alerts. Zero new infrastructure; enriches the existing report.
**Option B:** Keep alerts separate. The daily report stays analytics-only; alerts are delivered independently. Cleaner separation but two emails to check.

---

## 10. Implementation Phases

### v1 Scope (Recommended)

| Phase | Scope | Effort | Dependencies |
|-------|-------|--------|--------------|
| **S1** | Types + constants + rule-based triage + dummy storage + unit tests | Medium | None |
| **S2** | DynamoDB storage adapter + deps seam + handler core + parity tests | Medium | S1 |
| **S3** | Resend email delivery (reuse existing sender seam) + HTML template | Low | S2 |
| **S4** | Webhook delivery (generic JSON + Slack format) | Low | S2 |
| **S5** | Terraform: DynamoDB table + `support_bot` module + CI wiring + smoke probe | Medium | S2–S4 |
| **S6** | Integration: add alert summary to daily analytics report email | Low | S5 |

### v1.1 (Post-v1, After Pipeline Proven)

| Phase | Scope | Effort |
|-------|-------|--------|
| S7 | CloudWatch Logs polling (opt-in) | Medium |
| S8 | DeepSeek LLM triage provider | Medium |
| S9 | Dedicated `/admin/alerts` page | High |
| S10 | Mute/suppression rules | Medium |
| S11 | Escalation re-alerting | Medium |
| S12 | CloudFlare Email Worker → `/api/support/email-ingest` endpoint | High |

---

## 11. Edge Cases & Failure Modes

| Scenario | Handling |
|----------|----------|
| LLM triage fails/times out | Fall back to rule-based; log warning; never block alerting |
| Resend send fails | Log error; alert is persisted (visible in /admin/dynamodb); do NOT retry send (avoid duplicate emails) |
| Webhook POST fails | Log error; alert is persisted; best-effort delivery |
| EventBridge invocation fails | Automatic retry (exponential backoff, max 3 attempts) |
| Dedup key collision (same signal re-polled) | GetItem returns existing alert; skip if status≠resolved; if resolved, create new alert (re-open) |
| No recipients configured | Return `{ ok: false, error: "no recipients" }` without throwing (same as analytics-report) |
| Concurrent Lambda invocations | Conditional PutItem on alertId (idempotent); only one wins |
| Clock skew between polls | Server clock only; dedup keys include hour-bucket to tolerate ±5min drift |
| All sources empty (quiet period) | Log `{ polled: 0, newAlerts: 0 }`; return ok:true; no alert generated |
| DynamoDB table not yet created | Deps fail closed at startup; Lambda throws; EventBridge retries after table is provisioned |

---

## 12. Assumptions

1. **CloudFlare Email Routing** is set up manually per Feature 3 docs. The bot does NOT read a personal inbox — it monitors the structured `octav-contact` path. Direct email monitoring requires a future CloudFlare Email Worker integration (§9 Q6 / §3.4).
2. **LLM triage is optional.** Rule-based covers all defined signals deterministically. LLM adds nuance for unstructured content but must never be a single point of failure.
3. **Webhook URLs are self-authenticating** (bearer token embedded in URL path). No additional auth mechanism needed for v1.
4. **Alert volume is low** (<100/day expected). On-demand DynamoDB billing handles this trivially. If volume grows, add pagination and S3 archival for old resolved alerts.
5. **No new AWS services** beyond what's already used (Lambda, DynamoDB, EventBridge, CloudWatch Logs, Resend). No SQS/SNS/Step Functions for v1.
6. **The existing concurrent-executions quota (10)** is sufficient. The support-bot Lambda runs for <5 seconds every 5 minutes — negligible concurrency impact. No reserved concurrency needed.
7. **Existing patterns are followed exactly:** deps seam with fail-closed guards, dummy storage extending the shared universe, parity tests between dummy and DynamoDB adapters, `_health` smoke probe in CI, no local `terraform apply`.

---

## 13. Infrastructure Summary

| Component | New? | Details |
|-----------|------|---------|
| Lambda function | Yes | `octav-support-bot` (nodejs24.x, arm64, 256MB, 60s) |
| DynamoDB table | Yes | `octav-support-alerts` (PK alertId, GSI1 status→createdAt, TTL 90d) |
| EventBridge rule | Yes | `rate(5 minutes)` (adjustable) |
| CloudFront behavior | No | Not HTTP-triggered |
| New secrets | No | Reuses `EMAIL_PROVIDER`, `ANALYTICS_ADMIN_EMAILS` |
| New repo variables | Maybe | `SUPPORT_WEBHOOK_URL` (optional) |
| CI changes | Yes | `build:lambda` entry + `TF_VAR_support_bot_env` + smoke probe |

**Total new resources:** 1 Lambda, 1 DynamoDB table (+ GSI), 1 EventBridge rule, 1 CloudWatch log group.
