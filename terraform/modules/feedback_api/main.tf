# Feedback API module (docs/aws-deployment-plan.md §5): Lambda + Function URL.
# The function is a thin adapter around src/lib/feedback/http-handler.ts —
# same contract as the Next route. Deploys fine unconfigured (no provider env):
# GET returns { configured: false }, POST 501, UI hides "Mark with AI".

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: FEEDBACK_PROVIDER / FEEDBACK_API_KEY / FEEDBACK_MODEL / FEEDBACK_BASE_URL / FEEDBACK_RATE_LIMIT_* (see src/lib/feedback). Empty = unconfigured."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URL; requests are same-origin via the /api/* behavior, so this is belt-and-braces)."
  type        = list(string)
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
resource "aws_iam_role" "feedback" {
  name               = "${var.name_prefix}-feedback-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only. The function
# needs nothing else (it calls an external LLM API over HTTPS).
resource "aws_iam_role_policy_attachment" "feedback_basic" {
  role       = aws_iam_role.feedback.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly (rather than letting Lambda auto-create it) so the
# retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "feedback" {
  name              = "/aws/lambda/${var.name_prefix}-feedback"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "feedback" {
  function_name = "${var.name_prefix}-feedback"
  role          = aws_iam_role.feedback.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0;
  # provider 5.x's runtime enum ended at nodejs22.x.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 30
  filename      = var.zip_path
  # Hash of the zip: Terraform only pushes new code when the bundle changes.
  source_code_hash = filebase64sha256(var.zip_path)

  # Provider config (API key etc.) — empty map = unconfigured mode.
  environment {
    variables = var.environment
  }

  # Ensure the role can write logs and the log group exists before the first
  # invocation.
  depends_on = [
    aws_iam_role_policy_attachment.feedback_basic,
    aws_cloudwatch_log_group.feedback,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §2) --------------------

# Public HTTPS endpoint for the function. Fronted by CloudFront's /api/*
# behavior in production, so direct hits are possible but not the normal path.
resource "aws_lambda_function_url" "feedback" {
  function_name      = aws_lambda_function.feedback.function_name
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
  function_name          = aws_lambda_function.feedback.function_name
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
  triggers_replace = aws_lambda_function.feedback.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.feedback.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.feedback.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.feedback.function_url
}

# CloudFront origin domain for the /api/* behavior (no scheme, no trailing /).
output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.feedback.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.feedback.function_name
}
