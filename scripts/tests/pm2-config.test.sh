#!/usr/bin/env bash

set -euo pipefail

pm2_config="pm2.config.js"
workflow=".github/workflows/deploy.yml"
promotion_script="scripts/promote-pm2.sh"
package_json="package.json"

if rg -n '(SECRET|DEPLOY_KEY|CONVEX_DEPLOYMENT|NEXT_PUBLIC_[A-Z_]*URL|https?://)' "$pm2_config"; then
  echo "pm2 config must not contain secret, deployment, URL or key identifiers" >&2
  exit 1
fi

if rg -n "(^|[[:space:]])(SECRET|TOKEN|PASSWORD|KEY|URL)[A-Z_]*[[:space:]]*[:=][[:space:]]*[\"'][[:space:]]*[\"']" "$pm2_config"; then
  echo "pm2 config must not contain blank secret placeholders" >&2
  exit 1
fi

if rg -n 'sed[[:space:]]+-i|pm2[[:space:]]+delete' "$workflow"; then
  echo "deploy workflow must not mutate source or delete the healthy process" >&2
  exit 1
fi

if [[ ! -f "$promotion_script" ]]; then
  echo "deploy workflow must use the shared PM2 promotion helper" >&2
  exit 1
fi

if ! rg -q 'scripts/promote-pm2\.sh' "$workflow"; then
  echo "deploy workflow must use the shared PM2 promotion helper" >&2
  exit 1
fi

if ! rg -q 'pm2 startOrReload pm2\.config\.js --update-env' "$promotion_script"; then
  echo "PM2 promotion helper must use non-destructive startOrReload for an already immutable process" >&2
  exit 1
fi

if ! rg -q 'pm2 delete "\$process_name"' "$promotion_script"; then
  echo "PM2 promotion helper must replace a stale process definition" >&2
  exit 1
fi

if ! rg -q 'pm2 start pm2\.config\.js --update-env' "$promotion_script"; then
  echo "PM2 promotion helper must start the configured immutable release" >&2
  exit 1
fi

if ! rg -q 'cwd:[[:space:]]*releaseDir[[:space:]]*\|\|[[:space:]]*process\.cwd\(\)' "$pm2_config"; then
  echo "pm2 config must run from the immutable release directory when supplied" >&2
  exit 1
fi

if ! rg -q "path\.join\(releaseDir,[[:space:]]*['\"]server\.js['\"]\)" "$pm2_config"; then
  echo "pm2 config must promote the packaged standalone server when supplied" >&2
  exit 1
fi

if ! rg -q "args:[[:space:]]*[\"']run start[\"']" "$pm2_config"; then
  echo "pm2 config must use the package start command" >&2
  exit 1
fi

if ! rg -q '"start":[[:space:]]*"next start -p 6050"' "$package_json"; then
  echo "pm2 must retain the approved 6050 listener contract" >&2
  exit 1
fi

echo "pm2 environment-neutral configuration and non-destructive promotion: PASS"
