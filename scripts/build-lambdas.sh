#!/usr/bin/env bash
# Bundle every Lambda (feedback + auth + progress + analytics + leaderboard +
# admin + analytics-report) into a zip for Terraform (docs/aws-deployment-plan.md
# §5, docs/architecture-evolution-plan.md §6.4).
# CI runs the same script before apply. Each zip is byte-identical for
# identical source (mtime normalized) so source_code_hash only changes when
# the code does.
set -euo pipefail

cd "$(dirname "$0")/.."

build_one() {
  local name="$1"
  local entry="$2"
  local dist="lambda/$name/dist"
  rm -rf "$dist"
  mkdir -p "$dist"

  node_modules/.bin/esbuild "$entry" \
    --bundle --platform=node --target=node24 --format=cjs \
    --outfile="$dist/index.js"

  # Normalize the file mtime so identical code produces a byte-identical zip —
  # otherwise source_code_hash changes on every CI build and Terraform
  # redeploys the Lambda needlessly.
  touch -t 200001010000 "$dist/index.js"

  (cd "$dist" && zip -q -X "$name-lambda.zip" index.js)
  echo "Built $dist/$name-lambda.zip"
}

build_one "feedback" "lambda/feedback/index.ts"
build_one "auth" "lambda/auth/index.ts"
build_one "progress" "lambda/progress/index.ts"
build_one "analytics" "lambda/analytics/index.ts"
build_one "leaderboard" "lambda/leaderboard/index.ts"
build_one "admin" "lambda/admin/index.ts"
build_one "analytics-report" "lambda/analytics-report/index.ts"
