#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
safe_exec="${2:-scripts/convex-safe-exec}"
if [[ "$mode" != production || ! -x "$safe_exec" ]]; then
  echo 'usage: scripts/reconcile-convex-env.sh production [convex-safe-exec]' >&2
  exit 64
fi

env_file="$(mktemp)"
trap 'rm -f "$env_file"' EXIT
umask 077
node - "$env_file" <<'NODE'
const fs = require('node:fs');
const names = [
  'CLERK_FRONTEND_API_URL',
  'CLERK_WEBHOOK_SECRET',
  'DISCORD_WEBHOOK_URL',
  'CB_CONNECT_BACKEND_DEPLOYMENT',
  'CB_CONNECT_BACKEND_COMPATIBILITY_VERSION',
  'CB_CONNECT_BACKEND_DEPLOYED_AT',
  'CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT',
  'CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT',
  'CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY',
];
const content = names
  .filter((name) => process.env[name])
  .map((name) => `${name}=${process.env[name]}`)
  .join('\n');
if (!content) throw new Error('No managed Convex runtime configuration was provided');
fs.writeFileSync(process.argv[2], `${content}\n`, { mode: 0o600 });
NODE

"$safe_exec" production -- env set --from-file "$env_file" --force
for name in CLERK_WEBHOOK_SECRET DISCORD_WEBHOOK_URL; do
  if [[ -z "${!name:-}" ]]; then
    echo "Removing disabled managed Convex key: $name"
    "$safe_exec" production -- env remove "$name"
  fi
done
