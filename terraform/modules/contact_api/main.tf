# Contact Us API module (docs/supportability-features-plan.md §"Feature 3",
# C5): Lambda + Function URL for the public contact form. The function is a
# thin adapter around src/lib/contact/http-handler.ts — same contract as the
# Next route under /api/contact (dev/e2e). Session resolution reuses the shared
# resolveSession (src/lib/auth/session.ts) over the SAME users/sessions tables
# the auth Lambda uses — the endpoint is PUBLIC (no 401), a resolved session
# only attributes the message (userId) and re-issues the sliding refresh
# cookie.
#
# The endpoint is bounded per IP by the durable fixed-window budget in
# octav-rate-limits (bucket contact:<ip>:<epoch>, 3 messages/hour — the
# analytics fixed-window pattern, ONE conditional UpdateCommand), checked
# BEFORE any write. Messages persist to octav-contact (PK messageId, TTL
# expiresAt) BEFORE the notification email is attempted; an email failure never
# fails the request.
#
# Env vars it consumes (src/lib/contact/deps.ts): CONTACT_STORAGE selects the
# real (dynamodb) wiring, CONTACT_TABLE + AUTH_USERS_TABLE +
# AUTH_SESSIONS_TABLE + AUTH_RATE_LIMITS_TABLE name the tables, EMAIL_PROVIDER
# (JSON, NAME must be "resend" in dynamodb mode — deps fail closed otherwise)
# and SES_FROM_ADDRESS configure the notification sender,
# ANALYTICS_ADMIN_EMAILS is the recipient allowlist (the SAME repo variable the
# analytics/admin Lambdas use — no new secret). Deploys fine unconfigured
# (CONTACT_STORAGE defaults to the dummy), but production always sets the real
# wiring via merge in envs/prod.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: CONTACT_STORAGE / CONTACT_TABLE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE / EMAIL_PROVIDER / ANALYTICS_ADMIN_EMAILS / SES_FROM_ADDRESS (see src/lib/contact/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/contact/* behavior, so this is belt-and-braces)."
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
  description = "DynamoDB ARN of the rate-limits table (octav-rate-limits)."
  type        = string
}

variable "contact_table_arn" {
  description = "DynamoDB ARN of the contact table (octav-contact)."
  type        = string
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the contact Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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
resource "aws_iam_role" "contact" {
  name               = "${var.name_prefix}-contact-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "contact_basic" {
  role       = aws_iam_role.contact.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy (the analytics grant set, plus octav-contact):
# session validation (same grant set the leaderboard/analytics Lambdas carry —
# resolveSession reads the user row by PK, slides the session TTL, and deletes
# expired/orphaned sessions), the fixed-window rate budget on
# octav-rate-limits, and append-only writes + the health probe on
# octav-contact. Inline so there is no standalone policy ARN to manage or leak
# into other roles. No SES grant — notification email goes through Resend's
# HTTPS API (EMAIL_PROVIDER), not SES.
data "aws_iam_policy_document" "contact" {
  # users — session validation: resolveSession → getUserById reads the user row
  # by PK (GetItem) ONLY. Nothing in the contact path queries the users table
  # (same rule as leaderboard_api/analytics_api).
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
  # resolves anonymous. No Query: the contact path never lists a user's
  # devices. (Same grant set as leaderboard_api — the contact storage
  # delegates to the SAME DynamoSessionStorage.)
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

  # rate limits — incrementContactCount: one conditional UpdateCommand on the
  # fixed-window bucket key (contact:<ip>:<epoch>). The condition evaluates the
  # pre-update item, so no GetItem is needed (the analytics precedent).
  statement {
    actions = [
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.rate_limits_table_arn,
    ]
  }

  # contact — saveContactMessage is an append-only PutItem by PK; GetItem is
  # the /api/contact/_health probe (a fixed probe key that never exists —
  # exercises the table + grant with zero data exposure). NO Update/Delete:
  # status transitions ("new" → "read"/"replied"/"spam") go through the
  # Feature 2 admin Lambda, not this function.
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
    ]
    resources = [
      var.contact_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "contact" {
  name   = "contact"
  role   = aws_iam_role.contact.name
  policy = data.aws_iam_policy_document.contact.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "contact" {
  name              = "/aws/lambda/${var.name_prefix}-contact"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "contact" {
  function_name = "${var.name_prefix}-contact"
  role          = aws_iam_role.contact.arn
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

  # Contact wiring (storage backend + table names + email provider).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data policy is attached, and the log
  # group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.contact_basic,
    aws_iam_role_policy.contact,
    aws_cloudwatch_log_group.contact,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §C5) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's
# /api/contact/* behavior in production, so direct hits are possible but
# not the normal path.
resource "aws_lambda_function_url" "contact" {
  function_name      = aws_lambda_function.contact.function_name
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
  function_name          = aws_lambda_function.contact.function_name
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
  triggers_replace = aws_lambda_function.contact.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.contact.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.contact.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.contact.function_url
}

# CloudFront origin domain for the /api/contact/* behavior (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.contact.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.contact.function_name
}
