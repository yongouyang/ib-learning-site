# Daily analytics report module (docs/supportability-features-plan.md Feature 1,
# R2): an EventBridge-SCHEDULED Lambda — NOT an HTTP function. No Function URL,
# no CloudFront behavior, no lambda-adapter: EventBridge invokes it directly on
# cron(0 11 * * ? *) = 11:00 UTC = 19:00 HKT. The function reads the aggregate
# rows (k="agg") on octav-analytics-events with a BETWEEN Query and emails the
# rendered report to every ANALYTICS_ADMIN_EMAILS recipient via Resend.
#
# Env vars it consumes (src/lib/analytics-report/deps.ts): ANALYTICS_REPORT_STORAGE
# selects the real (dynamodb) wiring, ANALYTICS_TABLE names the events table,
# EMAIL_PROVIDER carries the Resend config (the SAME repo secret the auth
# Lambda uses), ANALYTICS_ADMIN_EMAILS is the recipient allowlist (same repo
# variable as the analytics/admin Lambdas), SES_FROM_ADDRESS picks the from
# address, ANALYTICS_REPORT_HOST highlights the prod hostname in the split.
#
# IAM is READ-ONLY on the events table (Query only — the report never writes)
# plus CloudWatch Logs. The Resend API key lives in the EMAIL_PROVIDER env var
# (repo convention) — NOT SSM: the draft plan's SSM mention is deferred to the
# standing "keys → SSM Parameter Store" backlog item.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: ANALYTICS_REPORT_STORAGE / ANALYTICS_TABLE / EMAIL_PROVIDER / ANALYTICS_ADMIN_EMAILS / SES_FROM_ADDRESS / ANALYTICS_REPORT_HOST (see src/lib/analytics-report/deps.ts). Empty = dummy wiring."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "analytics_events_table_arn" {
  description = "DynamoDB ARN of the analytics events table (octav-analytics-events) — the report's ONLY data source (aggregate rows, read-only)."
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge cron for the daily report. Default: 11:00 UTC = 19:00 HKT."
  type        = string
  default     = "cron(0 11 * * ? *)"
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the report Lambda. Default null = unmanaged, because the account's ap-east-1 concurrent-executions quota is 10 (L-B99A9384) and ANY reservation would push unreserved below AWS's minimum of 10. Set (e.g. 10) only after a Service Quotas increase."
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

resource "aws_iam_role" "report" {
  name               = "${var.name_prefix}-analytics-report-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "report_basic" {
  role       = aws_iam_role.report.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy — READ-ONLY on the events table: the report only
# issues the aggregate BETWEEN Query (src/lib/analytics-report/dynamodb-storage.ts).
# No users/sessions (no session validation — the report has no request), no
# rate-limits, no SES.
data "aws_iam_policy_document" "report" {
  statement {
    actions = [
      "dynamodb:Query",
    ]
    resources = [
      var.analytics_events_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "report" {
  name   = "report"
  role   = aws_iam_role.report.name
  policy = data.aws_iam_policy_document.report.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly so retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "report" {
  name              = "/aws/lambda/${var.name_prefix}-analytics-report"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "report" {
  function_name = "${var.name_prefix}-analytics-report"
  role          = aws_iam_role.report.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  # 30s: the aggregate Query (paginated) + one Resend HTTPS call comfortably.
  timeout                        = 30
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  source_code_hash               = filebase64sha256(var.zip_path)

  environment {
    variables = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.report_basic,
    aws_iam_role_policy.report,
    aws_cloudwatch_log_group.report,
  ]
}

# --- EventBridge schedule -----------------------------------------------------

# 11:00 UTC = 19:00 HKT every day (Hong Kong has no DST). EventBridge pushes the
# scheduled event to the Lambda; the function ignores the payload and computes
# the report from the server clock.
resource "aws_cloudwatch_event_rule" "daily" {
  name                = "${var.name_prefix}-analytics-report-daily"
  description         = "Daily analytics report email (7pm HKT)."
  schedule_expression = var.schedule_expression
}

resource "aws_cloudwatch_event_target" "daily" {
  rule      = aws_cloudwatch_event_rule.daily.name
  target_id = "analytics-report"
  arn       = aws_lambda_function.report.arn
}

# Resource-based policy allowing EventBridge to invoke the function — scoped to
# THIS rule's ARN (least privilege; another rule cannot trigger it).
resource "aws_lambda_permission" "eventbridge" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.report.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily.arn
}

output "function_name" {
  value = aws_lambda_function.report.function_name
}

output "function_arn" {
  value = aws_lambda_function.report.arn
}

output "rule_arn" {
  value = aws_cloudwatch_event_rule.daily.arn
}
