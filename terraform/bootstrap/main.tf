# One-time bootstrap (docs/aws-deployment-plan.md §4). Local state on purpose —
# this stack creates the remote-state infrastructure that every other stack
# uses (the classic chicken-and-egg: the state bucket can't hold its own
# state). Re-run is idempotent; resource names are deterministic, so a lost
# local state file is recoverable via `terraform import`.

terraform {
  required_version = ">= 1.9"

  # AWS provider ~> 6.0 — v6 is required for the Lambda nodejs24.x runtime
  # used by the feedback_api module (5.x's runtime enum ended at nodejs22.x).
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Credentials come from the environment — locally AWS_PROFILE=ib-learning-site,
# in CI the OIDC-assumed deploy role.
provider "aws" {
  region = var.region

  # Tags applied automatically to every taggable resource in this stack.
  default_tags {
    tags = {
      Project   = "IBLearn"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

# Sticky once created: the envs/prod backend block hardcodes this region, so
# changing it later means migrating state, not just re-applying.
variable "region" {
  description = "Home region for state infrastructure (sticky once created)."
  type        = string
  default     = "ap-east-1"
}

# Account ID keeps the state bucket name globally unique without hardcoding it.
data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  state_bucket = "iblearn-tfstate-${local.account_id}"
  lock_table   = "iblearn-tfstate-lock"
}

# --- Remote state bucket -----------------------------------------------------

# Holds the terraform.tfstate objects for every env stack (envs/prod writes
# to key prod/terraform.tfstate).
resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket
}

# Versioning = state history: a bad apply can be recovered by rolling the
# state object back to a previous version.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# State files contain resource attributes (and can contain secrets) — encrypt
# at rest with S3-managed keys.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Belt-and-braces: state must never be publicly readable.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- State lock table --------------------------------------------------------

# DynamoDB locking stops two applies (local laptop vs CI) racing on the same
# state file. PAY_PER_REQUEST costs effectively nothing at this scale.
resource "aws_dynamodb_table" "lock" {
  name         = local.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# Outputs are informational — the envs/prod backend block hardcodes these
# values because backend blocks cannot reference outputs or variables.
output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "lock_table" {
  value = aws_dynamodb_table.lock.name
}

output "region" {
  value = var.region
}
