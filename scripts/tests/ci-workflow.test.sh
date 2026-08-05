#!/usr/bin/env bash
set -euo pipefail

workflow=".github/workflows/ci.yml"

if [[ ! -f "$workflow" ]]; then
  echo "missing CI qualification workflow: $workflow" >&2
  exit 1
fi

required_patterns=(
  'node-version: 20\.19\.1'
  'test "\$\(node --version\)" = "v20\.19\.1"'
  'test "\$\(npm --version\)" = "10\.8\.2"'
  'run: npm ci --no-audit --no-fund'
  'run: npm run build'
  'run: npm run typecheck'
  'run: npm run test:unit -- --run'
  'run: npm audit --omit=dev'
)

for pattern in "${required_patterns[@]}"; do
  if ! rg -q "$pattern" "$workflow"; then
    echo "CI workflow is missing required policy: $pattern" >&2
    exit 1
  fi
done

line_for() {
  rg -n -m 1 "$1" "$workflow" | cut -d: -f1
}

install_line="$(line_for 'run: npm ci --no-audit --no-fund')"
build_line="$(line_for 'run: npm run build')"
typecheck_line="$(line_for 'run: npm run typecheck')"
unit_line="$(line_for 'run: npm run test:unit -- --run')"
audit_line="$(line_for 'run: npm audit --omit=dev')"

if ! (( install_line < build_line && build_line < typecheck_line &&
  typecheck_line < unit_line && unit_line < audit_line )); then
  echo "CI qualification checks are out of order" >&2
  exit 1
fi

if rg -n 'continue-on-error:[[:space:]]*true' "$workflow"; then
  echo "CI qualification must fail closed; continue-on-error is not allowed" >&2
  exit 1
fi

echo "CI qualification workflow policy: PASS"
