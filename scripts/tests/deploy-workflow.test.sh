#!/usr/bin/env bash

set -euo pipefail

workflow=".github/workflows/deploy.yml"

if [[ ! -f "$workflow" ]]; then
  echo "missing deploy workflow: $workflow" >&2
  exit 1
fi

required_patterns=(
  'workflow_run:'
  'workflows: \[CI\]'
  'types: \[completed\]'
  'branches: \[main\]'
  "github\.event\.workflow_run\.conclusion == 'success'"
  "github\.event\.workflow_run\.event == 'push'"
  "github\.event\.workflow_run\.head_branch == 'main'"
  'group: cb-connect-production'
  'cancel-in-progress: false'
  'actions/download-artifact@v4'
  'name: cb-connect-release-\$\{\{ github\.event\.workflow_run\.head_sha \}\}'
  'run-id: \$\{\{ github\.event\.workflow_run\.id \}\}'
  'github-token: \$\{\{ github\.token \}\}'
  'QUALIFIED_RUN_ATTEMPT: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}'
  'qualified artifact commit SHA does not match its CI run'
  'qualified artifact build ID does not match its CI run'
  'qualified artifact compatibility version is not approved'
  'git fetch origin main --depth=1'
  'test "\$QUALIFIED_SHA" = "\$\(git rev-parse origin/main\)"'
  'CB_CONNECT_RELEASE_ROOT'
  'CB_CONNECT_RELEASE_ROOT is not a durable safe path'
  'mkdir -p "\$CB_CONNECT_RELEASE_ROOT"'
  'Materialize durable immutable release'
  'release_dir="\$releases_dir/\$release_id"'
  'tar --no-same-owner -xzf'
  'CB_CONNECT_DURABLE_MANIFEST'
  'Resolve verified rollback candidate'
  'first_release=true'
  'previous_manifest="\$\(dirname "\$previous_dir"\)/release-manifest.json"'
  'Record verified release as rollback candidate'
  'Restore prior verified release after failed promotion'
  'id: promote'
  'id: verify_promotion'
  "steps\.promote\.outcome == 'failure' \|\| steps\.verify_promotion\.outcome == 'failure'"
  'always\(\)'
  'Validate Convex deploy key preflight'
  'npx convex deploy --typecheck disable --codegen enable'
  'CB_CONNECT_BACKEND_COMPATIBILITY_VERSION'
  'Record backend deployment timestamp'
  'date -u \+%Y-%m-%dT%H:%M:%S\.000Z'
  'npx convex env set --from-file "\$env_file" --force'
)
for pattern in "${required_patterns[@]}"; do
  if ! rg -q "$pattern" "$workflow"; then
    echo "deploy workflow policy is missing: $pattern" >&2
    exit 1
  fi
done

if rg -q '^  push:' "$workflow"; then
  echo "deploy workflow must not promote directly from a push" >&2
  exit 1
fi

if rg -q 'run: npm run build|scripts/package-release\.sh "\$release_dir"|CB_CONNECT_RELEASE_DIR: \$\{\{ runner\.temp \}\}' "$workflow"; then
  echo "deploy workflow must not rebuild, repackage, or promote from runner temp" >&2
  exit 1
fi

if rg -q 'PROMOTE_PRODUCTION|DEPLOY_CONVEX|ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK' "$workflow"; then
  echo "qualified main releases must deploy without manual promotion variables" >&2
  exit 1
fi

if rg -n 'CB_CONNECT_CYCLE_FACTS_V1|NEXT_PUBLIC_CB_CONNECT_CYCLE_FACTS_V1' .github/workflows/ci.yml "$workflow"; then
  echo "cycle facts capability must remain an optional Convex-only setting" >&2
  exit 1
fi

for pattern in \
  'CB_CONNECT_CYCLE_FACTS_V1' \
  'flag-off' \
  'backward-compatible reads' \
  'destructive migration'; do
  if ! rg -qi "$pattern" DEPLOYMENT.md; then
    echo "deployment guide is missing Gate 1 rollout policy: $pattern" >&2
    exit 1
  fi
done

if rg -q 'test "\$CB_CONNECT_RELEASE_ROOT"|\[\[ "\$CB_CONNECT_RELEASE_ROOT" =~' "$workflow"; then
  echo "release-root validation must use the explicit safe-path case contract" >&2
  exit 1
fi

required_block="$(sed -n '/required=(/,/)/p' "$workflow")"
if grep -q 'CONVEX_DEPLOY_KEY' <<<"$required_block"; then
  echo "frontend-only promotion must not require a Convex deploy key" >&2
  exit 1
fi

if ! rg -q 'if \[\[ -s "\$env_file" \]\]; then' "$workflow"; then
  echo "deploy workflow must skip Convex environment sync when the generated file is empty" >&2
  exit 1
fi

if rg -q 'npx convex (env set|function-spec|run).*--deployment' "$workflow"; then
  echo "deploy-key-authenticated Convex commands must let the key select the deployment" >&2
  exit 1
fi

if rg -q 'convex deploy --env-file|Validate explicit Convex release target|convex function-spec|npx convex run queries/system:getBackendIdentity' "$workflow"; then
  echo "verified deploy-key releases must not depend on a duplicate deployment selector" >&2
  exit 1
fi

# A missing managed `current` pointer is the exact first-release case. Existing
# pointers still have to resolve inside the managed release root and verify a
# compatible manifest before deployment continues.
if ! rg -Uq 'if \[\[ ! -L "\$current_link" \]\]; then[\s\S]{0,180}first_release=true' "$workflow"; then
  echo "deploy workflow must classify a missing current pointer as the first managed release" >&2
  exit 1
fi

# `current` deliberately targets the extracted server directory because PM2
# starts from it. The manifest is one parent directory above; this contract
# catches a rollback resolver that accidentally looks beside `server.js`.
contract_tmp="$(mktemp -d "${TMPDIR:-/tmp}/cb-connect-release-contract.XXXXXX")"
trap 'rm -rf "$contract_tmp"' EXIT
contract_root="$contract_tmp/release-root"
contract_release="$contract_root/releases/0123456789abcdef0123456789abcdef01234567-run-1-1"
mkdir -p "$contract_release/extracted"
touch "$contract_release/release-manifest.json"
ln -s "$contract_release/extracted" "$contract_root/current"
previous_dir="$(readlink -f "$contract_root/current")"
case "$previous_dir" in "$contract_root"/releases/*/extracted) ;; *) echo "current pointer contract is invalid" >&2; exit 1 ;; esac
previous_manifest="$(dirname "$previous_dir")/release-manifest.json"
test -f "$previous_manifest"

if rg -q "if: failure\(\) && steps\.rollback_candidate" "$workflow"; then
  echo "rollback must be limited to a failed frontend promotion or verification, not any prior failure" >&2
  exit 1
fi

echo "deploy workflow qualified-artifact, durable-promotion, and rollback policy: PASS"
