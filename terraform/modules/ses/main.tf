# SES module (docs/architecture-evolution-plan.md §6.5): verifies the sending
# domain and provisions DKIM so OTP emails deliver reliably. Phase 0 = identity
# only — the OTP auth Lambda (Phase B) is the consumer; moving SES out of the
# sandbox (production access) is a MANUAL AWS console step, NOT managed here.
# SES has NO endpoint in ap-east-1 (email.ap-east-1.amazonaws.com doesn't
# resolve — the first CI apply failed on exactly this), so the caller must
# pass an ap-southeast-1 provider via the `providers` meta-argument.
# SPF + DMARC are manual apex TXT records too (not Terraform): check
# `dig TXT <domain>` first — if an SPF record already exists, merge
# `include:amazonses.com` into it; a second SPF TXT breaks SPF entirely.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.0"
      configuration_aliases = [aws]
    }
  }
}

variable "domain" {
  description = "Sending domain to verify in SES. DKIM/SPF/DMARC records are added manually in CloudFlare (see outputs)."
  type        = string
}

variable "from_address" {
  description = "From-address for OTP emails (must be on the verified domain). Echoed as an output for the auth Lambda phase; no resource is created for it."
  type        = string
}

# Domain identity — the _amazonses TXT record (verification_token output)
# proves ownership of the domain to SES.
resource "aws_ses_domain_identity" "domain" {
  domain = var.domain
}

# DKIM signing keys — three tokens, each added as a CNAME in CloudFlare.
resource "aws_ses_domain_dkim" "domain" {
  domain = aws_ses_domain_identity.domain.domain
}

output "domain_identity_arn" {
  description = "ARN of the verified SES domain identity (for the auth Lambda's send policy in a later phase)."
  value       = aws_ses_domain_identity.domain.arn
}

output "verification_token" {
  description = "Value for the _amazonses TXT record in CloudFlare (gray cloud / DNS only) to verify the domain in SES."
  value       = aws_ses_domain_identity.domain.verification_token
}

output "dkim_tokens" {
  description = "Three DKIM tokens. For each token X, add a CNAME X._domainkey.<domain> → X.dkim.amazonses.com in CloudFlare (gray cloud / DNS only)."
  value       = aws_ses_domain_dkim.domain.dkim_tokens
}

output "from_address" {
  description = "From-address for OTP emails (echo of the module variable, consumed by the auth Lambda phase)."
  value       = var.from_address
}
