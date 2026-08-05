#!/usr/bin/env bash

set -euo pipefail

workflow=".github/workflows/deploy.yml"

convex_opt_in_count="$(rg -c "if: vars\.DEPLOY_CONVEX == 'true'" "$workflow" || true)"
if [[ "$convex_opt_in_count" -lt 2 ]]; then
  echo "Convex environment sync and deployment must require explicit DEPLOY_CONVEX opt-in" >&2
  exit 1
fi

required_block="$(sed -n '/required=(/,/)/p' "$workflow")"
if grep -q 'CONVEX_DEPLOY_KEY' <<<"$required_block"; then
  echo "frontend recovery deployment must not require a Convex deploy key" >&2
  exit 1
fi

if ! rg -q 'if \[\[ -s "\$env_file" \]\]; then' "$workflow"; then
  echo "deploy workflow must skip Convex environment sync when the generated file is empty" >&2
  exit 1
fi

if ! rg -q 'Skipping Convex runtime secret sync; no optional values are configured\.' "$workflow"; then
  echo "deploy workflow must report the non-secret skip reason" >&2
  exit 1
fi

required_v1_patterns=(
  'Validate explicit Convex release target'
  'CB_CONNECT_PRODUCTION_DEPLOYMENT'
  'prod:festive-malamute-715'
  'npx convex deploy --env-file "$convex_release_env_file"'
  'npx convex function-spec --deployment "$CONVEX_DEPLOYMENT"'
  'npx convex run queries/system:getBackendIdentity '\''{}'\'' --deployment "$CONVEX_DEPLOYMENT"'
  'CB_CONNECT_BACKEND_COMPATIBILITY_VERSION'
  'CB_CONNECT_COMMIT_SHA'
)
for pattern in "${required_v1_patterns[@]}"; do
  if ! rg -Fq "$pattern" "$workflow"; then
    echo "V1 explicit Convex release policy is missing: $pattern" >&2
    exit 1
  fi
done

echo "deploy workflow V1 and optional-runtime-secret policy: PASS"
