# Production environment (aws-deployment-plan.md §4). Remote state lives in
# the bootstrap stack's bucket/table — run terraform/bootstrap first.

terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "iblearn-tfstate-305655353474"
    key            = "prod/terraform.tfstate"
    region         = "ap-east-1"
    dynamodb_table = "iblearn-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "IBLearn"
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}

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

module "feedback_api" {
  source = "../../modules/feedback_api"

  zip_path           = "${path.module}/../../../lambda/feedback/dist/feedback-lambda.zip"
  environment        = var.feedback_env
  cors_allow_origins = [var.site_origin]
}

module "site" {
  source = "../../modules/site"

  feedback_origin_domain = module.feedback_api.function_url_domain
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
