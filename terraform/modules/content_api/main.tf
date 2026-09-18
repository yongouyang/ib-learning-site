# Content API module (Phase 1b, docs/premium-content-protection-plan.md §4/§5): Lambda + Function
# URL for the gated premium content route and the public mixed-review route.
#
# WHY IT EXISTS: premium paper sets used to ship as prerendered static pages, so guessing
# /papers/<course>/<course>-set-2 returned every mark scheme to an anonymous viewer. They are now
# served from here behind a resolved session + `exam-sets-full`, and the topic/paper JSON is BUNDLED
# into this function at build time (esbuild, alongside the other Lambdas) — so a content deploy ships
# atomically with the code that serves it, and there is no CONTENT_TABLE and no content-side IAM.
#
# IAM is the smallest grant set in the repo: the function reads the user row (session validation),
# slides/deletes the session row, and writes one fixed-window budget counter (octav-rate-limits) for
# the public route. No tables of its own, no SES, no Query.
#
# Env vars it consumes (src/lib/content/deps.ts): CONTENT_STORAGE selects the real (dynamodb) wiring;
# AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE name the shared auth tables.
# Deploys fine unconfigured (CONTENT_STORAGE defaults to the dummy), but production always sets the
# real wiring via merge in envs/prod — and the deps FAIL CLOSED inside Lambda when dummy wiring is
# requested without AUTH_ALLOW_DUMMY=1.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: CONTENT_STORAGE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_RATE_LIMITS_TABLE (see src/lib/content/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/content/* behaviors, so this is belt-and-braces)."
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

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the content Lambda. Default null = unmanaged (shares the account pool — fine now that the ap-east-1 concurrent-executions quota (L-B99A9384) was raised 10 → 1000 in Sep 2026, which removed the reason this was forced to stay null). A non-null value both CAPS this function and GUARANTEES it that capacity, so set one only to isolate blast radius deliberately."
  type        = number
  default     = null
}

data "aws_caller_identity" "current" {}

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

resource "aws_iam_role" "content" {
  name               = "${var.name_prefix}-content-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "content_basic" {
  role       = aws_iam_role.content.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy — the smallest in the repo, because the content itself is bundled
# rather than stored: session validation (users GetItem, sessions Get/Update/Delete — the same grant
# set the leaderboard/contact/subscriptions Lambdas carry) and the public route's fixed-window budget
# on octav-rate-limits. NO Query (nothing lists a user's rows here), NO content table, NO SES.
data "aws_iam_policy_document" "content" {
  # users — resolveSession → getUserById reads the user row by PK (GetItem) ONLY; the premium route
  # then reads the row's `tier` to decide exam-sets-full.
  statement {
    actions = [
      "dynamodb:GetItem",
    ]
    resources = [
      var.users_table_arn,
    ]
  }

  # sessions — resolveSession: getSession reads by PK (GetItem), the 30-day TTL slide writes
  # lastAccessedAt/expiresAt (UpdateItem), and DeleteItem clears the expired/orphaned row
  # resolveSession deletes before it resolves anonymous.
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

  # rate limits — incrementContentRequestCount: one conditional UpdateCommand on the fixed-window
  # bucket key. BOTH scopes go through this one statement (no second grant for Phase 2): the public
  # route's per-IP bucket (`content:ip:<ip>:<epoch>`) and the premium route's per-account bucket
  # (`content:acct:<userId>:<epoch>`). The condition evaluates the pre-update item, so no GetItem is
  # needed (the analytics/contact precedent).
  statement {
    actions = [
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.rate_limits_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "content" {
  name   = "content"
  role   = aws_iam_role.content.name
  policy = data.aws_iam_policy_document.content.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the retention is capped — 14 days.
resource "aws_cloudwatch_log_group" "content" {
  name              = "/aws/lambda/${var.name_prefix}-content"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "content" {
  function_name = "${var.name_prefix}-content"
  role          = aws_iam_role.content.arn
  # nodejs24.x — requires AWS provider ~> 6.0 (5.x's runtime enum ended at nodejs22.x).
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  # 512 MB: the bundle carries the whole content bank (233 topics + 29 papers) and parses it on cold
  # start, so it gets more headroom than the 256 MB request/response Lambdas. The esbuild bundle is
  # ~7 MB; well inside the 50 MB zipped limit.
  memory_size = 512
  timeout     = 10
  # null by default — see the variable's description (account quota is 10).
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle (content included) changes.
  source_code_hash = filebase64sha256(var.zip_path)

  environment {
    variables = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.content_basic,
    aws_iam_role_policy.content,
    aws_cloudwatch_log_group.content,
  ]
}

# --- Function URL -------------------------------------------------------------

resource "aws_lambda_function_url" "content" {
  function_name      = aws_lambda_function.content.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET"]
    allow_headers = ["content-type"]
  }
}

# NONE auth needs explicit public invoke permissions — since 2026 BOTH actions are required
# (InvokeFunctionUrl plus InvokeFunction with the InvokedViaFunctionUrl condition). The CLI
# provisioner is retained deliberately (it matches deployed state; remove-then-add is idempotent) —
# see terraform/modules/contact_api for the tracked migration to the native attribute.
resource "aws_lambda_permission" "function_url" {
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.content.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "terraform_data" "function_url_invoke_permission" {
  # `triggers_replace` (NOT `input`) on last_modified: a Lambda recreated under the same name would
  # otherwise lose the InvokedViaFunctionUrl statement and 403 the Function URL.
  triggers_replace = aws_lambda_function.content.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.content.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.content.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.content.function_url
}

output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.content.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.content.function_name
}
