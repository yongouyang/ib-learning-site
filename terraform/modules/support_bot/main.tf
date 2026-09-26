# Support bot module (docs/support-bot-plan.md §7/§13): an EventBridge-
# SCHEDULED Lambda — NOT an HTTP function. No Function URL, no CloudFront
# behavior, no lambda-adapter: EventBridge invokes it on rate(5 minutes). The
# function polls octav-contact (new messages) and octav-analytics-events
# (aggregate anomalies), dedups/triages/persists alerts to
# octav-support-alerts and emails them to every ANALYTICS_ADMIN_EMAILS
# recipient via Resend.
#
# Env vars it consumes (src/lib/support-bot/deps.ts): SUPPORT_BOT_STORAGE
# selects the real (dynamodb) wiring, SUPPORT_ALERTS_TABLE / CONTACT_TABLE /
# ANALYTICS_TABLE name the three tables, SUPPORT_BOT_PROD_HOST is the prod
# hostname the traffic_drop / zero_events signals watch (default
# octavlearning.com), EMAIL_PROVIDER carries the Resend config (the SAME repo
# secret the auth/contact/analytics-report Lambdas use),
# ANALYTICS_ADMIN_EMAILS is the recipient allowlist (same repo variable),
# SES_FROM_ADDRESS picks the from address. The deps REFUSE users/sessions
# table wiring on purpose (plan §7 listed them for session validation, but
# the bot never resolves a session — contact attribution happens at ingest).
#
# IAM is read-only on the two SOURCE tables and read-write on the alerts
# table: dynamodb:Scan on octav-contact (NO GSI on that table — the
# new-message poll is a filtered Scan; the plan §7 IAM table says Query,
# which cannot work), dynamodb:Query on octav-analytics-events (the aggregate
# BETWEEN query), GetItem/PutItem/UpdateItem on octav-support-alerts
# (dedup check + conditional create + the future ack/resolve workflow). NO
# logs:FilterLogEvents — CloudWatch log polling is deferred to v1.1 (§9 Q3).
# The Resend API key lives in the EMAIL_PROVIDER env var (repo convention) —
# NOT SSM, same standing backlog item as the other Lambdas.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "zip_path" {
  description = "Path to the bundled Lambda zip (npm run build:lambda)."
  type        = string
}

variable "environment" {
  description = "Lambda env vars: SUPPORT_BOT_STORAGE / SUPPORT_ALERTS_TABLE / CONTACT_TABLE / ANALYTICS_TABLE / SUPPORT_BOT_PROD_HOST / EMAIL_PROVIDER / ANALYTICS_ADMIN_EMAILS / SES_FROM_ADDRESS (see src/lib/support-bot/deps.ts). Empty = dummy wiring — which the deps REFUSE inside AWS Lambda, so the base wiring from envs/prod is mandatory."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "support_alerts_table_arn" {
  description = "DynamoDB ARN of the alerts table (octav-support-alerts) — the bot's only WRITABLE table (dedup GetItem + conditional PutItem + UpdateItem for ack/resolve)."
  type        = string
}

variable "contact_table_arn" {
  description = "DynamoDB ARN of the contact table (octav-contact) — READ-ONLY, and Scan not Query: the table has no GSI, so the new-message poll is a filtered Scan (see src/lib/support-bot/dynamodb-storage.ts)."
  type        = string
}

variable "analytics_events_table_arn" {
  description = "DynamoDB ARN of the analytics events table (octav-analytics-events) — READ-ONLY aggregate BETWEEN Query for anomaly detection."
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge schedule for the poll. Default: every 5 minutes (plan §9 Q1)."
  type        = string
  default     = "rate(5 minutes)"
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrency for the bot Lambda. Default null = unmanaged (shares the account pool — fine now that the ap-east-1 concurrent-executions quota (L-B99A9384) was raised 10 → 1000 in Sep 2026; a 5-minute poller does a handful of reads, so there is nothing to isolate)."
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

resource "aws_iam_role" "bot" {
  name               = "${var.name_prefix}-support-bot-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# AWS-managed basic policy: CloudWatch Logs write access only.
resource "aws_iam_role_policy_attachment" "bot_basic" {
  role       = aws_iam_role.bot.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege data policy (plan §7 with the S2 corrections): READ-ONLY on
# the two source tables, read-write on the alerts table. No users/sessions
# (no session validation — the bot has no request), no rate-limits, no
# logs:FilterLogEvents (CloudWatch polling is v1.1).
data "aws_iam_policy_document" "bot" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.support_alerts_table_arn,
    ]
  }

  statement {
    actions = [
      "dynamodb:Scan",
    ]
    resources = [
      var.contact_table_arn,
    ]
  }

  statement {
    actions = [
      "dynamodb:Query",
    ]
    resources = [
      var.analytics_events_table_arn,
    ]
  }
}

resource "aws_iam_role_policy" "bot" {
  name   = "bot"
  role   = aws_iam_role.bot.name
  policy = data.aws_iam_policy_document.bot.json
}

# --- Logs ---------------------------------------------------------------------

# Created explicitly so retention is capped — 14 days of logs, then they expire.
resource "aws_cloudwatch_log_group" "bot" {
  name              = "/aws/lambda/${var.name_prefix}-support-bot"
  retention_in_days = 14
}

# --- Lambda -------------------------------------------------------------------

resource "aws_lambda_function" "bot" {
  function_name = "${var.name_prefix}-support-bot"
  role          = aws_iam_role.bot.arn
  # nodejs24.x (available since 2025-11) — requires AWS provider ~> 6.0.
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  # 60s (plan §7): a filtered contact Scan + a paginated aggregate Query +
  # per-signal Resend HTTPS calls.
  timeout                        = 60
  reserved_concurrent_executions = var.reserved_concurrent_executions
  filename                       = var.zip_path
  source_code_hash               = filebase64sha256(var.zip_path)

  environment {
    variables = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.bot_basic,
    aws_iam_role_policy.bot,
    aws_cloudwatch_log_group.bot,
  ]
}

# --- EventBridge schedule -----------------------------------------------------

# Every 5 minutes (plan §9 Q1). EventBridge pushes the scheduled event to the
# Lambda; the function ignores the payload and polls from the server clock.
resource "aws_cloudwatch_event_rule" "poll" {
  name                = "${var.name_prefix}-support-bot-poll"
  description         = "Support bot poll (contact messages + analytics anomalies)."
  schedule_expression = var.schedule_expression
}

resource "aws_cloudwatch_event_target" "poll" {
  rule      = aws_cloudwatch_event_rule.poll.name
  target_id = "support-bot"
  arn       = aws_lambda_function.bot.arn
}

# Resource-based policy allowing EventBridge to invoke the function — scoped to
# THIS rule's ARN (least privilege; another rule cannot trigger it).
resource "aws_lambda_permission" "eventbridge" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bot.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.poll.arn
}

output "function_name" {
  value = aws_lambda_function.bot.function_name
}

output "function_arn" {
  value = aws_lambda_function.bot.arn
}

output "rule_arn" {
  value = aws_cloudwatch_event_rule.poll.arn
}
