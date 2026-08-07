#!/usr/bin/env bash
# Static-export build for S3 + CloudFront (aws-deployment-plan.md §3).
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

BUILD_EXPORT=1 next build
