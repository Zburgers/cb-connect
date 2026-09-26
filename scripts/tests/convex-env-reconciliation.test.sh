#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d "${TMPDIR:-/tmp}/cb-connect-env-reconcile.XXXXXX")"
trap 'rm -rf "$root"' EXIT
state="$root/state"
trace="$root/trace"
output="$root/output"
fake_exec="$root/convex-safe-exec"
cat > "$fake_exec" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == production ]]
shift
[[ "$1" == -- ]]
shift
if [[ "$1 $2" == 'env set' ]]; then
  file="${4}"
  touch "$FAKE_STATE"
  while IFS= read -r line; do
    key="${line%%=*}"
    value="${line#*=}"
    if ! grep -q "^${key}=" "$FAKE_STATE"; then
      printf '%s=%s\n' "$key" "$value" >> "$FAKE_STATE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$FAKE_STATE"
    fi
  done < "$file"
  echo set >> "$FAKE_TRACE"
elif [[ "$1 $2" == 'env remove' ]]; then
  key="$3"
  if [[ -f "$FAKE_STATE" ]]; then
    sed -i "/^${key}=/d" "$FAKE_STATE"
  fi
  printf 'remove:%s\n' "$key" >> "$FAKE_TRACE"
else
  exit 64
fi
SH
chmod +x "$fake_exec"

base_env=(
  CLERK_FRONTEND_API_URL=https://clerk.example
  CB_CONNECT_BACKEND_DEPLOYMENT=prod:festive-malamute-715
  CB_CONNECT_BACKEND_COMPATIBILITY_VERSION=v1
  CB_CONNECT_BACKEND_DEPLOYED_AT=2026-09-27T00:00:00.000Z
  CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT=production
  CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT=prod:festive-malamute-715
  CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY=false
)

run_reconcile() {
  env FAKE_STATE="$state" FAKE_TRACE="$trace" "${base_env[@]}" "$@" \
    scripts/reconcile-convex-env.sh production "$fake_exec" >>"$output"
}

run_reconcile CLERK_WEBHOOK_SECRET=clerk-old DISCORD_WEBHOOK_URL=https://discord-old
grep -Fq 'CLERK_WEBHOOK_SECRET=clerk-old' "$state"
grep -Fq 'DISCORD_WEBHOOK_URL=https://discord-old' "$state"

run_reconcile CLERK_WEBHOOK_SECRET=clerk-rotated DISCORD_WEBHOOK_URL=https://discord-rotated
grep -Fq 'CLERK_WEBHOOK_SECRET=clerk-rotated' "$state"
grep -Fq 'DISCORD_WEBHOOK_URL=https://discord-rotated' "$state"

run_reconcile
! grep -q '^CLERK_WEBHOOK_SECRET=' "$state"
! grep -q '^DISCORD_WEBHOOK_URL=' "$state"
grep -Fq 'remove:CLERK_WEBHOOK_SECRET' "$trace"
grep -Fq 'remove:DISCORD_WEBHOOK_URL' "$trace"

run_reconcile CLERK_WEBHOOK_SECRET=clerk-restored DISCORD_WEBHOOK_URL=https://discord-restored
grep -Fq 'CLERK_WEBHOOK_SECRET=clerk-restored' "$state"
grep -Fq 'DISCORD_WEBHOOK_URL=https://discord-restored' "$state"

if rg -q 'clerk-(old|rotated|restored)|discord-(old|rotated|restored)' "$trace" "$output"; then
  echo 'reconciliation output exposed a managed secret value' >&2
  exit 1
fi

echo 'managed Convex environment set, rotate, remove, and restore transitions: PASS'
