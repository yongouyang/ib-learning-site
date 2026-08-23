# Leaderboard API module (docs/leaderboard-plan.md §6): Lambda + Function URL
# for the Phase D leaderboard. The function is a thin adapter around
# src/lib/leaderboard/http-handler.ts — same contract as the Next routes under
# /api/leaderboard/*. Session validation reuses the shared resolveSession
# (src/lib/auth/session.ts) over the SAME users/sessions tables the auth
# Lambda uses; board reads Query the octav-leaderboard table (PK scopeWeek,
# ranked in-Lambda).
#
# READ-ONLY by design (plan §6, single-writer invariant): XP rows are written
# ONLY by the progress Lambda (the D4 award hook inside sync), so this
# function gets Query/GetItem on octav-leaderboard and NOTHING else — no
# Put/Update/Delete. The teaser and _health routes are public; the board route
# is session-gated in the shared handler.
#
# Env vars it consumes (src/lib/leaderboard/deps.ts): LEADERBOARD_STORAGE
# selects the real (dynamodb) wiring, AUTH_USERS_TABLE/AUTH_SESSIONS_TABLE/
# LEADERBOARD_TABLE name the tables. Deploys fine unconfigured
# (LEADERBOARD_STORAGE defaults to the dummy), but production always sets the
# real wiring via merge in envs/prod. No rate-limits grant — the
# xpday:/xp-topic: cap buckets are written by the PROGRESS Lambda (it owns the
# award path); this Lambda never touches them.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: LEADERBOARD_STORAGE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / LEADERBOARD_TABLE (see src/lib/leaderboard/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/leaderboard/* behavior, so this is belt-and-braces)."
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

variable "leaderboard_table_arn" {
  description = "DynamoDB ARN of the leaderboard table (octav-leaderboard)."
  type        = string
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the leaderboard Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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
resource "aws_iam_role" "leaderboard" {
  name               = "${var.name_prefix}-leaderboard-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "leaderboard_basic" {
  role       = aws_iam_role.leaderboard.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy: session validation (same grant set the progress
# Lambda carries — resolveSession reads the user row by PK, slides the session
# TTL, and deletes expired/orphaned sessions) plus READ-ONLY access to the
# leaderboard table. Inline so there is no standalone policy ARN to manage or
# leak into other roles.
data "aws_iam_policy_document" "leaderboard" {
  # users — session validation: resolveSession → getUserById reads the user row
  # by PK (GetItem) ONLY. Nothing in the leaderboard path queries the users
  # table (same rule as progress_api).
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
  # 401s. No Query: the leaderboard path never lists a user's devices.
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

  # leaderboard — READ-ONLY (plan §6): listBoard is a Query on the scopeWeek
  # partition (also the /api/leaderboard/_health probe's Limit-1 Query);
  # GetItem for symmetry/future single-row reads. NO write actions — XP rows
  # are written by the progress Lambda (the D4 award hook) and deleted by the
  # auth Lambda (opt-out/account erasure). No /index/* grant: the user-index
  # GSI is erasure-only (auth Lambda), this Lambda never queries it.
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
    ]
    resources = [
      var.leaderboard_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "leaderboard" {
  name   = "leaderboard"
  role   = aws_iam_role.leaderboard.name
  policy = data.aws_iam_policy_document.leaderboard.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "leaderboard" {
  name              = "/aws/lambda/${var.name_prefix}-leaderboard"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "leaderboard" {
  function_name = "${var.name_prefix}-leaderboard"
  role          = aws_iam_role.leaderboard.arn
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

  # Leaderboard wiring (storage backend + table names).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data policy is attached, and the log
  # group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.leaderboard_basic,
    aws_iam_role_policy.leaderboard,
    aws_cloudwatch_log_group.leaderboard,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §6) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's
# /api/leaderboard/* behavior in production, so direct hits are possible but
# not the normal path.
resource "aws_lambda_function_url" "leaderboard" {
  function_name      = aws_lambda_function.leaderboard.function_name
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
  function_name          = aws_lambda_function.leaderboard.function_name
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
  triggers_replace = aws_lambda_function.leaderboard.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.leaderboard.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.leaderboard.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.leaderboard.function_url
}

# CloudFront origin domain for the /api/leaderboard/* behavior (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.leaderboard.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.leaderboard.function_name
}
