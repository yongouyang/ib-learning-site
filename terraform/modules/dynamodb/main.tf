# DynamoDB module (docs/architecture-evolution-plan.md §2.3/§3.2, §6.1 +
# docs/leaderboard-plan.md §5): the accounts-feature tables plus the Phase D
# leaderboard table, all on-demand (pay-per-request) billing —
# $0 until used, no capacity planning. No Lambdas here; those land with their
# phases and consume these tables via the outputs below.
#
# Data protection (2026-09-17). Two independent controls, two different
# failure modes — deletion protection stops the TABLE being dropped,
# point-in-time recovery (PITR) undoes bad writes and rogue deletes inside it:
#   * `deletion_protection_enabled = true` on all NINE application tables, so
#     an accidental apply, a console slip or a `terraform destroy` cannot
#     remove production data. Deliberately NOT set on the bootstrap
#     state-lock table (iblearn-tfstate-lock) — protecting a lock table can
#     obstruct bootstrap re-creation, and losing a lock is not a data loss.
#   * PITR is on only where the contents are not regenerable: users,
#     progress, analytics-events, leaderboard, contact. Sessions, OTP codes,
#     rate-limit counters and support alerts are TTL'd and recreate
#     themselves (alerts re-derive from a bot re-run over the contact +
#     analytics-events sources, which DO have PITR), so paying to restore
#     them would be paying to recover rows nobody wants back.
# Cost of the PITR five is ~$0.25/GB-month (ap-east-1) on ~227 KB of data —
# effectively zero today.
#
# Enabling PITR changes what the privacy notice is allowed to claim (a 35-day
# window means deleted data is restorable for that long), so
# docs/privacy-notice-draft.md §9 is the PAIRED edit for any change here.
# Restores are never in place: PITR always creates a NEW table, and a restore
# does not carry over IAM policies, TTL settings or PITR itself.

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

  deletion_protection_enabled = true

  point_in_time_recovery {
    enabled = true
  }

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

  deletion_protection_enabled = true

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

  deletion_protection_enabled = true

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

  deletion_protection_enabled = true

  point_in_time_recovery {
    enabled = true
  }

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

  deletion_protection_enabled = true

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

  deletion_protection_enabled = true

  point_in_time_recovery {
    enabled = true
  }

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

# --- octav-leaderboard ---------------------------------------------------------
# Phase D leaderboard (docs/leaderboard-plan.md §5): one row per
# (profile, scope, week) — PK scopeWeek ("<scope>#<weekKey>#<cohortId>"), SK
# entry (the profileId). XP is an atomic ADD target; expiresAt (week end + 14d)
# TTLs finished boards. The user-index GSI (PK userId) powers right-to-erasure
# deletes (account deletion + opt-out, via the auth Lambda). On-demand billing
# — a board partition is tens-to-hundreds of items, read fully and ranked
# in-Lambda (DynamoDB can't sort on the xp attribute).
resource "aws_dynamodb_table" "leaderboard" {
  name         = "${var.name_prefix}-leaderboard"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "scopeWeek"
  range_key    = "entry"

  deletion_protection_enabled = true

  point_in_time_recovery {
    enabled = true
  }

  attribute {
    name = "scopeWeek"
    type = "S"
  }

  attribute {
    name = "entry"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "user-index"
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

# --- octav-contact -------------------------------------------------------------
# Feature 3 Contact Us (docs/supportability-features-plan.md §"Data model —
# octav-contact"): one item per message — PK messageId (UUID v4, generated
# server-side), expiresAt TTLs messages at createdAt + 365 days. No SK, no GSI:
# writes are append-only Puts by PK and admin reads go through the Feature 2
# CRUD dashboard (Scan). On-demand billing — the volume is a handful of
# messages a day.
resource "aws_dynamodb_table" "contact" {
  name         = "${var.name_prefix}-contact"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  deletion_protection_enabled = true

  point_in_time_recovery {
    enabled = true
  }

  attribute {
    name = "messageId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- octav-support-alerts ------------------------------------------------------
# Support bot (docs/support-bot-plan.md §4): one item per alert — PK alertId
# (which IS the dedup key, so a conditional PutItem makes concurrent runs
# idempotent), GSI1 status → createdAt lists alerts by status newest-first
# (the dashboard + the daily report's open-alerts section), expiresAt TTLs
# alerts at createdAt + 90 days. Deletion protection ON like every application
# table; PITR deliberately OFF (the rate-limits class, not the contact class):
# the rows are TTL'd operational data re-derivable by re-running the bot over
# octav-contact + octav-analytics-events, which both have PITR.
resource "aws_dynamodb_table" "support_alerts" {
  name         = "${var.name_prefix}-support-alerts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "alertId"

  deletion_protection_enabled = true

  attribute {
    name = "alertId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "status"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "createdAt"
      key_type       = "RANGE"
    }
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

output "leaderboard_table_name" {
  description = "octav-leaderboard table name."
  value       = aws_dynamodb_table.leaderboard.name
}

output "leaderboard_table_arn" {
  description = "octav-leaderboard table ARN."
  value       = aws_dynamodb_table.leaderboard.arn
}

output "leaderboard_user_index_name" {
  description = "octav-leaderboard erasure GSI name (PK userId)."
  value       = "user-index"
}

output "contact_table_name" {
  description = "octav-contact table name."
  value       = aws_dynamodb_table.contact.name
}

output "contact_table_arn" {
  description = "octav-contact table ARN."
  value       = aws_dynamodb_table.contact.arn
}

output "support_alerts_table_name" {
  description = "octav-support-alerts table name."
  value       = aws_dynamodb_table.support_alerts.name
}

output "support_alerts_table_arn" {
  description = "octav-support-alerts table ARN."
  value       = aws_dynamodb_table.support_alerts.arn
}
