# Custom Domain Cutover + DEV/PROD Environments — octavlearning.com

> Originally drafted 2026-08-10 by GLM-5.2 as a single-distribution alias plan;
> **rewritten 2026-08-11** after review: adopts the two-distribution DEV/PROD
> split (user decision) and fixes four defects in the original (cross-module
> cert reference, first-apply alias hazard, querystring serialization bug in
> the www redirect, CORS regression dropping the dev origin).
> Expands `docs/aws-deployment-plan.md` §7.

## Decisions (confirmed 2026-08-11)

| # | Decision | Choice |
|---|---|---|
| 1 | Topology | **Two distributions**: existing = DEV (develop branch), new = PROD (release branch), octavlearning.com on PROD only |
| 2 | Release flow | **`main` branch**, develop → main via PR, push to `main` auto-deploys PROD after all gates; `deploy_only` dispatch needs **no env picker** — the branch chosen at dispatch time selects the env (user decision, 2026-08-11) |
| 3 | Feedback API | **Shared Lambda** — both distributions proxy `/api/*` to the one Function URL; CORS allows dev + apex + www origins |

## Target topology

| | DEV | PROD |
|---|---|---|
| URL | `https://d2c1g77zfmjpm3.cloudfront.net` | `https://octavlearning.com` (www → apex 301) |
| Branch | `develop` (auto-deploy, current behavior) | `main` (auto-deploy on push, all gates) |
| Infra | **existing** bucket `iblearn-site-305655353474` + distribution `E1BMVEW6YOKNUY` — zero terraform changes | **new** bucket + distribution + ACM cert + aliases |
| TLS | CloudFront default cert (unchanged) | ACM cert, us-east-1, apex + www |
| Feedback API | shared Lambda via `/api/*` | shared Lambda via `/api/*` |

Cost delta: +1 distribution + 1 bucket ≈ $1–3/mo at current traffic.

## Current state (verified 2026-08-11)

- `terraform/modules/site/main.tf` — parameterized by `name_prefix` and `feedback_origin_domain`; no `aliases` block; `viewer_certificate` uses the default cert (line ~222); URL-rewrite Function at lines 102–123; outputs `bucket_name`, `distribution_id`, `distribution_domain_name`.
- `terraform/envs/prod/main.tf:58-62` — `site_origin` default is the cloudfront URL (Lambda CORS).
- `.github/workflows/ci.yml:197` — `SITE_URL` for smoke checks is the cloudfront URL.
- `src/app/layout.tsx` — `metadataBase` already `https://octavlearning.com` ✅.
- Branches: only `develop` exists. DNS: CloudFlare (registrar + DNS, no Route 53).

## 1. Terraform — ACM certificate (root, not the module)

**File: `terraform/envs/prod/main.tf`** — the cert lives at root so only the PROD
site instance references it (avoids the original plan's broken
`aws_acm_certificate.site` cross-module reference):

```hcl
# CloudFront requires the cert in us-east-1 even though the stack is ap-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "site" {
  provider                  = aws.us_east_1
  domain_name               = "octavlearning.com"
  subject_alternative_names = ["www.octavlearning.com"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }
}

# Values for the one-time manual CloudFlare records.
output "acm_validation_records" {
  value = {
    for dvo in aws_acm_certificate.site.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, value = dvo.resource_record_value }
  }
}
```

## 2. Terraform — site module: optional custom domain

**File: `terraform/modules/site/main.tf`** — new variables:

```hcl
variable "domain_names" {
  description = "Custom domain aliases (apex + www). Empty = cloudfront.net default only."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM cert ARN (us-east-1). Required when domain_names is non-empty."
  type        = string
  default     = ""
}

variable "redirect_from_host" {
  description = "Host to 301-redirect to the first domain_names entry (e.g. www → apex). Empty = no redirect."
  type        = string
  default     = ""
}
```

Distribution resource: `aliases = var.domain_names`, and replace the
`viewer_certificate` block with **dynamic blocks** (the original plan's
`acm_certificate_arn = ""` alongside `cloudfront_default_certificate = true`
risks a provider validation error):

```hcl
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
    content { cloudfront_default_certificate = true }
  }
```

URL-rewrite Function: prepend the www → apex redirect. **Fixed vs the original
plan** — `request.querystring` is an object in CloudFront Functions and must be
serialized:

```javascript
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;

  // ${redirect_from_host} → apex 301 (only compiled into the PROD instance)
  if (host === '${redirect_from_host}') {
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
      headers: { location: { value: 'https://${apex}' + request.uri + (qs.length ? '?' + qs.join('&') : '') } }
    };
  }

  // ... existing extensionless rewrite unchanged
}
```

(`redirect_from_host`/`apex` interpolated from variables; empty
`redirect_from_host` compiles the block out — DEV keeps today's function.)

## 3. Terraform — prod env wiring

**File: `terraform/envs/prod/main.tf`**:

```hcl
# DEV: the existing instance — NO changes (no state moves, no renames).
module "site" { ... }  # exactly as today

# PROD: new bucket + distribution with the custom domain.
module "site_prod" {
  source = "../../modules/site"

  name_prefix            = "iblearn-site-prod"
  feedback_origin_domain = module.feedback_api.function_url_domain  # shared Lambda
  domain_names           = ["octavlearning.com", "www.octavlearning.com"]
  acm_certificate_arn    = aws_acm_certificate.site.arn
  redirect_from_host     = "www.octavlearning.com"
}

output "site_prod_distribution_domain" { value = module.site_prod.distribution_domain_name }
output "site_prod_distribution_id"     { value = module.site_prod.distribution_id }
output "site_prod_bucket"              { value = module.site_prod.bucket_name }
```

CORS — keep ALL three origins (the original plan dropped the dev origin, which
would break "Mark with AI" on the dev URL):

```hcl
module "feedback_api" {
  ...
  cors_allow_origins = [
    "https://d2c1g77zfmjpm3.cloudfront.net",  # DEV
    "https://octavlearning.com",              # PROD apex
    "https://www.octavlearning.com",          # pre-redirect direct hits
  ]
}
```

(`var.site_origin` can go away or become a list; keep the dependency-cycle
comment.)

## 4. CI — branch-gated deploys

**File: `.github/workflows/ci.yml`**:

- Current `deploy` job → `deploy-dev`: `if` stays develop-only; unchanged
  otherwise (dev bucket/distribution/smoke `SITE_URL` as today).
- New `deploy-prod` job: same gates in `needs`, `if: github.ref == 'refs/heads/main'`;
  same steps but targeting the PROD bucket/distribution (from
  `terraform output -raw site_prod_*`) and `SITE_URL: https://octavlearning.com`.
  Extract the shared deploy steps into a composite action or accept the
  duplication — decide at implementation; the job is ~15 steps.
- Manual dispatch: `deploy_only` with the branch picked at dispatch time —
  each deploy job's `if` checks its own branch, so dispatching on develop
  runs deploy-dev and on main runs deploy-prod. No separate env picker
  (user decision 2026-08-11: branch choice + job re-runs are enough).
- One terraform apply manages both environments (single state) — the apply step
  is identical in both jobs; only the sync/invalidation/smoke targets differ.

## 5. CloudFlare DNS (manual, two rounds)

**Round 1 — validation** (after step 1 of the execution sequence): the 2 CNAMEs
from `terraform output acm_validation_records`. CloudFlare dashboard →
octavlearning.com → **DNS → Records → Add record**: Type CNAME, Name = the
`_xxxx` prefix (CloudFlare appends the domain), Target = the
`….acm-validations.aws` value, **Proxy: DNS only (gray cloud)**, TTL Auto.

**Round 2 — routing** (after PROD distribution exists):

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `<site_prod_distribution_domain>` (e.g. `d1234abcd.cloudfront.net`) | DNS only (gray) |
| CNAME | `www` | same | DNS only (gray) |

⚠️ All four records gray-cloud; orange-cloud proxying breaks the CloudFront
TLS chain. Apex CNAME flattening is automatic at CloudFlare. Keep the
validation CNAMEs forever — ACM auto-renewal re-checks them.

## 6. Execution sequence

1. Create `main` from a green `develop` (branch protection on `main` =
   recommended follow-up, from the standing list).
2. PR: §1 (cert only). Apply → validation records output. **No distribution
   changes in this apply** (avoids the original plan's first-apply hazard:
   CloudFront rejects a PENDING_VALIDATION cert).
3. CloudFlare round 1 → wait for cert status ISSUED (~5–10 min).
4. PR: §2 + §3 (prod site instance, CORS). Apply → note
   `site_prod_distribution_domain`.
5. CloudFlare round 2. DNS propagates in seconds–minutes at CloudFlare;
   CloudFront alias attach takes ~10–15 min edge propagation.
6. PR: §4 (CI split) → merge to develop (dev deploy verifies unchanged), then
   PR develop → main → first PROD auto-deploy.
7. Verify (§7) + docs follow-ups (§8).

Steps 2–4 can be one PR merged in two applies (comment-out or
`domain_names = []` first) — but two PRs is cleaner to review.

## 7. Verification

- `curl -sI https://octavlearning.com/` → 200, cert issued to octavlearning.com.
- `curl -sI https://www.octavlearning.com/` → 301 → apex (with query preserved).
- `curl -s https://octavlearning.com/api/feedback` → `{ "configured": true }`.
- Dev unchanged: `curl -sI https://d2c1g77zfmjpm3.cloudfront.net/` → 200; its
  `/api/feedback` still works (CORS regression check).
- Deep link 200 on apex; `sw.js` no-cache header; manifest 200.
- PWA: install from apex on one device (fresh origin — expected).
- `npm run test:e2e:static` stays the pre-merge gate; CI smoke runs per env.

## 8. Follow-ups after cutover

- `AGENTS.md`: live-URL note → octavlearning.com (+ dev URL documented).
- `docs/aws-deployment-plan.md` §7/§9: mark done, point here.
- `docs/PROGRESS.md`: session entry per workflow.
- Branch protection on `main` (require gates + PR).
- PWA per-origin caveat stands: progress/installs on the cloudfront URL do not
  migrate — that URL is now internal-only, so impact is nil.

## 9. What NOT to change

- `iblearn-*` AWS resource names, terraform `Project` tags, `iblearn_progress`
  storage key, `CACHE_VERSION` in sw.js — all intentionally stable.
- The Lambda Function URL itself — both distributions proxy to it.
- `module.site` (DEV) — no renames, no state moves; it is touched by zero diffs.
