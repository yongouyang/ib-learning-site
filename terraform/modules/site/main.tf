# Site module (docs/aws-deployment-plan.md §4): private S3 bucket behind CloudFront
# with Origin Access Control. Cache headers are NOT set here — the deploy
# (`aws s3 sync` with cache-control splits, plan §6 step 5) writes them as S3
# object metadata and the CachingOptimized policy honors them:
#   sw.js / manifest.webmanifest → no-cache; /_next/static/* → immutable.

variable "name_prefix" {
  description = "Prefix for resource names (bucket gets the account ID appended for global uniqueness)."
  type        = string
  default     = "iblearn"
}

variable "price_class" {
  description = "CloudFront price class. 100 (US/EU edges) is enough at family-use scale."
  type        = string
  default     = "PriceClass_100"
}

variable "feedback_origin_domain" {
  description = "Lambda Function URL domain for the feedback API (feedback_api module output). When set, adds the /api/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

data "aws_caller_identity" "current" {}

# --- Static site bucket (private) --------------------------------------------

resource "aws_s3_bucket" "site" {
  bucket = "${var.name_prefix}-site-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Origin Access Control ----------------------------------------------------

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-site-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "site" {
  statement {
    sid       = "AllowCloudFrontOAC"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}

# --- URL rewrite: extensionless URLs → page.html ------------------------------
# Next export emits `subjects/math.html`-style files (Session 1 decision,
# plan §3.4). S3 doesn't resolve extensionless URLs or index documents, so
# this Function maps /foo → /foo.html and /foo/ → /foo.html as well (the
# export has no dir/index.html pages; only the root has one).

resource "aws_cloudfront_function" "url_rewrite" {
  name    = "${var.name_prefix}-url-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Extensionless URLs → .html (Next static export)"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri !== '/' && uri.endsWith('/')) {
        // No dir/index.html in this export — map /foo/ → /foo.html.
        request.uri = uri.slice(0, -1) + '.html';
      } else if (uri === '/') {
        request.uri = '/index.html';
      } else if (!uri.includes('.')) {
        request.uri += '.html';
      }
      return request;
    }
  EOT
}

# --- Distribution -------------------------------------------------------------

# AWS managed cache policy IDs (global constants, not region-specific).
locals {
  cache_policy_caching_optimized = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled  = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  # Origin request policy: forward everything except Host (the Function URL
  # requires its own Host header).
  origin_request_all_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_cloudfront_distribution" "site" {
  comment             = "${var.name_prefix} static site"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = var.price_class
  default_root_object = "index.html"

  origin {
    origin_id                = "s3-site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Feedback Lambda Function URL (Session 3) — present only once wired.
  dynamic "origin" {
    for_each = var.feedback_origin_domain != "" ? [var.feedback_origin_domain] : []
    content {
      origin_id   = "lambda-feedback"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # /api/* → feedback Lambda, never cached, all viewer data forwarded.
  dynamic "ordered_cache_behavior" {
    for_each = var.feedback_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/*"
      target_origin_id         = "lambda-feedback"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.cache_policy_caching_optimized

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }
  }

  # S3 returns 403 (not 404) for missing keys when listing is denied — map
  # both to the app 404 page, preserving the 404 status (plan §8).
  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

output "bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}
