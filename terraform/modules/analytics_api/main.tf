# Analytics API module (docs/phase-a-analytics-plan.md): Lambda + Function URL
# for the Phase A analytics ingest/summary feature. The function is a thin
# adapter around src/lib/analytics/http-handler.ts — same contract as the Next
# routes under /api/analytics/*. Session validation for /summary reuses the
# shared resolveSession (src/lib/auth/session.ts) over the SAME users/sessions
# tables the auth Lambda uses; events land in octav-analytics-events (PK k +
# SK s single-table: raw events + daily aggregates) and the ingest budget
# shares octav-rate-limits (fixed-window bucket pattern). Env vars it consumes
# (src/lib/analytics/deps.ts): ANALYTICS_STORAGE selects the real (dynamodb)
# wiring, ANALYTICS_TABLE + AUTH_RATE_LIMITS_TABLE + AUTH_USERS_TABLE +
# AUTH_SESSIONS_TABLE name the tables, ANALYTICS_ADMIN_EMAILS is the /summary
# admin allowlist. Deploys fine unconfigured (ANALYTICS_STORAGE defaults to the
# dummy), but production always sets the real wiring via merge in envs/prod.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: ANALYTICS_STORAGE / ANALYTICS_TABLE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE / ANALYTICS_ADMIN_EMAILS (see src/lib/analytics/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/analytics/* behavior, so this is belt-and-braces)."
  type        = list(string)
}

variable "users_table_arn" {
  description = "DynamoDB ARN of the users table (octav-users)."
  type        = string
}

variable "sessions_table_arn" {
  description = "DynamoDB ARN of the sessions table (octav-sessions)."
  type        = string
}

variable "analytics_events_table_arn" {
  description = "DynamoDB ARN of the analytics events table (octav-analytics-events)."
  type        = string
}

variable "rate_limits_table_arn" {
  description = "DynamoDB ARN of the rate-limits table (octav-rate-limits)."
  type        = string
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the analytics Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
  type        = number
  default     = null
}

data "aws_caller_identity" "current" {}
# Declared for symmetry with other modules; not currently referenced.
data "aws_region" "current" {}

# --- IAM ----------------------------------------------------------------------

# Trust policy: only the Lambda service may assume the execution role.
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# Execution role — what the function's code is allowed to do at runtime.
resource "aws_iam_role" "analytics" {
  name               = "${var.name_prefix}-analytics-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "analytics_basic" {
  role       = aws_iam_role.analytics.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy — one statement per table, derived from
# src/lib/analytics/dynamodb-storage.ts (recordEvent = Put raw + Update
# aggregates; getSummary + _health probe = Query; the ingest budget =
# UpdateItem on rate-limits; resolveSession = Get users + Get/Update/Delete
# sessions). No otp-codes, no progress, no SES.
data "aws_iam_policy_document" "analytics" {
  # users — session validation: resolveSession → getUserById reads the user row
  # by PK (GetItem) ONLY.
  statement {
    actions = [
      "dynamodb:GetItem",
    ]
    resources = [
      var.users_table_arn,
    ]
  }

  # sessions — resolveSession: getSession reads by PK (GetItem), the 30-day
  # TTL slide writes lastAccessedAt/expiresAt (UpdateItem), and DeleteItem
  # clears the expired/orphaned session row resolveSession deletes before it
  # 401s. No Query: the analytics path never lists a user's devices.
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      var.sessions_table_arn,
    ]
  }

  # analytics events — recordEvent: Put raw + Update aggregate ADD-upserts;
  # getSummary + probeAnalyticsTable: Query on k="agg" (bounded BETWEEN).
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = [
      var.analytics_events_table_arn,
    ]
  }

  # rate limits — incrementAnalyticsEventCount: one conditional UpdateCommand
  # on the fixed-window bucket key (analytics:<ip>:<epoch>).
  statement {
    actions = [
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.rate_limits_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "analytics" {
  name   = "analytics"
  role   = aws_iam_role.analytics.name
  policy = data.aws_iam_policy_document.analytics.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "analytics" {
  name              = "/aws/lambda/${var.name_prefix}-analytics"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "analytics" {
  function_name = "${var.name_prefix}-analytics"
  role          = aws_iam_role.analytics.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0;
  # provider 5.x's runtime enum ended at nodejs22.x.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 10
  # null by default — see the variable's description (account quota is 10).
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle changes.
  source_code_hash = filebase64sha256(var.zip_path)

  # Analytics-feature wiring (storage backend + table names + admin allowlist).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data policy is attached, and the log
  # group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.analytics_basic,
    aws_iam_role_policy.analytics,
    aws_cloudwatch_log_group.analytics,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §3) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's
# /api/analytics/* behavior in production, so direct hits are possible but not
# the normal path.
resource "aws_lambda_function_url" "analytics" {
  function_name      = aws_lambda_function.analytics.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"]
  }
}

# NONE auth needs explicit public invoke permissions — since 2026 BOTH
# actions are required (urls-auth docs): InvokeFunctionUrl plus
# InvokeFunction with the InvokedViaFunctionUrl condition. The pinned provider
# 6.x CAN express the second statement natively (invoked_via_function_url is
# in aws_lambda_permission's schema — verified against the 6.58.0 provider
# schema, round 3; aws_lambda_function_url with NONE auth auto-adds the
# statement on creation), but the CLI provisioner is retained deliberately:
# it matches the deployed state and its remove-then-add is idempotent.
# TRACKED MIGRATION (docs/PROGRESS.md "Next"): switch to the native attribute
# — existing out-of-band statements need state surgery first. statement-id is
# per-function; add-permission alone would fail with ResourceConflictException
# on an existing statement.
resource "aws_lambda_permission" "function_url" {
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.analytics.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "terraform_data" "function_url_invoke_permission" {
  # `triggers_replace` (NOT `input`) on last_modified: changing `input` is an
  # in-place update and create-time local-exec provisioners NEVER run on
  # in-place updates, so a Lambda recreated under the same name would lose the
  # InvokedViaFunctionUrl statement and 403 the Function URL. triggers_replace
  # REPLACES this resource whenever the function changes, forcing the
  # provisioner to re-run; the remove-then-add keeps every re-run idempotent.
  triggers_replace = aws_lambda_function.analytics.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.analytics.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.analytics.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.analytics.function_url
}

# CloudFront origin domain for the /api/analytics/* behavior (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.analytics.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.analytics.function_name
}
