#!/usr/bin/env bash
# Static-export build for S3 + CloudFront (docs/aws-deployment-plan.md §3).
# `output: 'export'` rejects the non-static /api/feedback route handler, so
# src/app/api is stashed aside for the duration of the build and restored
# afterwards (even on failure, via the trap). The Next route stays the
# dev/e2e path; production feedback is the Lambda behind CloudFront.
set -euo pipefail

cd "$(dirname "$0")/.."

API_DIR="src/app/api"
STASH=".build-static-stash"

if [ -d "$API_DIR" ]; then
  rm -rf "$STASH"
  mkdir -p "$STASH"
  mv "$API_DIR" "$STASH/api"
fi

restore() {
  if [ -d "$STASH/api" ]; then
    mv "$STASH/api" "$API_DIR"
  fi
  rm -rf "$STASH"
}
trap restore EXIT

# Build identity — the answer to "am I looking at the latest deploy?".
#
#   * inlined into the bundle as NEXT_PUBLIC_BUILD_ID, so whatever the browser is
#     RUNNING carries its own id (no request, no cache semantics to get wrong);
#   * written to out/version.json, so a client (UpdateToast) — or you, with
#     `curl -s https://…/version.json` — can ask what is DEPLOYED right now.
#
# The two differing IS the definition of a stale tab/PWA, which is otherwise
# invisible: the service worker serves the cached HTML immediately and only
# revalidates behind it, so the first load after a deploy looks identical to the
# last one (see the PWA bullet in AGENTS.md).
BUILD_ID="${BUILD_ID:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
export NEXT_PUBLIC_BUILD_ID="$BUILD_ID"

BUILD_EXPORT=1 next build

printf '{"id":"%s","builtAt":"%s"}\n' "$BUILD_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > out/version.json
