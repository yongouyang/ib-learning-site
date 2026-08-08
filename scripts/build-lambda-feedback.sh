#!/usr/bin/env bash
# Bundle the feedback Lambda into a single zip for Terraform
# (aws-deployment-plan.md §5). CI runs the same script before apply.
set -euo pipefail

cd "$(dirname "$0")/.."

DIST="lambda/feedback/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

node_modules/.bin/esbuild lambda/feedback/index.ts \
  --bundle --platform=node --target=node22 --format=cjs \
  --outfile="$DIST/index.js"

(cd "$DIST" && zip -q -X feedback-lambda.zip index.js)
echo "Built $DIST/feedback-lambda.zip"
