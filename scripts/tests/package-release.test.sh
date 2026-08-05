#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
fixture="$root/fixture"
output="$root/output"
extract="$root/extract"
mkdir -p "$fixture/.next/static"

if (
  cd "$fixture"
  CB_CONNECT_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
  CB_CONNECT_BUILD_ID=build-1 \
  CB_CONNECT_COMPATIBILITY_VERSION=v1 \
  CB_CONNECT_BUILT_AT=2026-08-06T00:00:00Z \
  bash "$OLDPWD/scripts/package-release.sh" "$output"
) >"$root/missing.log" 2>&1; then
  echo "missing standalone output must fail" >&2
  exit 1
fi
if ! rg -q 'standalone' "$root/missing.log"; then
  echo "missing standalone failure is not explicit" >&2
  exit 1
fi

mkdir -p "$fixture/.next/standalone" "$fixture/.next/static/assets"
printf '%s\n' 'standalone server fixture' > "$fixture/.next/standalone/server.js"
printf '%s\n' 'static fixture' > "$fixture/.next/static/assets/app.js"

if (
  cd "$fixture"
  CB_CONNECT_COMMIT_SHA=not-a-sha \
  CB_CONNECT_BUILD_ID=build-1 \
  CB_CONNECT_COMPATIBILITY_VERSION=v1 \
  CB_CONNECT_BUILT_AT=2026-08-06T00:00:00Z \
  bash "$OLDPWD/scripts/package-release.sh" "$output"
) >"$root/metadata.log" 2>&1; then
  echo "invalid metadata must fail" >&2
  exit 1
fi
if ! rg -q 'commit SHA' "$root/metadata.log"; then
  echo "invalid metadata failure is not explicit" >&2
  exit 1
fi

(
  cd "$fixture"
  CB_CONNECT_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
  CB_CONNECT_BUILD_ID=build-1 \
  CB_CONNECT_COMPATIBILITY_VERSION=v1 \
  CB_CONNECT_BUILT_AT=2026-08-06T00:00:00Z \
  bash "$OLDPWD/scripts/package-release.sh" "$output"
)

manifest="$output/release-manifest.json"
archive="$(node -e 'const m=require(process.argv[1]); process.stdout.write(require("node:path").join(require("node:path").dirname(process.argv[1]),m.artifact));' "$manifest")"
test -f "$manifest"
test -f "$archive"
bash scripts/package-release.sh --verify "$manifest"
mkdir -p "$extract"
tar -xzf "$archive" -C "$extract"
test -f "$extract/server.js"
test -f "$extract/.next/static/assets/app.js"

printf '%s\n' tampered >> "$archive"
if bash scripts/package-release.sh --verify "$manifest" >"$root/checksum.log" 2>&1; then
  echo "checksum mismatch must fail" >&2
  exit 1
fi
if ! rg -q 'checksum' "$root/checksum.log"; then
  echo "checksum failure is not explicit" >&2
  exit 1
fi

echo "standalone release package policy: PASS"
