# Progress API module (docs/architecture-evolution-plan.md §3): Lambda +
# Function URL for the cross-device progress sync feature. The function is a
# thin adapter around src/lib/progress/http-handler.ts — same contract as the
# Next routes under /api/progress/*. Session validation reuses the shared
# resolveSession (src/lib/auth/session.ts) over the SAME users/sessions tables
# the auth Lambda uses, and progress items land in the octav-progress
# single-table (userId PK + dataType SK). The durable per-user sync budget
# touches octav-rate-limits (fixed-window bucket — UpdateItem only). Env vars
# it consumes (src/lib/progress/deps.ts): PROGRESS_STORAGE selects the real
# (dynamodb) wiring, AUTH_USERS_TABLE/AUTH_SESSIONS_TABLE/AUTH_PROGRESS_TABLE/
# AUTH_RATE_LIMITS_TABLE name the tables. Deploys fine unconfigured
# (PROGRESS_STORAGE defaults to the dummy), but production always sets the
# real wiring via merge in envs/prod. No SES / otp grants here — the progress
# path never sends email and never reads OTPs.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: PROGRESS_STORAGE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_PROGRESS_TABLE / AUTH_RATE_LIMITS_TABLE (see src/lib/progress/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/progress/* behavior, so this is belt-and-braces)."
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

variable "progress_table_arn" {
  description = "DynamoDB ARN of the progress table (octav-progress)."
  type        = string
}

variable "rate_limits_table_arn" {
  description = "DynamoDB ARN of the rate-limits table (octav-rate-limits) — the durable per-user sync budget bucket."
  type        = string
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the progress Lambda (runaway-batch cost cap). Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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
resource "aws_iam_role" "progress" {
  name               = "${var.name_prefix}-progress-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "progress_basic" {
  role       = aws_iam_role.progress.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy: only the tables the progress handler touches.
# Three statements, one per table, so each grant's caller is documented
# inline. No SES, no otp-codes, no rate-limits — the progress path never
# sends email, never reads OTPs, and never writes the durable request-otp
# counter (that stays the auth Lambda's job). Inline so there is no standalone
# policy ARN to manage or leak into other roles.
data "aws_iam_policy_document" "progress" {
  # users — session validation: resolveSession → getUserById reads the user row
  # by PK (GetItem) ONLY. Round 2: the users Query/index/* grant was removed —
  # nothing in the progress path queries the users table (getUserByEmail is
  # auth-only), and least privilege beats symmetry.
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
  # 401s. No Query: the progress path never lists a user's devices
  # (listSessionsByUser is auth-only), so sessions GSI1 is not granted.
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

  # progress — the single-table (userId PK + dataType SK): listProgressByUser
  # is a Query by PK (also the /api/progress/_health probe); getMeta reads one
  # row (GetItem); putTopicAttempt/putExamAttempt/putFlashcard Put; mergeMeta/
  # updateLadderLevel/setMigrationCompleted Update; deleteProgressByUser
  # Delete. The /index/* ARN is granted for symmetry with auth_api (rule 7:
  # index ARNs wherever a GSI might be queried) even though octav-progress has
  # no GSI today.
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [
      var.progress_table_arn,
      "${var.progress_table_arn}/index/*",
    ]
  }

  # rate limits — the durable per-user sync budget: incrementProgressSyncCount
  # is ONE conditional UpdateCommand on the fixed-window bucket key
  # (progress-sync:<userId>:<epoch>).
  statement {
    actions = [
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.rate_limits_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "progress" {
  name   = "progress"
  role   = aws_iam_role.progress.name
  policy = data.aws_iam_policy_document.progress.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "progress" {
  name              = "/aws/lambda/${var.name_prefix}-progress"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "progress" {
  function_name = "${var.name_prefix}-progress"
  role          = aws_iam_role.progress.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0;
  # provider 5.x's runtime enum ended at nodejs22.x.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 10
  # Caps concurrent instances — progress sync is low-volume and a runaway
  # batch can't multiply the bill. Mirrors the auth Lambda's cap.
  # null by default — see the variable's description (account quota is 10).
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle changes.
  source_code_hash = filebase64sha256(var.zip_path)

  # Progress-feature wiring (storage backend + table names).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data policy is attached, and the log
  # group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.progress_basic,
    aws_iam_role_policy.progress,
    aws_cloudwatch_log_group.progress,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §3) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's
# /api/progress/* behavior in production, so direct hits are possible but not
# the normal path.
resource "aws_lambda_function_url" "progress" {
  function_name      = aws_lambda_function.progress.function_name
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
  function_name          = aws_lambda_function.progress.function_name
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
  triggers_replace = aws_lambda_function.progress.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.progress.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.progress.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.progress.function_url
}

# CloudFront origin domain for the /api/progress/* behavior (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.progress.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.progress.function_name
}
