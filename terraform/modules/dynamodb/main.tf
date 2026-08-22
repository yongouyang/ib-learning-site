# DynamoDB module (docs/architecture-evolution-plan.md §2.3/§3.2, §6.1):
# the four accounts-feature tables, all on-demand (pay-per-request) billing —
# $0 until used, no capacity planning. No Lambdas here; those land with their
# phases and consume these tables via the outputs below.

variable "name_prefix" {
  description = "Prefix for the table names (octav-users, octav-sessions, ...). Matches the plan's DYNAMODB_TABLE_PREFIX repo variable."
  type        = string
  default     = "octav"
}

# --- octav-users ---------------------------------------------------------------
# PK userId (ULID); GSI1 email → userId is the login-time lookup
# (docs/architecture-evolution-plan.md §2.3).
resource "aws_dynamodb_table" "users" {
  name         = "${var.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "email"
      key_type       = "HASH"
    }
  }
}

# --- octav-sessions ------------------------------------------------------------
# PK sessionId (opaque UUID); GSI1 userId lists a user's devices ("manage
# devices" UI); TTL expiresAt (30d, refreshed on access) auto-deletes
# (docs/architecture-evolution-plan.md §2.2).
resource "aws_dynamodb_table" "sessions" {
  name         = "${var.name_prefix}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "userId"
      key_type       = "HASH"
    }
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- octav-otp-codes -----------------------------------------------------------
# PK email (lowercased). TTL expiresAt — the auth Lambda writes epoch seconds
# 10 minutes out (docs/architecture-evolution-plan.md §2.3); DynamoDB then
# auto-deletes expired codes.
resource "aws_dynamodb_table" "otp_codes" {
  name         = "${var.name_prefix}-otp-codes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- octav-progress ------------------------------------------------------------
# PK userId + SK dataType single-table design: all of a user's progress in one
# partition, Query by userId (docs/architecture-evolution-plan.md §3.2).
resource "aws_dynamodb_table" "progress" {
  name         = "${var.name_prefix}-progress"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "dataType"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "dataType"
    type = "S"
  }
}

# --- octav-rate-limits ---------------------------------------------------------
# Durable per-email request-otp counter (docs/architecture-evolution-plan.md
# §2.5 rate limiting): PK `bucket` — the FIXED-WINDOW rate-limit key
# `otp-request:<email>:<window-epoch>` (the epoch in the key makes the counter
# reset atomically when the window rolls, round 2);
# TTL `expiresAt` cleans up old window items. On-demand billing — the
# request-otp path is low-volume but bursty. No GSI: the counter is read and
# updated by bucket key only.
resource "aws_dynamodb_table" "rate_limits" {
  name         = "${var.name_prefix}-rate-limits"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "bucket"

  attribute {
    name = "bucket"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- octav-analytics-events ---------------------------------------------------
# Phase A analytics (docs/phase-a-analytics-plan.md): single table, two item
# kinds (PK `k`, SK `s`): raw events (k="ev", s="<date>#<ts>#<uuid>", TTL
# now+90d) and daily aggregate counters (k="agg", s="<date>#<kind>#<key>",
# TTL now+400d). The ingest rate budget shares octav-rate-limits (fixed-window
# bucket pattern) — no GSI: the dashboard reads one bounded Query on k="agg".
resource "aws_dynamodb_table" "analytics_events" {
  name         = "${var.name_prefix}-analytics-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "k"
  range_key    = "s"

  attribute {
    name = "k"
    type = "S"
  }

  attribute {
    name = "s"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- Outputs (table names + ARNs for the phase Lambdas' env vars) ---------------

output "users_table_name" {
  description = "octav-users table name."
  value       = aws_dynamodb_table.users.name
}

output "users_table_arn" {
  description = "octav-users table ARN."
  value       = aws_dynamodb_table.users.arn
}

output "sessions_table_name" {
  description = "octav-sessions table name."
  value       = aws_dynamodb_table.sessions.name
}

output "sessions_table_arn" {
  description = "octav-sessions table ARN."
  value       = aws_dynamodb_table.sessions.arn
}

output "otp_codes_table_name" {
  description = "octav-otp-codes table name."
  value       = aws_dynamodb_table.otp_codes.name
}

output "otp_codes_table_arn" {
  description = "octav-otp-codes table ARN."
  value       = aws_dynamodb_table.otp_codes.arn
}

output "progress_table_name" {
  description = "octav-progress table name."
  value       = aws_dynamodb_table.progress.name
}

output "progress_table_arn" {
  description = "octav-progress table ARN."
  value       = aws_dynamodb_table.progress.arn
}

output "rate_limits_table_name" {
  description = "octav-rate-limits table name."
  value       = aws_dynamodb_table.rate_limits.name
}

output "rate_limits_table_arn" {
  description = "octav-rate-limits table ARN."
  value       = aws_dynamodb_table.rate_limits.arn
}

output "analytics_events_table_name" {
  description = "octav-analytics-events table name."
  value       = aws_dynamodb_table.analytics_events.name
}

output "analytics_events_table_arn" {
  description = "octav-analytics-events table ARN."
  value       = aws_dynamodb_table.analytics_events.arn
}
