#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 OUTPUT_DIR | $0 --verify MANIFEST" >&2
  exit 2
}

verify_manifest() {
  local manifest_path="${1:?manifest path is required}"
  if [[ ! -f "$manifest_path" ]]; then
    echo "release manifest is missing: $manifest_path" >&2
    exit 1
  fi
  node - "$manifest_path" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const required = ["artifact", "buildId", "builtAt", "commitSha", "compatibilityVersion", "sha256"];
for (const field of required) {
  if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
    throw new Error(`release manifest field is invalid: ${field}`);
  }
}
if (!/^[0-9a-f]{40,64}$/.test(manifest.commitSha)) throw new Error("release manifest commit SHA is invalid");
if (!/^v[0-9]+$/.test(manifest.compatibilityVersion)) throw new Error("release manifest compatibility version is invalid");
if (!/^[a-zA-Z0-9._-]+$/.test(manifest.artifact)) throw new Error("release manifest artifact name is invalid");
if (!/^[0-9a-f]{64}$/.test(manifest.sha256)) throw new Error("release manifest checksum is invalid");
const artifactPath = path.join(path.dirname(manifestPath), manifest.artifact);
if (!fs.existsSync(artifactPath)) throw new Error(`release artifact is missing: ${manifest.artifact}`);
const checksum = crypto.createHash("sha256").update(fs.readFileSync(artifactPath)).digest("hex");
if (checksum !== manifest.sha256) throw new Error("release artifact checksum mismatch");
console.log(`release artifact verified: ${manifest.artifact}`);
NODE
}

if [[ "${1:-}" == "--verify" ]]; then
  [[ $# -eq 2 ]] || usage
  verify_manifest "$2"
  exit 0
fi
[[ $# -eq 1 ]] || usage
output_dir="$1"

required_env=(CB_CONNECT_COMMIT_SHA CB_CONNECT_BUILD_ID CB_CONNECT_COMPATIBILITY_VERSION CB_CONNECT_BUILT_AT)
for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing release metadata: $name" >&2
    exit 1
  fi
done

commit_sha="$CB_CONNECT_COMMIT_SHA"
build_id="$CB_CONNECT_BUILD_ID"
compatibility_version="$CB_CONNECT_COMPATIBILITY_VERSION"
built_at="$CB_CONNECT_BUILT_AT"
if [[ ! "$commit_sha" =~ ^[0-9a-f]{40,64}$ ]]; then echo "release metadata commit SHA is invalid" >&2; exit 1; fi
if [[ ! "$build_id" =~ ^[a-zA-Z0-9._-]+$ ]]; then echo "release metadata build ID is invalid" >&2; exit 1; fi
if [[ ! "$compatibility_version" =~ ^v[0-9]+$ ]]; then echo "release metadata compatibility version is invalid" >&2; exit 1; fi
if ! node -e 'const value = process.argv[1]; if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) process.exit(1)' "$built_at"; then
  echo "release metadata builtAt is invalid" >&2
  exit 1
fi

standalone_dir="${CB_CONNECT_STANDALONE_DIR:-.next/standalone}"
static_dir="${CB_CONNECT_STATIC_DIR:-.next/static}"
public_dir="${CB_CONNECT_PUBLIC_DIR:-public}"
if [[ ! -d "$standalone_dir" ]]; then echo "standalone output is missing: $standalone_dir" >&2; exit 1; fi
if [[ ! -d "$static_dir" ]]; then echo "static output is missing: $static_dir" >&2; exit 1; fi

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
stage="$(mktemp -d "${TMPDIR:-/tmp}/cb-connect-release.XXXXXX")"
cp -R "$standalone_dir/." "$stage/"
mkdir -p "$stage/.next"
cp -R "$static_dir" "$stage/.next/static"
if [[ -d "$public_dir" ]]; then cp -R "$public_dir" "$stage/public"; fi

artifact_name="cb-connect-${build_id}.tar.gz"
artifact_path="$output_dir/$artifact_name"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -czf "$artifact_path" -C "$stage" .
checksum="$(sha256sum "$artifact_path" | awk '{print $1}')"
manifest_path="$output_dir/release-manifest.json"
MANIFEST_PATH="$manifest_path" ARTIFACT_NAME="$artifact_name" ARTIFACT_SHA256="$checksum" RELEASE_COMMIT_SHA="$commit_sha" RELEASE_BUILD_ID="$build_id" RELEASE_COMPATIBILITY_VERSION="$compatibility_version" RELEASE_BUILT_AT="$built_at" node <<'NODE'
const fs = require("node:fs");
const manifest = {
  artifact: process.env.ARTIFACT_NAME,
  buildId: process.env.RELEASE_BUILD_ID,
  builtAt: process.env.RELEASE_BUILT_AT,
  commitSha: process.env.RELEASE_COMMIT_SHA,
  compatibilityVersion: process.env.RELEASE_COMPATIBILITY_VERSION,
  sha256: process.env.ARTIFACT_SHA256,
};
fs.writeFileSync(process.env.MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
NODE
verify_manifest "$manifest_path"
echo "release artifact packaged: $artifact_name"
