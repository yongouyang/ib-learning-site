# Auth API module (docs/architecture-evolution-plan.md §6): Lambda + Function URL
# for the email-OTP accounts feature. The function is a thin adapter around
# src/lib/auth/http-handler.ts — same contract as the Next routes. Env vars it
# consumes (src/lib/auth/deps.ts): AUTH_STORAGE/AUTH_EMAIL select the real
# (dynamodb/ses) wiring, AUTH_USERS_TABLE/AUTH_SESSIONS_TABLE/AUTH_OTP_TABLE/
# AUTH_PROGRESS_TABLE name the tables, AUTH_SES_REGION + SES_FROM_ADDRESS the
# email sender. Deploys fine unconfigured (AUTH_STORAGE/AUTH_EMAIL default to
# the dummies), but production always sets the real wiring via merge in envs/prod.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: AUTH_STORAGE / AUTH_EMAIL / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / AUTH_OTP_TABLE / AUTH_PROGRESS_TABLE / AUTH_SES_REGION / SES_FROM_ADDRESS (see src/lib/auth/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/auth/* behavior, so this is belt-and-braces)."
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

variable "otp_codes_table_arn" {
  description = "DynamoDB ARN of the OTP codes table (octav-otp-codes)."
  type        = string
}

variable "progress_table_arn" {
  description = "DynamoDB ARN of the progress table (octav-progress)."
  type        = string
}

variable "ses_identity_arn" {
  description = "SES domain identity ARN (ap-southeast-1) — the resource ses:SendEmail is scoped to."
  type        = string
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
resource "aws_iam_role" "auth" {
  name               = "${var.name_prefix}-auth-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "auth_basic" {
  role       = aws_iam_role.auth.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy: the four accounts-feature tables (Get/Put/
# Update/Delete/Query — no scans or table-level ops) plus SendEmail on the
# verified SES identity only. Inline so there is no standalone policy ARN to
# manage or leak into other roles.
data "aws_iam_policy_document" "auth" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [
      var.users_table_arn,
      var.sessions_table_arn,
      var.otp_codes_table_arn,
      var.progress_table_arn,
    ]
  }

  statement {
    actions   = ["ses:SendEmail"]
    resources = [var.ses_identity_arn]
  }
}

resource "aws_iam_role_policy" "auth" {
  name   = "auth"
  role   = aws_iam_role.auth.name
  policy = data.aws_iam_policy_document.auth.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${var.name_prefix}-auth"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "auth" {
  function_name = "${var.name_prefix}-auth"
  role          = aws_iam_role.auth.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0;
  # provider 5.x's runtime enum ended at nodejs22.x.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 10
  filename      = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle changes.
  source_code_hash = filebase64sha256(var.zip_path)

  # Accounts-feature wiring (storage + email sender config).
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs, the data/SES policy is attached, and the
  # log group exists before the first invocation.
  depends_on = [
    aws_iam_role_policy_attachment.auth_basic,
    aws_iam_role_policy.auth,
    aws_cloudwatch_log_group.auth,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §6) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's /api/auth/*
# behavior in production, so direct hits are possible but not the normal path.
resource "aws_lambda_function_url" "auth" {
  function_name      = aws_lambda_function.auth.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"]
  }
}

# NONE auth needs explicit public invoke permissions — since 2026 BOTH
# actions are required (urls-auth docs): InvokeFunctionUrl plus
# InvokeFunction with the InvokedViaFunctionUrl condition. The AWS provider
# 5.x cannot express the second statement (invoked_via_function_url arrived
# in provider 6.x), so it is added via the CLI; statement-id is stable (and
# per-function), so re-runs are idempotent replacements.
resource "aws_lambda_permission" "function_url" {
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.auth.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "terraform_data" "function_url_invoke_permission" {
  input = aws_lambda_function.auth.function_name

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda add-permission \
        --function-name ${aws_lambda_function.auth.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.auth.function_url
}

# CloudFront origin domain for the /api/auth/* behavior (no scheme, no
# trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.auth.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.auth.function_name
}
