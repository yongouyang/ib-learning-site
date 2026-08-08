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

module "site" {
  source = "../../modules/site"
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
