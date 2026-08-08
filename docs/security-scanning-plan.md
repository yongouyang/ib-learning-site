# Security Scanning Plan — SAST + SCA

> **Decision:** OSV-Scanner (dependency CVE scanning) + Semgrep (static code analysis). Both are free, OSS, run in seconds, and have low false-positive rates. Tailored CI integration for the IBLearn stack: Next.js 15, TypeScript, React 19, deployed to AWS S3 + CloudFront via GitHub Actions.
>
> **Reviewed 2026-08-08** — corrections applied: valid Semgrep config format (registry packs via `--config`, excludes via `.semgrepignore`), deprecated `semgrep-action` replaced with the OSS CLI, OSV-Scanner v2 syntax + official reusable workflows, Dependabot key fix, `tools/package-lock.json` coverage, Phase 3 targets the merged `ci.yml` (there is no `deploy.yml` anymore).

---

## 1. Tool Overview

| Tool | Type | What it catches | Input | Runtime |
|------|------|----------------|-------|---------|
| [OSV-Scanner](https://github.com/google/osv-scanner) (Google) | SCA — dependency vulnerabilities | Known CVEs in npm lockfiles (transitive tree); 15+ ecosystems | `package-lock.json` + `tools/package-lock.json` (recursive scan) | ~5 s |
| [Semgrep](https://semgrep.dev/) (OSS CLI) | SAST — source code analysis | Security anti-patterns in source: XSS, path traversal, hardcoded secrets, unsafe regex, missing input validation, React-specific issues (`dangerouslySetInnerHTML`, missing `rel="noopener"`) | All `.ts`, `.tsx`, `.js` source (exclusions via `.semgrepignore`) | ~10–30 s |

**Why OSV-Scanner when `npm audit` and GitHub Dependabot alerts already exist?** Overlap is real and intentional: OSV-Scanner queries the broader OSV.dev database (not just the npm advisory feed), has clean CI exit codes, and — most importantly — the nightly cron alerts us within 24h when a *current* lockfile entry gains a newly-disclosed CVE, without waiting for a code push. `npm audit fix` remains the remediation tool.

---

## 2. Configuration Files

### 2.1 `.semgrepignore` (repo root)

Semgrep rule configs (`rules:` files) cannot reference registry rulesets or exclude paths — registry packs are passed as `--config` CLI args, and path exclusion lives in `.semgrepignore` (gitignore syntax). Create:

```
# Build outputs / generated content
.next/
out/
coverage/
playwright-report/
test-results/
illustration-previews/
node_modules/

# Vendored / data content
tools/data/
public/images/
public/icons/

# Terraform is HCL, not JS/TS
terraform/
```

> **Deliberately scanned:** `scripts/` (build/deploy wrappers like `build-lambda-feedback.sh` and `serve-static.ts` run in CI alongside AWS credentials — they deserve scrutiny) and `tools/scripts/` (scrapers).

### 2.2 `package.json` — additional scripts

```jsonc
{
  "scripts": {
    // ... existing scripts ...
    "security:sast": "semgrep scan --config p/typescript --config p/react --config p/security-audit --config p/secrets --error",
    "security:sca": "osv-scanner scan -r .",
    "security": "npm run security:sast && npm run security:sca"
  }
}
```

Notes:
- `p/...` are registry ruleset packs (browse at semgrep.dev/p). `--error` makes Semgrep exit non-zero on findings (default is exit 0).
- `osv-scanner scan -r .` (v2 syntax) recursively finds **both** lockfiles — root and `tools/`.

Install locally (macOS):

```bash
brew install semgrep osv-scanner
semgrep --version && osv-scanner --version
npm run security   # first-run triage happens here, before CI sees findings
```

---

## 3. CI Integration — `.github/workflows/security.yml`

A dedicated workflow that runs **in parallel** with the existing `ci.yml` (does not block the existing `build-and-test` / `e2e` jobs).

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    # Nightly at 03:17 UTC — catches newly-disclosed CVEs without a code
    # push. Off-the-hour to avoid the UTC top-of-hour herd.
    - cron: '17 3 * * *'

permissions:
  contents: read

jobs:
  semgrep:
    name: Semgrep (SAST)
    runs-on: ubuntu-latest
    # Non-blocking on push during initial rollout — remove after triage.
    # (push only; PRs are held to the real result from day one.)
    continue-on-error: ${{ github.event_name == 'push' }}
    steps:
      - uses: actions/checkout@v4

      # semgrep/semgrep-action is DEPRECATED (archived 2024-04) — run the
      # OSS CLI directly. pipx is preinstalled on ubuntu runners.
      - name: Run Semgrep scan
        run: >-
          pipx run semgrep scan
          --config p/typescript --config p/react
          --config p/security-audit --config p/secrets
          --error

  # Official reusable workflow (google/osv-scanner-action). Default scan-args
  # are `--recursive ./` — covers package-lock.json AND tools/package-lock.json.
  # A plain job `uses:` does not support continue-on-error, which is fine:
  # OSV-Scanner should always fail on a finding — a published CVE is never
  # a false positive.
  osv-scanner:
    name: OSV-Scanner (SCA)
    permissions:
      actions: read          # required for SARIF upload
      security-events: write # results land in Security > Code scanning
      contents: read
    uses: google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@v2.3.8
```

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **Separate workflow**, not inline in `ci.yml` | Security scans run in parallel with build/test — no slowdown. Easier to make required/optional independently. (Phase 3 re-evaluates this for the deploy gate.) |
| `continue-on-error` on push during rollout | First runs surface findings without blocking deploys. After triage, remove it so Semgrep gates pushes too. |
| **Nightly cron** | CVEs are disclosed daily; a nightly scan against the current lockfile catches issues without a new code push. |
| **OSV-Scanner always fails** on finding | A CVE with a published advisory is never a false positive. If a patch exists, the remediation is to bump the dependency (`npm audit fix` / manual). If no patch exists, the team is aware. |

---

## 4. Gradual Rollout Plan

### Phase 1 — Audit mode (Week 1)

| Action | Details |
|--------|---------|
| Merge `.semgrepignore` + `security.yml` | Both scans run; Semgrep has `continue-on-error` on push |
| Run `npm run security` locally | Triages findings before CI sees them |
| Fix real issues | Code fixes for Semgrep findings; `npm audit fix` / manual bumps for OSV findings |
| Suppress false positives | `// nosemgrep: <rule-id>` inline comments for legitimate patterns; path exclusions in `.semgrepignore` |
| **Expected effort:** 1–2 hours |

### Phase 2 — PR gating (Week 2)

| Action | Details |
|--------|---------|
| Remove `continue-on-error` for push events | `security.yml` blocks pushes and PRs that introduce security regressions |
| **Expected effort:** 10 minutes (config change) |

### Phase 3 — Pre-deploy gate (merged CI/CD pipeline)

`deploy.yml` no longer exists — CI and deploy were merged into a single pipeline (`.github/workflows/ci.yml`: `build-and-test` → `e2e` matrix → `deploy`, deploy gated to pushes/dispatches on `develop`). Cross-workflow `needs` isn't possible, so the deploy gate means adding the two scan jobs **inside `ci.yml`**:

```yaml
# Inside ci.yml — same steps as security.yml
jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: >-
          pipx run semgrep scan
          --config p/typescript --config p/react
          --config p/security-audit --config p/secrets
          --error

  osv-scanner:
    permissions:
      actions: read
      security-events: write
      contents: read
    uses: google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@v2.3.8

  deploy:
    needs: [build-and-test, e2e, semgrep, osv-scanner]  # blocks deploy on any failure
    # ... quality gates, Terraform, S3 sync, CloudFront invalidation, smoke
```

| Action | Details |
|--------|---------|
| Add `semgrep` + `osv-scanner` jobs to `ci.yml`, extend deploy's `needs` | Both scans must pass before S3 sync |
| Trim `security.yml` triggers (optional) | Once the scans run in `ci.yml` on push to develop, keep `security.yml` for PRs + the nightly cron only, to avoid double-running |
| Make security checks required in branch protection | If/when branch protection is enabled on `develop` |
| **Expected effort:** 15 minutes (config changes) |

---

## 5. Expected Findings for This Project

Based on the current dependency tree (`package.json`) and codebase patterns:

### OSV-Scanner

| Finding | Likelihood | Notes |
|---------|-----------|-------|
| CVEs in production deps | Low today | `next@^15.5.20`, `react@^19.2.7`, `framer-motion@^12.40.0` are all recent. |
| CVEs in dev deps | Low | `@playwright/test`, `vitest`, `eslint` — recent versions, low attack surface since they don't ship to production. |
| **Long-term value** | — | Catches CVEs when they drop. The nightly cron means you're alerted within 24h of any lockfile dependency gaining a known vulnerability. |

### Semgrep

| Finding | Likelihood | Notes |
|---------|-----------|-------|
| Missing `rel="noopener noreferrer"` on `target="_blank"` links | Possible | Common in React apps; low severity but worth fixing. |
| `dangerouslySetInnerHTML` usage | Low | Check content rendering components. KaTeX rendering is expected and safe. |
| Hardcoded secrets | Unlikely | `terraform.tfvars` is gitignored; API keys are env-var gated. But the secrets pack catches accidental commits. |
| Client-side `eval` or `Function()` | Unlikely | Not expected in this codebase. |
| Next.js SSRF or middleware issues | Low | Static export site with no server-side data fetching (all content is bundled JSON via `generateStaticParams`). The one server component is the feedback Lambda — small surface. |
| **Estimated first-run findings:** 0–15 | — | Mostly informational or low-severity. |

**Risk context:** this is a static export plus one small Lambda, so the runtime attack surface is small. The primary payoff is dependency CVE monitoring (nightly cron); SAST is cheap insurance on top.

---

## 6. Optional Additions

### 6.1 Dependabot (zero-cost, GitHub-native)

Complements OSV-Scanner by proactively opening PRs when dependency updates are available:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    # Group minor/patch updates together to reduce noise
    groups:
      dev-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      prod-dependencies:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
```

### 6.2 Semgrep App (free dashboard)

Create a free account at [semgrep.dev](https://semgrep.dev) to get:

- A dashboard of findings across branches
- PR comments inline (not just CI logs)
- Historical trend tracking

With an account, the CI step becomes `semgrep ci` with a `SEMGREP_APP_TOKEN` secret instead of `semgrep scan`.

### 6.3 Trivy for IaC scanning (future)

Since this project uses Terraform, [Trivy](https://github.com/aquasecurity/trivy) can scan for misconfigurations:

```bash
trivy config terraform/
```

Not needed now — the Terraform modules are simple (S3 bucket with OAC, CloudFront, Lambda) — but worth considering if the IaC grows.

---

## 7. Files Checklist

| File | Action | Purpose |
|------|--------|---------|
| `.semgrepignore` | **Create** | Semgrep path exclusions (build outputs, vendored data) |
| `.github/workflows/security.yml` | **Create** | CI workflow for SAST + SCA scanning (push/PR + nightly cron) |
| `.github/dependabot.yml` | **Create** (optional) | Auto-dependency bump PRs |
| `package.json` | **Amend** — add `security:*` scripts | Local scanning commands |
| `.github/workflows/ci.yml` | **Amend** (Phase 3) | Add `semgrep` + `osv-scanner` jobs; extend deploy's `needs` |

---

## 8. Commands Reference

```bash
# Local development
npm run security:sast                        # Semgrep code scan (registry packs)
npm run security:sca                         # OSV-Scanner, both lockfiles recursively
npm run security                             # Both, sequentially

# Direct CLI (what CI runs)
semgrep scan --config p/typescript --error   # add more --config packs as needed
osv-scanner scan -r .                        # v2 recursive lockfile scan
osv-scanner scan -L package-lock.json        # single lockfile

# False-positive suppression (in source)
// nosemgrep: javascript.lang.security.detect-eval-with-expression
```

---

## 9. Rollout Summary

| Phase | Week | What changes | Blocking? |
|-------|------|-------------|-----------|
| **1. Audit** | 1 | `.semgrepignore` + `security.yml` merged; Semgrep `continue-on-error` on push | No |
| **2. PR gate** | 2 | Remove `continue-on-error`; findings block PRs and pushes | Yes (PRs + pushes) |
| **3. Deploy gate** | After 2 | `semgrep` + `osv-scanner` jobs in `ci.yml`; deploy `needs` them | Yes (deploys) |
| **Ongoing** | — | Nightly cron catches new CVEs; Dependabot auto-bumps | N/A |

**Total hands-on effort: ~1.5 hours** (including first-run triage). After Phase 3, both tools are fully hands-off.
