# Subscriptions API module (E4.2 — docs/stripe-subscriptions-plan.md §6.7):
# Lambda + Function URL for Stripe Checkout, the Customer Portal, billing
# status and the Stripe webhook. The function is a thin adapter around
# src/lib/subscriptions/http-handler.ts — the same contract as the Next routes
# under /api/subscriptions (dev/e2e). Session resolution reuses the shared
# resolveSession (src/lib/auth/session.ts) over the SAME users/sessions tables
# the auth Lambda uses; the webhook is authenticated by Stripe SIGNATURE, not
# session, so it deliberately skips the DEV allowlist (the test secret scopes
# dev deliveries instead).
#
# ONE Lambda serves BOTH distributions. Which key set applies is decided
# per request from the CloudFront-overwritten X-Octav-Env marker
# (src/lib/subscriptions/types.ts resolveStripeMode) — never from an env var.
# STRIPE_ENV therefore carries BOTH key sets in one JSON secret; a partial set
# is ignored rather than half-applied, and a prod request that would fall back
# to test keys is refused with 503 rather than opening test-mode Checkout
# sessions for real customers.
#
# Env vars it consumes (src/lib/subscriptions/deps.ts): SUBSCRIPTIONS_STORAGE
# selects the real (dynamodb) wiring, STRIPE_MODE the configured capability
# ("test" is correct for the shared Lambda — prod still resolves live first),
# STRIPE_ENV the key sets, AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE /
# AUTH_RATE_LIMITS_TABLE name the tables, DEV_ALLOWED_EMAILS the §6.8 allowlist,
# optional STRIPE_TRIAL_DAYS (default 14). Dummy wiring is REFUSED inside AWS
# Lambda, so this module must always set a real mode — an unset SUBSCRIPTIONS_STORAGE
# would make every request throw at construction.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: SUBSCRIPTIONS_STORAGE / STRIPE_MODE / STRIPE_ENV / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE / DEV_ALLOWED_EMAILS (see src/lib/subscriptions/deps.ts)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/subscriptions behaviors, so this is belt-and-braces)."
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

variable "rate_limits_table_arn" {
  description = "DynamoDB ARN of the rate-limits table (octav-rate-limits) — the webhook ledger and the session budget."
  type        = string
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the subscriptions Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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
resource "aws_iam_role" "subscriptions" {
  name               = "${var.name_prefix}-subscriptions-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "subscriptions_basic" {
  role       = aws_iam_role.subscriptions.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy. Deliberately SMALLER than the other Lambdas': no
# Query anywhere (the subscriptions adapter never touches a GSI), and no SES
# grant (Stripe, not email). Inline so there is no standalone policy ARN to
# manage or leak into other roles.
data "aws_iam_policy_document" "subscriptions" {
  # users — resolveSession reads the user row by PK (GetItem); the billing write
  # (status + derived tier, §6.3) is UpdateItem on that same row. UpdateItem is
  # the grant that makes this Lambda an entitlement writer: nothing else outside
  # the auth Lambda can move a user's tier.
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.users_table_arn,
    ]
  }

  # sessions — resolveSession: getSession reads by PK (GetItem), the 30-day TTL
  # slide writes lastAccessedAt/expiresAt (UpdateItem), and DeleteItem clears
  # the expired/orphaned session row it deletes before resolving anonymous.
  # (Same grant set as contact_api/leaderboard_api — the storage delegates to
  # the SAME DynamoSessionStorage.)
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

  # rate limits — TWO different writes:
  #   * PutItem: the webhook idempotency ledger (bucket `stripe-event:<id>`,
  #     ConditionExpression attribute_not_exists(bucket), TTL 30d). This is the
  #     ONE grant no other Lambda holds — a missing PutItem here shows up as a
  #     500 on the first real Stripe delivery, not at deploy time.
  #   * UpdateItem: the per-user fixed-window session budget
  #     (bucket `subscriptions:<userId>:<epoch>`, the contact/analytics limiter).
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.rate_limits_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "subscriptions" {
  name   = "subscriptions"
  role   = aws_iam_role.subscriptions.name
  policy = data.aws_iam_policy_document.subscriptions.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "subscriptions" {
  name              = "/aws/lambda/${var.name_prefix}-subscriptions"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "subscriptions" {
  function_name = "${var.name_prefix}-subscriptions"
  role          = aws_iam_role.subscriptions.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0;
  # provider 5.x's runtime enum ended at nodejs22.x.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  # 15s, not contact_api's 10s: one Stripe WEBHOOK does a ledger PutItem plus a
  # subscription re-read at Stripe plus the user-row UpdateItem, and the REST
  # client allows each Stripe call up to 8s on its own.
  timeout = 15
  # null by default — see the variable's description (account quota is 10).
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle changes.
  source_code_hash = filebase64sha256(var.zip_path)

  # Billing wiring (storage backend + table names + Stripe key sets).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data policy is attached, and the log
  # group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.subscriptions_basic,
    aws_iam_role_policy.subscriptions,
    aws_cloudwatch_log_group.subscriptions,
  ]
}

# --- Function URL (no API Gateway — one endpoint set, plan §6.2) ---------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's
# /api/subscriptions + /api/subscriptions/* behaviors in production, so direct
# hits are possible but not the normal path.
resource "aws_lambda_function_url" "subscriptions" {
  function_name      = aws_lambda_function.subscriptions.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type", "stripe-signature"]
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
  function_name          = aws_lambda_function.subscriptions.function_name
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
  triggers_replace = aws_lambda_function.subscriptions.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.subscriptions.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.subscriptions.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.subscriptions.function_url
}

# CloudFront origin domain for the /api/subscriptions* behaviors (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.subscriptions.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.subscriptions.function_name
}
