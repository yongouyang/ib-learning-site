# Production environment (docs/aws-deployment-plan.md §4). Remote state lives in
# the bootstrap stack's bucket/table — run terraform/bootstrap first. This is
# the stack CI applies on every deploy; it composes the three modules below.

terraform {
  required_version = ">= 1.9"

  # AWS provider ~> 6.0 — required for the Lambda nodejs24.x runtime
  # (provider 5.x's runtime enum ended at nodejs22.x).
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state in the bootstrap bucket, locked via DynamoDB so concurrent
  # applies can't corrupt it. Backend blocks can't use variables, so these
  # values duplicate the bootstrap outputs — if bootstrap is ever re-created
  # with different names/region, update them here to match.
  backend "s3" {
    bucket         = "iblearn-tfstate-305655353474"
    key            = "prod/terraform.tfstate"
    region         = "ap-east-1"
    dynamodb_table = "iblearn-tfstate-lock"
    encrypt        = true
  }
}

# Credentials: AWS_PROFILE=ib-learning-site locally, OIDC deploy role in CI.
provider "aws" {
  region = var.region

  # Tags applied automatically to every taggable resource in this stack.
  default_tags {
    tags = {
      Project     = "IBLearn"
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}

# CloudFront requires the ACM cert in us-east-1 even though the stack lives in
# ap-east-1. Used only by the PROD site instance's certificate (custom domain
# cutover — docs/custom-domain-cutover-plan.md §1).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "IBLearn"
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}

# SES has no ap-east-1 endpoint (email.ap-east-1.amazonaws.com does not
# resolve — the first accounts Phase 0 apply failed on this), so the SES
# domain identity lives in ap-southeast-1 (Singapore — closest SES region to
# the Hong Kong users). Passed into module.ses via `providers`.
provider "aws" {
  alias  = "ap_southeast_1"
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project     = "IBLearn"
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}

# Must match the region of the bootstrap state bucket (see backend above).
variable "region" {
  description = "Home region (matches the bootstrap state bucket region)."
  type        = string
  default     = "ap-east-1"
}

variable "feedback_env" {
  description = "Feedback Lambda env vars (FEEDBACK_PROVIDER etc.). Empty = unconfigured: GET { configured: false }, POST 501, UI hides the button. Set via CI secrets or a gitignored tfvars — never commit keys."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "site_origins" {
  description = "Public site origins for Function URL CORS. Hardcoded to the known distribution/domain URLs: deriving them from the site modules would create a dependency cycle (distribution ↔ /api/* behavior ↔ feedback module). Keep ALL entries — dropping the dev origin breaks Mark with AI on the dev URL."
  type        = list(string)
  default = [
    "https://d2c1g77zfmjpm3.cloudfront.net", # DEV (cloudfront.net URL)
    "https://dev.octavlearning.com",         # DEV custom subdomain
    "https://octavlearning.com",             # PROD apex
    "https://www.octavlearning.com",         # pre-redirect direct hits
  ]
}

# Accounts feature (docs/architecture-evolution-plan.md §6.4) — values come
# from GitHub secrets/variables via CI (same pattern as feedback_env); the
# defaults keep a local plan/validate self-contained but are overridden by the
# deploy jobs. Shared across DEV and PROD (single-state setup, like the
# feedback Lambda).
variable "dynamodb_table_prefix" {
  description = "Prefix for the accounts-feature DynamoDB tables (octav-users, octav-sessions, octav-otp-codes, octav-progress). Set via the DYNAMODB_TABLE_PREFIX repo variable."
  type        = string
  default     = "octav"
}

variable "ses_from_address" {
  description = "SES from-address for OTP emails (must be on the verified octavlearning.com domain). Set via the SES_FROM_ADDRESS repo secret."
  type        = string
  default     = "noreply@octavlearning.com"
}

variable "email_provider" {
  description = "Email provider JSON {\"NAME\":\"resend|ses|dummy\",\"API_KEY\":\"...\"} set via the EMAIL_PROVIDER repo secret (single-line, straight quotes). \"{}\" = fall back to the AUTH_EMAIL base wiring (ses)."
  type        = string
  default     = "{}"
  sensitive   = true
}

variable "auth_env" {
  description = "Auth Lambda env overrides via CI TF_VAR_auth_env (AUTH_ENV secret); empty = base wiring below."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "progress_env" {
  description = "Progress Lambda env overrides via CI TF_VAR_progress_env (PROGRESS_ENV secret); empty = base wiring below. No new secret is required — the base wiring already names the shared DynamoDB tables."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "analytics_env" {
  description = "Analytics Lambda env overrides via CI TF_VAR_analytics_env (ANALYTICS_ENV secret); empty = base wiring below."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "analytics_admin_emails" {
  description = "Comma-separated admin email allowlist for GET /api/analytics/summary. Set via the ANALYTICS_ADMIN_EMAILS repo variable (not a secret — it is an allowlist, not a credential)."
  type        = string
  default     = ""
}

# DEV environment access gate (docs/stripe-subscriptions-plan.md §6.8): the DEV
# and PROD distributions share the same Lambdas, so without this allowlist
# anyone who finds dev.octavlearning.com can use the app against production
# data. Set via the DEV_ALLOWED_EMAILS repo secret (TF_VAR_dev_allowed_emails).
# EMPTY LEAVES THE GATE INERT by design — a missing value must not brick
# staging. The deploy-dev smoke test is the guard from the other side: it
# asserts 403 on request-otp, so an unset value turns that smoke red.
variable "dev_allowed_emails" {
  description = "Comma-separated allowlist of accounts permitted to use the DEV environment's /api/*. Set via the DEV_ALLOWED_EMAILS repo secret; empty = gate inert."
  type        = string
  default     = ""
  sensitive   = true
}

variable "admin_env" {
  description = "Admin Lambda env overrides via CI TF_VAR_admin_env (ADMIN_ENV secret); empty = base wiring below."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "analytics_report_env" {
  description = "Analytics-report Lambda env overrides via CI TF_VAR_analytics_report_env (ANALYTICS_REPORT_ENV secret); empty = base wiring below (EMAIL_PROVIDER + ANALYTICS_ADMIN_EMAILS already come from the shared repo secret/variable)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "contact_env" {
  description = "Contact Lambda env overrides via CI TF_VAR_contact_env (CONTACT_ENV secret); empty = base wiring below (EMAIL_PROVIDER + ANALYTICS_ADMIN_EMAILS already come from the shared repo secret/variable)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

# ACM cert for octavlearning.com (apex + www), DNS-validated. Lives at the
# root (not the site module) so only the PROD site instance references it —
# the DEV distribution keeps the CloudFront default cert. Validated via two
# one-time manual CNAMEs in CloudFlare (see output below); keep those records
# forever — ACM auto-renewal re-checks them.
resource "aws_acm_certificate" "site" {
  provider                  = aws.us_east_1
  domain_name               = "octavlearning.com"
  subject_alternative_names = ["www.octavlearning.com"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }
}

# ACM cert for dev.octavlearning.com (DEV custom subdomain). Deliberately a
# SEPARATE cert from the prod one: adding a SAN to the prod cert would replace
# it (new ARN) and pull the PROD distribution into the change cone. Validated
# via one manual CloudFlare CNAME (output below) — keep that record forever,
# ACM auto-renewal re-checks it. Two-round sequencing (same as the prod
# cutover): this cert must exist and be ISSUED before module.site can attach
# the alias, so the alias + cert reference land in a follow-up change.
resource "aws_acm_certificate" "dev" {
  provider          = aws.us_east_1
  domain_name       = "dev.octavlearning.com"
  validation_method = "DNS"

  lifecycle { create_before_destroy = true }
}

# Feedback API first: the site module needs its Function URL domain to wire
# the CloudFront /api/* behavior. Phase E2: the handler authenticates (shared
# resolveSession over users/sessions) and enforces the monthly AI-mark quota
# in octav-rate-limits, so the base wiring below selects the real dynamodb
# storage and names the shared tables — var.feedback_env (the FEEDBACK_ENV
# secret) only needs the provider config (FEEDBACK_PROVIDER etc.) and can
# still override anything.
module "feedback_api" {
  source = "../../modules/feedback_api"

  zip_path           = "${path.module}/../../../lambda/feedback/dist/feedback-lambda.zip"
  cors_allow_origins = var.site_origins

  users_table_arn       = module.dynamodb.users_table_arn
  sessions_table_arn    = module.dynamodb.sessions_table_arn
  rate_limits_table_arn = module.dynamodb.rate_limits_table_arn

  environment = merge(
    {
      FEEDBACK_STORAGE       = "dynamodb"
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      DEV_ALLOWED_EMAILS     = var.dev_allowed_emails
    },
    var.feedback_env,
  )
}

# Accounts feature — Phase 0 (docs/architecture-evolution-plan.md §6): the
# DynamoDB tables + SES domain identity only. No Lambdas yet — those land with
# their phases (auth/progress/leaderboard) and consume these module outputs.
# Shared between DEV and PROD like the feedback Lambda.
module "dynamodb" {
  source = "../../modules/dynamodb"

  name_prefix = var.dynamodb_table_prefix
}

module "ses" {
  source = "../../modules/ses"

  # SES is not available in ap-east-1 (no email.ap-east-1.amazonaws.com
  # endpoint) — the identity/DKIM live in ap-southeast-1.
  providers = {
    aws = aws.ap_southeast_1
  }

  domain       = "octavlearning.com"
  from_address = var.ses_from_address
}

# Auth API (Phase B — docs/architecture-evolution-plan.md §6): the email-OTP
# Lambda + Function URL. Consumes the DynamoDB table names/ARNs and the SES
# FROM address (IAM sender restriction). Base wiring below always selects the
# real dynamodb/ses
# implementations; var.auth_env (CI AUTH_ENV secret) can override/add — leave
# it empty to use these defaults. SES has no ap-east-1 endpoint, so
# AUTH_SES_REGION points the SESv2 client at ap-southeast-1 (where the
# identity lives); the function itself still runs in ap-east-1.
module "auth_api" {
  source = "../../modules/auth_api"

  zip_path = "${path.module}/../../../lambda/auth/dist/auth-lambda.zip"

  cors_allow_origins = var.site_origins

  users_table_arn       = module.dynamodb.users_table_arn
  sessions_table_arn    = module.dynamodb.sessions_table_arn
  otp_codes_table_arn   = module.dynamodb.otp_codes_table_arn
  progress_table_arn    = module.dynamodb.progress_table_arn
  rate_limits_table_arn = module.dynamodb.rate_limits_table_arn
  leaderboard_table_arn = module.dynamodb.leaderboard_table_arn
  ses_from_address      = var.ses_from_address

  environment = merge(
    {
      AUTH_STORAGE           = "dynamodb"
      AUTH_EMAIL             = "ses"
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_OTP_TABLE         = module.dynamodb.otp_codes_table_name
      AUTH_PROGRESS_TABLE    = module.dynamodb.progress_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      # D5 opt-out erasure (docs/leaderboard-plan.md §7): without this the
      # auth deps leave leaderboardStorage undefined and row deletion is a
      # no-op.
      LEADERBOARD_TABLE  = module.dynamodb.leaderboard_table_name
      AUTH_SES_REGION    = "ap-southeast-1"
      SES_FROM_ADDRESS   = var.ses_from_address
      EMAIL_PROVIDER     = var.email_provider
      DEV_ALLOWED_EMAILS = var.dev_allowed_emails
    },
    var.auth_env,
  )
}

# Progress API (Phase C — docs/architecture-evolution-plan.md §3): the
# cross-device sync Lambda + Function URL. Consumes the shared users/sessions/
# progress/rate-limits table names/ARNs from module.dynamodb. Base wiring below
# always selects the real dynamodb implementation; var.progress_env (CI
# PROGRESS_ENV secret) can override/add — leave it empty to use these
# defaults. NO new secret is required: session validation + progress storage
# both live on the same Phase 0 tables the auth Lambda already uses, and the
# durable sync budget shares octav-rate-limits, so the base wiring below is
# complete on its own.
module "progress_api" {
  source = "../../modules/progress_api"

  zip_path = "${path.module}/../../../lambda/progress/dist/progress-lambda.zip"

  cors_allow_origins = var.site_origins

  users_table_arn       = module.dynamodb.users_table_arn
  sessions_table_arn    = module.dynamodb.sessions_table_arn
  progress_table_arn    = module.dynamodb.progress_table_arn
  rate_limits_table_arn = module.dynamodb.rate_limits_table_arn
  leaderboard_table_arn = module.dynamodb.leaderboard_table_arn

  environment = merge(
    {
      PROGRESS_STORAGE       = "dynamodb"
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_PROGRESS_TABLE    = module.dynamodb.progress_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      # D4 XP award hook (docs/leaderboard-plan.md §6): without this the
      # progress deps leave leaderboardStorage undefined and awarding is
      # disabled (sync unaffected).
      LEADERBOARD_TABLE  = module.dynamodb.leaderboard_table_name
      DEV_ALLOWED_EMAILS = var.dev_allowed_emails
    },
    var.progress_env,
  )
}

# Leaderboard API (Phase D — docs/leaderboard-plan.md §6): the READ-ONLY board
# Lambda + Function URL (board + public teaser + _health). Consumes the shared
# users/sessions tables (session validation) and the octav-leaderboard table.
# Base wiring below always selects the real dynamodb implementation; no
# overrides variable — there is nothing secret in this wiring.
module "leaderboard_api" {
  source = "../../modules/leaderboard_api"

  zip_path = "${path.module}/../../../lambda/leaderboard/dist/leaderboard-lambda.zip"

  cors_allow_origins = var.site_origins

  users_table_arn       = module.dynamodb.users_table_arn
  sessions_table_arn    = module.dynamodb.sessions_table_arn
  leaderboard_table_arn = module.dynamodb.leaderboard_table_arn

  environment = {
    LEADERBOARD_STORAGE = "dynamodb"
    AUTH_USERS_TABLE    = module.dynamodb.users_table_name
    AUTH_SESSIONS_TABLE = module.dynamodb.sessions_table_name
    LEADERBOARD_TABLE   = module.dynamodb.leaderboard_table_name
    DEV_ALLOWED_EMAILS  = var.dev_allowed_emails
  }
}

# Analytics API (Phase A — docs/phase-a-analytics-plan.md): the ingest/summary
# Lambda. Consumes the analytics events table + the shared rate-limits table
# (ingest budget) + users/sessions (summary session validation). Base wiring
# below always selects the real dynamodb implementation; var.analytics_env (CI
# ANALYTICS_ENV secret) can override/add — leave it empty to use these
# defaults. ANALYTICS_ADMIN_EMAILS comes from the repo variable (set in CI).
module "analytics_api" {
  source = "../../modules/analytics_api"

  zip_path = "${path.module}/../../../lambda/analytics/dist/analytics-lambda.zip"

  cors_allow_origins = var.site_origins

  users_table_arn            = module.dynamodb.users_table_arn
  sessions_table_arn         = module.dynamodb.sessions_table_arn
  analytics_events_table_arn = module.dynamodb.analytics_events_table_arn
  rate_limits_table_arn      = module.dynamodb.rate_limits_table_arn

  environment = merge(
    {
      ANALYTICS_STORAGE      = "dynamodb"
      ANALYTICS_TABLE        = module.dynamodb.analytics_events_table_name
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      ANALYTICS_ADMIN_EMAILS = var.analytics_admin_emails
      DEV_ALLOWED_EMAILS     = var.dev_allowed_emails
    },
    var.analytics_env,
  )
}

# Admin CRUD dashboard API (Feature 2 — docs/supportability-features-plan.md):
# the broad admin DynamoDB browser Lambda. Reuses the shared users/sessions
# tables for session validation and the ANALYTICS_ADMIN_EMAILS allowlist for the
# admin gate. Base wiring below always selects the real dynamodb implementation;
# var.admin_env (CI ADMIN_ENV secret) can override/add — leave it empty to use
# these defaults.
module "admin_api" {
  source = "../../modules/admin_api"

  zip_path = "${path.module}/../../../lambda/admin/dist/admin-lambda.zip"

  cors_allow_origins = var.site_origins

  environment = merge(
    {
      ADMIN_STORAGE          = "dynamodb"
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      ANALYTICS_ADMIN_EMAILS = var.analytics_admin_emails
      DEV_ALLOWED_EMAILS     = var.dev_allowed_emails
    },
    var.admin_env,
  )
}

# Daily analytics report (Feature 1 — docs/supportability-features-plan.md): an
# EventBridge-SCHEDULED Lambda (cron 0 11 * * ? * = 7pm HKT), NOT an HTTP API —
# no Function URL, no CloudFront behavior. It Query-reads the aggregate rows on
# octav-analytics-events and emails the report to every ANALYTICS_ADMIN_EMAILS
# recipient via Resend (EMAIL_PROVIDER — the SAME repo secret the auth Lambda
# uses). Base wiring below selects the real dynamodb implementation; if
# EMAIL_PROVIDER were unset, the Lambda FAILS CLOSED at invocation (deps refuse
# a no-op sender in dynamodb mode) — the report is never silently dropped.
module "analytics_report" {
  source = "../../modules/analytics_report"

  zip_path = "${path.module}/../../../lambda/analytics-report/dist/analytics-report-lambda.zip"

  analytics_events_table_arn = module.dynamodb.analytics_events_table_arn

  environment = merge(
    {
      ANALYTICS_REPORT_STORAGE = "dynamodb"
      ANALYTICS_TABLE          = module.dynamodb.analytics_events_table_name
      EMAIL_PROVIDER           = var.email_provider
      ANALYTICS_ADMIN_EMAILS   = var.analytics_admin_emails
    },
    var.analytics_report_env,
  )
}

# Contact Us API (Feature 3 — docs/supportability-features-plan.md §C5): the
# PUBLIC contact-form Lambda + Function URL (POST /api/contact + _health).
# Consumes the shared users/sessions tables (optional session attribution via
# resolveSession), octav-rate-limits (the per-IP fixed-window budget), and the
# octav-contact table. EMAIL_PROVIDER (NAME must be "resend" — the deps fail
# closed otherwise) + ANALYTICS_ADMIN_EMAILS come from the SAME repo
# secret/variable the auth + analytics-report Lambdas use — no new secret. Base
# wiring below always selects the real dynamodb implementation; var.contact_env
# (CI CONTACT_ENV secret) can override/add — leave it empty to use these
# defaults.
module "contact_api" {
  source = "../../modules/contact_api"

  zip_path = "${path.module}/../../../lambda/contact/dist/contact-lambda.zip"

  cors_allow_origins = var.site_origins

  users_table_arn       = module.dynamodb.users_table_arn
  sessions_table_arn    = module.dynamodb.sessions_table_arn
  rate_limits_table_arn = module.dynamodb.rate_limits_table_arn
  contact_table_arn     = module.dynamodb.contact_table_arn

  environment = merge(
    {
      CONTACT_STORAGE        = "dynamodb"
      CONTACT_TABLE          = module.dynamodb.contact_table_name
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      EMAIL_PROVIDER         = var.email_provider
      ANALYTICS_ADMIN_EMAILS = var.analytics_admin_emails
      SES_FROM_ADDRESS       = var.ses_from_address
    },
    var.contact_env,
  )
}

# DEV: private S3 bucket + CloudFront distribution + URL-rewrite Function +
# /api/* proxy behavior to the feedback Lambda. Custom domain: the
# dev.octavlearning.com alias with its dedicated ACM cert (round 2 of the
# dev-subdomain cutover — the cert must be ISSUED before this attaches, so it
# was created in round 1). The cloudfront.net URL keeps working alongside.
module "site" {
  source = "../../modules/site"

  feedback_origin_domain    = module.feedback_api.function_url_domain
  auth_origin_domain        = module.auth_api.function_url_domain
  progress_origin_domain    = module.progress_api.function_url_domain
  analytics_origin_domain   = module.analytics_api.function_url_domain
  leaderboard_origin_domain = module.leaderboard_api.function_url_domain
  admin_origin_domain       = module.admin_api.function_url_domain
  contact_origin_domain     = module.contact_api.function_url_domain
  domain_names              = ["dev.octavlearning.com"]
  acm_certificate_arn       = aws_acm_certificate.dev.arn
  dev_brand_rewrite         = true
}

# PROD: separate bucket + distribution fronting octavlearning.com (apex + www
# aliases, ACM cert, www → apex 301 in the rewrite Function). Shares the
# feedback Lambda with DEV. Docs: custom-domain-cutover-plan.md §3.
module "site_prod" {
  source = "../../modules/site"

  name_prefix               = "iblearn-prod"
  feedback_origin_domain    = module.feedback_api.function_url_domain
  auth_origin_domain        = module.auth_api.function_url_domain
  progress_origin_domain    = module.progress_api.function_url_domain
  analytics_origin_domain   = module.analytics_api.function_url_domain
  leaderboard_origin_domain = module.leaderboard_api.function_url_domain
  admin_origin_domain       = module.admin_api.function_url_domain
  contact_origin_domain     = module.contact_api.function_url_domain
  domain_names              = ["octavlearning.com", "www.octavlearning.com"]
  acm_certificate_arn       = aws_acm_certificate.site.arn
  redirect_from_host        = "www.octavlearning.com"
}

# GitHub Actions OIDC provider + deploy role — short-lived tokens only,
# no stored AWS keys in GitHub.
module "ci" {
  source = "../../modules/ci"
}

output "site_bucket" {
  value = module.site.bucket_name
}

output "distribution_id" {
  value = module.site.distribution_id
}

output "site_url" {
  value = module.site.site_url
}

# PROD instance (custom domain) — the routing CNAME targets for CloudFlare
# round 2 are the distribution domain below.
output "site_prod_bucket" {
  value = module.site_prod.bucket_name
}

output "site_prod_distribution_id" {
  value = module.site_prod.distribution_id
}

output "site_prod_distribution_domain" {
  value = module.site_prod.distribution_domain_name
}

output "feedback_function_url" {
  value = module.feedback_api.function_url
}

output "auth_function_url" {
  value = module.auth_api.function_url
}

output "progress_function_url" {
  value = module.progress_api.function_url
}

output "leaderboard_function_url" {
  value = module.leaderboard_api.function_url
}

output "contact_function_url" {
  value = module.contact_api.function_url
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN variable in GitHub repo settings (Settings → Secrets and variables → Actions → Variables)."
  value       = module.ci.role_arn
}

# The two one-time manual CloudFlare CNAMEs that validate the cert
# (docs/custom-domain-cutover-plan.md §5 round 1).
output "acm_validation_records" {
  description = "DNS validation CNAMEs for CloudFlare (gray cloud / DNS only)."
  value = {
    for dvo in aws_acm_certificate.site.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, value = dvo.resource_record_value }
  }
}

# The one-time manual CloudFlare CNAME that validates the dev subdomain cert
# (dev.octavlearning.com cutover, round 1).
output "acm_dev_validation_records" {
  description = "DNS validation CNAME for the dev.octavlearning.com cert (CloudFlare, gray cloud / DNS only)."
  value = {
    for dvo in aws_acm_certificate.dev.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, value = dvo.resource_record_value }
  }
}

# Accounts feature — Phase 0 outputs (docs/architecture-evolution-plan.md §6).
# The SES values are the one-time manual CloudFlare records; the table map is
# a reference for the phase Lambdas' env vars.
output "dynamodb_tables" {
  description = "Accounts-feature DynamoDB table names → ARNs."
  value = {
    users       = { name = module.dynamodb.users_table_name, arn = module.dynamodb.users_table_arn }
    sessions    = { name = module.dynamodb.sessions_table_name, arn = module.dynamodb.sessions_table_arn }
    otp_codes   = { name = module.dynamodb.otp_codes_table_name, arn = module.dynamodb.otp_codes_table_arn }
    progress    = { name = module.dynamodb.progress_table_name, arn = module.dynamodb.progress_table_arn }
    leaderboard = { name = module.dynamodb.leaderboard_table_name, arn = module.dynamodb.leaderboard_table_arn }
    contact     = { name = module.dynamodb.contact_table_name, arn = module.dynamodb.contact_table_arn }
  }
}

output "ses_domain_identity_arn" {
  description = "ARN of the verified SES domain identity."
  value       = module.ses.domain_identity_arn
}

output "ses_verification_token" {
  description = "SES domain verification TXT value for CloudFlare (record name _amazonses.octavlearning.com, gray cloud / DNS only)."
  value       = module.ses.verification_token
}

output "ses_dkim_tokens" {
  description = "Three SES DKIM tokens. For each token X, add a CloudFlare CNAME X._domainkey.octavlearning.com → X.dkim.amazonses.com (gray cloud / DNS only)."
  value       = module.ses.dkim_tokens
}
