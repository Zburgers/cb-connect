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

echo "deploy workflow optional-runtime-secret handling: PASS"
