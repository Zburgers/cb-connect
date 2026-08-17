#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --dry-run --deployment TARGET --restore-target TARGET --frontend-manifest MANIFEST --backend-compatibility VERSION [--action ACTION] --output EVIDENCE" >&2
  exit 2
}

dry_run=false
deployment=''
restore_target=''
frontend_manifest=''
backend_compatibility=''
action='compatible-rollback-and-restore'
output_path=''

while (($# > 0)); do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --deployment|--restore-target|--frontend-manifest|--backend-compatibility|--action|--output)
      [[ $# -ge 2 ]] || usage
      case "$1" in
        --deployment) deployment="$2" ;;
        --restore-target) restore_target="$2" ;;
        --frontend-manifest) frontend_manifest="$2" ;;
        --backend-compatibility) backend_compatibility="$2" ;;
        --action) action="$2" ;;
        --output) output_path="$2" ;;
      esac
      shift 2
      ;;
    *)
      echo "unknown rehearsal argument" >&2
      exit 2
      ;;
  esac
done

if [[ "$dry_run" != true ]]; then
  echo "rollback rehearsal requires --dry-run" >&2
  exit 1
fi
if [[ "$action" != compatible-rollback-and-restore ]]; then
  echo "rollback rehearsal action is not approved" >&2
  exit 1
fi
if [[ -z "$deployment" || -z "$restore_target" || -z "$frontend_manifest" || -z "$backend_compatibility" || -z "$output_path" ]]; then
  echo "rollback rehearsal requires explicit targets, compatibility and evidence path" >&2
  exit 1
fi
if [[ "$deployment" == prod:* || "$restore_target" == prod:* ]]; then
  echo "rollback rehearsal rejects production selectors" >&2
  exit 1
fi
if [[ "$deployment" != dev:hallowed-hummingbird-284 || "$restore_target" != dev:hallowed-hummingbird-284 ]]; then
  echo "rollback rehearsal target is not an approved isolated development deployment" >&2
  exit 1
fi
if [[ ! "$backend_compatibility" =~ ^v[0-9]+$ ]]; then
  echo "rollback rehearsal compatibility version is invalid" >&2
  exit 1
fi

started_epoch="$(date +%s)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
bash scripts/package-release.sh --verify "$frontend_manifest" >/dev/null

if ! node - "$frontend_manifest" "$backend_compatibility" >/dev/null 2>&1 <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const backendCompatibility = process.argv[3];
if (typeof manifest.commitSha !== 'string' || typeof manifest.buildId !== 'string' || typeof manifest.sha256 !== 'string') throw new Error('release identity is incomplete');
if (manifest.compatibilityVersion !== backendCompatibility) throw new Error('frontend/backend compatibility pair is not recorded');
NODE
then
  echo "rollback rehearsal compatibility pair is not recorded" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"
umask 077
ended_epoch="$(date +%s)"
ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
elapsed_seconds=$((ended_epoch - started_epoch))
MANIFEST_PATH="$frontend_manifest" \
OUTPUT_PATH="$output_path" \
DEPLOYMENT="$deployment" \
RESTORE_TARGET="$restore_target" \
BACKEND_COMPATIBILITY="$backend_compatibility" \
STARTED_AT="$started_at" \
ENDED_AT="$ended_at" \
ELAPSED_SECONDS="$elapsed_seconds" \
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST_PATH, 'utf8'));
const evidence = {
  evidenceVersion: 1,
  mode: 'dry-run',
  deploymentClass: 'isolated-development',
  deployment: process.env.DEPLOYMENT,
  restoreTarget: process.env.RESTORE_TARGET,
  frontendArtifact: manifest.artifact,
  frontendCommitSha: manifest.commitSha,
  frontendBuildId: manifest.buildId,
  frontendArtifactSha256: manifest.sha256,
  compatibilityVersion: manifest.compatibilityVersion,
  backendCompatibilityVersion: process.env.BACKEND_COMPATIBILITY,
  startedAt: process.env.STARTED_AT,
  endedAt: process.env.ENDED_AT,
  elapsedSeconds: Number(process.env.ELAPSED_SECONDS),
  rpoHours: 24,
  rtoHours: 4,
  restoreStatus: 'not-executed-dry-run',
  integrityStatus: 'synthetic-only-planned',
  integrityChecks: {
    expectedSyntheticUsers: 'planned',
    schemaReadableRecords: 'planned',
    authorizationBoundaries: 'planned',
    absenceOfUnexpectedCrossCoupleData: 'planned',
  },
  mutationPerformed: false,
  productionAccessed: false,
  nextSafeAction: 'Run the same recorded pair against the approved isolated dev fixture only after operator confirms target availability.',
};
fs.mkdirSync(path.dirname(process.env.OUTPUT_PATH), { recursive: true });
fs.writeFileSync(process.env.OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
NODE

echo "rollback and restore rehearsal evidence recorded: $output_path"
