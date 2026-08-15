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

variable "auth_env" {
  description = "Auth Lambda env overrides via CI TF_VAR_auth_env (AUTH_ENV secret); empty = base wiring below."
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
# the CloudFront /api/* behavior.
module "feedback_api" {
  source = "../../modules/feedback_api"

  zip_path           = "${path.module}/../../../lambda/feedback/dist/feedback-lambda.zip"
  environment        = var.feedback_env
  cors_allow_origins = var.site_origins
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
# identity ARN. Base wiring below always selects the real dynamodb/ses
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
  ses_identity_arn      = module.ses.domain_identity_arn

  environment = merge(
    {
      AUTH_STORAGE           = "dynamodb"
      AUTH_EMAIL             = "ses"
      AUTH_USERS_TABLE       = module.dynamodb.users_table_name
      AUTH_SESSIONS_TABLE    = module.dynamodb.sessions_table_name
      AUTH_OTP_TABLE         = module.dynamodb.otp_codes_table_name
      AUTH_PROGRESS_TABLE    = module.dynamodb.progress_table_name
      AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name
      AUTH_SES_REGION        = "ap-southeast-1"
      SES_FROM_ADDRESS       = var.ses_from_address
    },
    var.auth_env,
  )
}

# DEV: private S3 bucket + CloudFront distribution + URL-rewrite Function +
# /api/* proxy behavior to the feedback Lambda. Custom domain: the
# dev.octavlearning.com alias with its dedicated ACM cert (round 2 of the
# dev-subdomain cutover — the cert must be ISSUED before this attaches, so it
# was created in round 1). The cloudfront.net URL keeps working alongside.
module "site" {
  source = "../../modules/site"

  feedback_origin_domain = module.feedback_api.function_url_domain
  auth_origin_domain     = module.auth_api.function_url_domain
  domain_names           = ["dev.octavlearning.com"]
  acm_certificate_arn    = aws_acm_certificate.dev.arn
}

# PROD: separate bucket + distribution fronting octavlearning.com (apex + www
# aliases, ACM cert, www → apex 301 in the rewrite Function). Shares the
# feedback Lambda with DEV. Docs: custom-domain-cutover-plan.md §3.
module "site_prod" {
  source = "../../modules/site"

  name_prefix            = "iblearn-prod"
  feedback_origin_domain = module.feedback_api.function_url_domain
  auth_origin_domain     = module.auth_api.function_url_domain
  domain_names           = ["octavlearning.com", "www.octavlearning.com"]
  acm_certificate_arn    = aws_acm_certificate.site.arn
  redirect_from_host     = "www.octavlearning.com"
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
    users     = { name = module.dynamodb.users_table_name, arn = module.dynamodb.users_table_arn }
    sessions  = { name = module.dynamodb.sessions_table_name, arn = module.dynamodb.sessions_table_arn }
    otp_codes = { name = module.dynamodb.otp_codes_table_name, arn = module.dynamodb.otp_codes_table_arn }
    progress  = { name = module.dynamodb.progress_table_name, arn = module.dynamodb.progress_table_arn }
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
