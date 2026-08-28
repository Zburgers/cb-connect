#!/usr/bin/env bash
set -euo pipefail

matches="$(rg -n -i 'npx[[:space:]]+convex[[:space:]]+(deploy|env[[:space:]]+set|run)([[:space:]]|$)' \
  .github/workflows scripts docs/runbooks docs/testing docs/cb-connect-technical-prd.md QWEN.md DEPLOYMENT.md package.json \
  --glob '!scripts/convex-safe-exec' --glob '!scripts/tests/**' || true)"
if [[ -n "$matches" ]]; then
  echo 'raw stateful Convex invocation found outside scripts/convex-safe-exec:' >&2
  echo "$matches" >&2
  exit 1
fi

test -x scripts/convex-safe-exec
rg -q 'convex-safe-exec (test|production)' .github/workflows/ci.yml .github/workflows/deploy.yml
echo 'Convex stateful command policy: PASS'
