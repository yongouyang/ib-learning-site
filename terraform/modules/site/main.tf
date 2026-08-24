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

variable "auth_origin_domain" {
  description = "Lambda Function URL domain for the auth API (auth_api module output). When set, adds the /api/auth/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

variable "progress_origin_domain" {
  description = "Lambda Function URL domain for the progress API (progress_api module output). When set, adds the /api/progress/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

variable "analytics_origin_domain" {
  description = "Lambda Function URL domain for the analytics API (analytics_api module output). When set, adds the /api/analytics/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

variable "admin_origin_domain" {
  description = "Lambda Function URL domain for the admin API (admin_api module output). When set, adds the /api/admin/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

variable "leaderboard_origin_domain" {
  description = "Lambda Function URL domain for the leaderboard API (leaderboard_api module output). When set, adds the /api/leaderboard/* behavior; empty = API not wired."
  type        = string
  default     = ""
}

variable "domain_names" {
  description = "Custom domain aliases (apex + www). Empty = cloudfront.net default cert only. First entry is the canonical host."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM cert ARN (must be us-east-1). Required when domain_names is non-empty; must be ISSUED before apply."
  type        = string
  default     = ""
}

variable "redirect_from_host" {
  description = "Host to 301-redirect to the first domain_names entry (e.g. www → apex). Empty = no redirect (DEV keeps today's behavior)."
  type        = string
  default     = ""
}

# Account ID keeps the bucket name globally unique without hardcoding it.
data "aws_caller_identity" "current" {}

# --- Static site bucket (private) --------------------------------------------

# No website hosting, no public access — the bucket is a pure CloudFront
# origin; every request arrives via the distribution below.
resource "aws_s3_bucket" "site" {
  bucket = "${var.name_prefix}-site-${data.aws_caller_identity.current.account_id}"
}

# Encrypt site objects at rest with S3-managed keys.
resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Bucket stays fully private — the only reader is CloudFront, authorized by
# the bucket policy further down (not by ACLs or public settings).
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Origin Access Control ----------------------------------------------------

# OAC is how CloudFront authenticates to S3: every origin request is signed
# with SigV4 (successor to the legacy Origin Access Identity).
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-site-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Allow the CloudFront service to read objects — but only when the request
# comes from THIS distribution (SourceArn condition), so other distributions
# in any account can't use the bucket as an origin.
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

# When redirect_from_host is set (PROD custom domain), the same Function also
# 301s that host (www) to the apex BEFORE the rewrite, preserving path and
# query string. request.querystring is an object in CloudFront Functions and
# must be serialized entry-by-entry (multiValue included).

# Runs on the viewer-request event of the default behavior, before the cache
# lookup, so the cache key already contains the rewritten .html URI.

# www → apex 301 snippet, injected into the Function code only when
# redirect_from_host is set. Empty for DEV, which keeps the emitted code
# byte-identical to the pre-cutover function (zero-diff guarantee). Kept as a
# separate local because `%{if}` directives leak their line's leading
# whitespace into the output.
locals {
  www_redirect = (
    var.redirect_from_host != "" ? <<-JS
      // ${var.redirect_from_host} → apex 301 (custom domain cutover, plan §2).
      var host = request.headers.host.value;
      if (host === '${var.redirect_from_host}') {
        var qs = [];
        for (var key in request.querystring) {
          var entry = request.querystring[key];
          if (entry.multiValue) {
            for (var i = 0; i < entry.multiValue.length; i++) {
              qs.push(key + '=' + encodeURIComponent(entry.multiValue[i].value));
            }
          } else {
            qs.push(key + '=' + encodeURIComponent(entry.value));
          }
        }
        return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: { location: { value: 'https://${var.domain_names[0]}' + request.uri + (qs.length ? '?' + qs.join('&') : '') } }
        };
      }
    JS
    : ""
  )
}

resource "aws_cloudfront_function" "url_rewrite" {
  name    = "${var.name_prefix}-url-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Extensionless URLs → .html (Next static export)"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
    ${local.www_redirect}  var uri = request.uri;
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

# The analytics handler derives the viewer host (dev vs prod traffic split)
# from X-Forwarded-Host, but the AllViewerExceptHostHeader origin request
# policy does NOT make CloudFront deliver the original viewer Host — verified
# on dev 2026-08-24: every analytics event was attributed to the
# *.lambda-url.* origin domain, so the split collapsed to one host. This
# viewer-request Function copies the viewer's Host into X-Forwarded-Host
# (which the policy then forwards, since it is not Host), restoring the real
# dev/prod attribution. Associated ONLY with /api/analytics/* — no other API
# handler reads the viewer host.
resource "aws_cloudfront_function" "api_host_header" {
  name    = "${var.name_prefix}-api-host-header"
  runtime = "cloudfront-js-2.0"
  comment = "Preserve the viewer Host as X-Forwarded-Host for /api/analytics/*"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      request.headers['x-forwarded-host'] = { value: request.headers.host.value };
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
  aliases             = var.domain_names

  # Origin 1: the private S3 bucket (static site), reached via OAC signing.
  origin {
    origin_id                = "s3-site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Origin 2 (optional): feedback Lambda Function URL (Session 3) — created
  # only once the API is wired (feedback_origin_domain non-empty).
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

  # Origin 3 (optional): auth Lambda Function URL (Phase B) — created only
  # once the API is wired (auth_origin_domain non-empty).
  dynamic "origin" {
    for_each = var.auth_origin_domain != "" ? [var.auth_origin_domain] : []
    content {
      origin_id   = "lambda-auth"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Origin 4 (optional): progress Lambda Function URL (Phase C) — created only
  # once the API is wired (progress_origin_domain non-empty).
  dynamic "origin" {
    for_each = var.progress_origin_domain != "" ? [var.progress_origin_domain] : []
    content {
      origin_id   = "lambda-progress"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Origin 5 (optional): analytics Lambda Function URL (Phase A) — created only
  # once the API is wired (analytics_origin_domain non-empty).
  dynamic "origin" {
    for_each = var.analytics_origin_domain != "" ? [var.analytics_origin_domain] : []
    content {
      origin_id   = "lambda-analytics"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Origin 6 (optional): admin Lambda Function URL (Feature 2) — created only
  # once the API is wired (admin_origin_domain non-empty).
  dynamic "origin" {
    for_each = var.admin_origin_domain != "" ? [var.admin_origin_domain] : []
    content {
      origin_id   = "lambda-admin"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Origin 7 (optional): leaderboard Lambda Function URL (Phase D) — created
  # only once the API is wired (leaderboard_origin_domain non-empty).
  dynamic "origin" {
    for_each = var.leaderboard_origin_domain != "" ? [var.leaderboard_origin_domain] : []
    content {
      origin_id   = "lambda-leaderboard"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # /api/auth/* → auth Lambda, never cached, all viewer data forwarded. This
  # more specific pattern MUST precede the /api/* behavior below — CloudFront
  # matches ordered behaviors top-down, so /api/auth/* must win over /api/*.
  dynamic "ordered_cache_behavior" {
    for_each = var.auth_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/auth/*"
      target_origin_id         = "lambda-auth"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # Bare /api/progress (exact path, no wildcard) → progress Lambda. A
  # "/api/progress/*" pattern requires the trailing slash segment, so without
  # this behavior the bare path falls through to /api/* → the FEEDBACK Lambda
  # (silently breaking GET /api/progress merge-on-login snapshots in prod/dev
  # since Phase C — surfaced by the Phase D7 smoke, 2026-08-24). Listed
  # immediately before its /* sibling; both must precede /api/*.
  dynamic "ordered_cache_behavior" {
    for_each = var.progress_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/progress"
      target_origin_id         = "lambda-progress"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # /api/progress/* → progress Lambda, never cached, all viewer data forwarded.
  # Same specificity as /api/auth/* — both are more specific than /api/* and
  # must be listed before it; their order relative to each other doesn't
  # matter (the patterns don't overlap), so progress follows auth.
  dynamic "ordered_cache_behavior" {
    for_each = var.progress_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/progress/*"
      target_origin_id         = "lambda-progress"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # /api/analytics/* → analytics Lambda, never cached, all viewer data
  # forwarded. More specific than /api/* and must be listed BEFORE it
  # (CloudFront matches ordered behaviors top-down). The api_host_header
  # viewer-request Function preserves the viewer Host as X-Forwarded-Host so
  # the analytics handler records the real dev/prod host (the managed
  # AllViewerExceptHostHeader policy alone does not deliver it).
  dynamic "ordered_cache_behavior" {
    for_each = var.analytics_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/analytics/*"
      target_origin_id         = "lambda-analytics"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.api_host_header.arn
      }
    }
  }

  # Bare /api/leaderboard (exact path) → leaderboard Lambda. Same fall-through
  # bug as /api/progress: without it, the board endpoint GET /api/leaderboard
  # hits the feedback Lambda (surfaced by the Phase D7 smoke, 2026-08-24).
  dynamic "ordered_cache_behavior" {
    for_each = var.leaderboard_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/leaderboard"
      target_origin_id         = "lambda-leaderboard"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # /api/admin/* → admin Lambda, never cached, all viewer data forwarded. More
  # specific than /api/* and must be listed BEFORE it (Feature 2).
  dynamic "ordered_cache_behavior" {
    for_each = var.admin_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/admin/*"
      target_origin_id         = "lambda-admin"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # /api/leaderboard/* → leaderboard Lambda, never cached, all viewer data
  # forwarded. More specific than /api/* and must be listed BEFORE it
  # (CloudFront matches ordered behaviors top-down).
  dynamic "ordered_cache_behavior" {
    for_each = var.leaderboard_origin_domain != "" ? [1] : []
    content {
      path_pattern             = "/api/leaderboard/*"
      target_origin_id         = "lambda-leaderboard"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_all_except_host
    }
  }

  # /api/* → feedback Lambda, never cached, all viewer data forwarded.
  # Ordered behaviors are evaluated before the default behavior.
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

  # Everything else → S3. CachingOptimized honors the per-object cache-control
  # metadata written by the deploy sync; the rewrite Function runs first.
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

  # No geo-blocking — serve all countries.
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # TLS: ACM cert (us-east-1) when a custom domain is attached, otherwise the
  # default *.cloudfront.net certificate. Two mutually exclusive dynamic
  # blocks — a single block with acm_certificate_arn = "" alongside
  # cloudfront_default_certificate = true risks a provider validation error.
  dynamic "viewer_certificate" {
    for_each = length(var.domain_names) > 0 ? [1] : []
    content {
      acm_certificate_arn      = var.acm_certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }
  dynamic "viewer_certificate" {
    for_each = length(var.domain_names) == 0 ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
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

# Full public URL — used in the deploy smoke checks.
output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}
