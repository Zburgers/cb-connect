#!/usr/bin/env bash

set -euo pipefail

workflow=".github/workflows/deploy.yml"

if ! rg -q 'if \[\[ -s "\$env_file" \]\]; then' "$workflow"; then
  echo "deploy workflow must skip Convex environment sync when the generated file is empty" >&2
  exit 1
fi

if ! rg -q 'Skipping Convex runtime secret sync; no optional values are configured\.' "$workflow"; then
  echo "deploy workflow must report the non-secret skip reason" >&2
  exit 1
fi

echo "deploy workflow optional-runtime-secret handling: PASS"
