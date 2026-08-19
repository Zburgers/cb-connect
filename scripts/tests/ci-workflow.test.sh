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
  '^  release-artifact:'
  'needs: \[qualify, authenticated-smoke\]'
  "if: github\.event_name == 'push' && github\.ref == 'refs/heads/main'"
  'name: Production-configured immutable release'
  'name: Validate production public build configuration'
  'name: Build the production-configured release artifact'
  'name: Smoke packaged standalone runtime'
  'run: bash scripts/tests/standalone-runtime.test.sh'
  'name: Upload immutable standalone release'
  'name: cb-connect-release-\$\{\{ github\.sha \}\}'
)
for pattern in "${required_patterns[@]}"; do
  if ! rg -q "$pattern" "$workflow"; then
    echo "CI workflow is missing required policy: $pattern" >&2
    exit 1
  fi
done

qualify_block="$(sed -n '/^  qualify:/,/^  authenticated-smoke:/p' "$workflow")"
release_block="$(sed -n '/^  release-artifact:/,$p' "$workflow")"

for value in NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CONVEX_SITE_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; do
  if ! rg -q "${value}: (https://qualification|pk_test_qualification)" <<<"$qualify_block"; then
    echo "secret-free qualification build must supply inert ${value}" >&2
    exit 1
  fi
  if ! rg -Fq "${value}: "'${{ secrets.' <<<"$release_block"; then
    echo "trusted release artifact build must use production ${value}" >&2
    exit 1
  fi
done

if rg -q 'secrets\.|environment: production|package-release\.sh|upload-artifact' <<<"$qualify_block"; then
  echo "generic qualification must not receive production configuration or publish a release artifact" >&2
  exit 1
fi

if rg -q 'CLERK_SECRET_KEY|CONVEX_DEPLOY_KEY' <<<"$release_block"; then
  echo "release artifact job must receive public build configuration only" >&2
  exit 1
fi

if ! rg -q '^    environment: production$' <<<"$release_block"; then
  echo "release artifact job must use the protected production environment" >&2
  exit 1
fi

if ! rg -q '^      - name: Install release policy tools$' <<<"$release_block" ||
   ! rg -q '^        run: sudo apt-get update && sudo apt-get install --yes ripgrep$' <<<"$release_block"; then
  echo "release artifact job must install the tools used by its packaging policy tests" >&2
  exit 1
fi

if grep -Eq '(^|[[:space:]])rg([[:space:]]|$)' scripts/tests/package-release.test.sh; then
  echo "release packaging policy test must not depend on runner-specific ripgrep" >&2
  exit 1
fi

line_for() {
  rg -n -m 1 "$1" <<<"$qualify_block" | cut -d: -f1
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

if rg -q 'github\.run_started_at|CB_CONNECT_RELEASE_AUTH_DIR:[[:space:]]*\$\{\{ runner\.temp \}\}' .github/workflows/ci.yml .github/workflows/deploy.yml; then
  echo "workflow uses a GitHub context that is invalid at workflow/job evaluation time" >&2
  exit 1
fi

for pattern in \
  'Record qualification build timestamp' \
  'Record release build timestamp' \
  'Configure isolated auth artifact directory'; do
  if ! rg -q "$pattern" "$workflow"; then
    echo "CI workflow is missing runtime environment setup: $pattern" >&2
    exit 1
  fi
done

echo "CI qualification and trusted-artifact workflow policy: PASS"
