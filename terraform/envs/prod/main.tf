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

variable "site_origin" {
  description = "Public site origin for Function URL CORS. Hardcoded to the known distribution domain: deriving it from module.site would create a dependency cycle (distribution ↔ /api/* behavior ↔ this module)."
  type        = string
  default     = "https://d2c1g77zfmjpm3.cloudfront.net"
}

# Feedback API first: the site module needs its Function URL domain to wire
# the CloudFront /api/* behavior.
module "feedback_api" {
  source = "../../modules/feedback_api"

  zip_path           = "${path.module}/../../../lambda/feedback/dist/feedback-lambda.zip"
  environment        = var.feedback_env
  cors_allow_origins = [var.site_origin]
}

# Private S3 bucket + CloudFront distribution + URL-rewrite Function +
# /api/* proxy behavior to the feedback Lambda.
module "site" {
  source = "../../modules/site"

  feedback_origin_domain = module.feedback_api.function_url_domain
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

output "feedback_function_url" {
  value = module.feedback_api.function_url
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN variable in GitHub repo settings (Settings → Secrets and variables → Actions → Variables)."
  value       = module.ci.role_arn
}
