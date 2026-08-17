#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
fixture="$root/fixture"
output="$root/package"
evidence="$root/rehearsal.json"
mkdir -p "$fixture/.next/standalone" "$fixture/.next/static"
printf '%s\n' 'standalone server' > "$fixture/.next/standalone/server.js"
printf '%s\n' 'static asset' > "$fixture/.next/static/app.js"
(
  cd "$fixture"
  CB_CONNECT_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
  CB_CONNECT_BUILD_ID=rehearsal-fixture \
  CB_CONNECT_COMPATIBILITY_VERSION=v1 \
  CB_CONNECT_BUILT_AT=2026-08-06T00:00:00Z \
  bash "$OLDPWD/scripts/package-release.sh" "$output"
)
manifest="$output/release-manifest.json"

run_expect_fail() {
  if "$@" >"$root/failure.log" 2>&1; then
    echo "expected rehearsal failure did not occur: $*" >&2
    exit 1
  fi
}

bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:hallowed-hummingbird-284 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest "$manifest" \
  --backend-compatibility v1 \
  --output "$evidence"

node - "$evidence" "$manifest" <<'NODE'
const fs = require('node:fs');
const evidence = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const manifest = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
if (evidence.mode !== 'dry-run' || evidence.deploymentClass !== 'isolated-development') throw new Error('dry-run classification missing');
if (evidence.deployment !== 'dev:hallowed-hummingbird-284' || evidence.restoreTarget !== evidence.deployment) throw new Error('target mismatch');
if (evidence.frontendCommitSha !== manifest.commitSha || evidence.compatibilityVersion !== 'v1' || evidence.backendCompatibilityVersion !== 'v1') throw new Error('compatibility pair missing');
if (evidence.rpoHours !== 24 || evidence.rtoHours !== 4) throw new Error('D-007 objectives missing');
if (evidence.restoreStatus !== 'not-executed-dry-run' || evidence.integrityStatus !== 'synthetic-only-planned') throw new Error('dry-run status missing');
if (typeof evidence.startedAt !== 'string' || typeof evidence.endedAt !== 'string') throw new Error('timestamps missing');
NODE

run_expect_fail bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment prod:festive-malamute-715 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest "$manifest" \
  --backend-compatibility v1 \
  --output "$root/production.json"

run_expect_fail bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:unknown-target \
  --restore-target dev:unknown-target \
  --frontend-manifest "$manifest" \
  --backend-compatibility v1 \
  --output "$root/unresolved.json"

run_expect_fail bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:hallowed-hummingbird-284 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest "$manifest" \
  --backend-compatibility v2 \
  --output "$root/mismatch.json"

run_expect_fail bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:hallowed-hummingbird-284 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest "$manifest" \
  --backend-compatibility v1 \
  --action 'git reset --hard HEAD' \
  --output "$root/destructive.json"

if rg -n 'git[[:space:]]+(reset|checkout)|rm[[:space:]]+-rf' scripts/rehearse-rollback.sh; then
  echo "rehearsal script must not contain destructive workspace operations" >&2
  exit 1
fi

echo "rollback and restore rehearsal policy: PASS"
