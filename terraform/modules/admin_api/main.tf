# Admin CRUD dashboard API module (docs/supportability-features-plan.md §"Feature 2"):
# Lambda + Function URL for the admin DynamoDB browser. The function is a thin
# adapter around src/lib/admin/http-handler.ts — same contract as the Next
# routes under /api/admin/*. This is a BROAD DynamoDB tool by design: its IAM
# grants full CRUD on every octav-* table plus ListTables, so an admin can
# browse/query/edit all our tables without the AWS Console. Access is gated in
# the handler — valid session AND ANALYTICS_ADMIN_EMAILS allowlist match —
# and the handler further restricts table names to the octav-* prefix.
#
# Session validation reuses the shared resolveSession (src/lib/auth/session.ts)
# over the same users/sessions tables the auth Lambda uses. Env vars it consumes
# (src/lib/admin/deps.ts): ADMIN_STORAGE selects the real (dynamodb) wiring,
# AUTH_USERS_TABLE + AUTH_SESSIONS_TABLE name the session tables,
# ANALYTICS_ADMIN_EMAILS is the admin allowlist. Deploys fine unconfigured
# (ADMIN_STORAGE defaults to the dummy), but production always sets the real
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
  description = "Lambda env vars: ADMIN_STORAGE / AUTH_USERS_TABLE / AUTH_SESSIONS_TABLE / ANALYTICS_ADMIN_EMAILS (see src/lib/admin/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Function URL CORS origins (the CloudFront site URLs; requests are same-origin via the /api/admin/* behavior, so this is belt-and-braces)."
  type        = list(string)
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the admin Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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

resource "aws_iam_role" "admin" {
  name               = "${var.name_prefix}-admin-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "admin_basic" {
  role       = aws_iam_role.admin.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Data policy. This is intentionally BROAD — the feature is an admin DynamoDB
# browser over every octav-* table (users/sessions/progress/rate-limits/
# analytics/leaderboard/contact/…). Least-privilege here means scoping to the
# octav-* namespace (our shared table prefix) + ListTables; an explicit ARN
# list would break every time a new octav- table is added (leaderboard D7,
# contact Feature 3), defeating the tool's purpose. The handler re-enforces the
# octav-* prefix on every request and gates on admin identity, so this IAM is
# the outer bound, not the only one.
data "aws_iam_policy_document" "admin" {
  # ListTables is account/region-wide (not table-scoped) — required by the
  # dashboard's table dropdown and the _health probe.
  statement {
    sid       = "ListTables"
    actions   = ["dynamodb:ListTables"]
    resources = ["*"]
  }

  # Full CRUD on every octav-* table. The wildcard covers current + future
  # tables sharing the octav- prefix.
  statement {
    sid = "OctavCrud"
    actions = [
      "dynamodb:Scan",
      "dynamodb:Query",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      # Wildcard region: IAM accepts it, avoids the aws_region data source
      # deprecation, and is a harmless widening for an intentionally-broad admin
      # tool (the stack lives in a single region anyway).
      "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/octav-*",
    ]
  }
}

resource "aws_iam_role_policy" "admin" {
  name   = "admin"
  role   = aws_iam_role.admin.name
  policy = data.aws_iam_policy_document.admin.json
}

# --- Logs ---------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "admin" {
  name              = "/aws/lambda/${var.name_prefix}-admin"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "admin" {
  function_name                  = "${var.name_prefix}-admin"
  role                           = aws_iam_role.admin.arn
  runtime                        = "nodejs24.x"
  architectures                  = ["arm64"]
  handler                        = "index.handler"
  memory_size                    = 256
  timeout                        = 10
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  source_code_hash               = filebase64sha256(var.zip_path)

  environment {
    variables = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.admin_basic,
    aws_iam_role_policy.admin,
    aws_cloudwatch_log_group.admin,
  ]
}

# --- Function URL (no API Gateway — one endpoint, plan §D3) -------------------

resource "aws_lambda_function_url" "admin" {
  function_name      = aws_lambda_function.admin.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"]
  }
}

# NONE auth needs explicit public invoke permissions — since 2026 BOTH actions
# are required (InvokeFunctionUrl plus InvokeFunction with the
# InvokedViaFunctionUrl condition). Same pattern as the other Lambdas.
resource "aws_lambda_permission" "function_url" {
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.admin.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "terraform_data" "function_url_invoke_permission" {
  triggers_replace = aws_lambda_function.admin.last_modified

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda remove-permission \
        --function-name ${aws_lambda_function.admin.function_name} \
        --statement-id AllowInvokeViaFunctionUrl >/dev/null 2>&1 || true
      aws lambda add-permission \
        --function-name ${aws_lambda_function.admin.function_name} \
        --statement-id AllowInvokeViaFunctionUrl \
        --action lambda:InvokeFunction \
        --principal "*" \
        --invoked-via-function-url
    EOT
  }
}

output "function_url" {
  value = aws_lambda_function_url.admin.function_url
}

output "function_url_domain" {
  value = trimsuffix(replace(aws_lambda_function_url.admin.function_url, "https://", ""), "/")
}

output "function_name" {
  value = aws_lambda_function.admin.function_name
}
