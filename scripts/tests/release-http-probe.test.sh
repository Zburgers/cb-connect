#!/usr/bin/env bash
set -euo pipefail

source scripts/release-http-probe.sh

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$temp_dir/bin"
cat > "$temp_dir/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
out=''
url=''
while (($#)); do
  case "$1" in
    --output) out="$2"; shift 2 ;;
    --write-out|--max-time) shift 2 ;;
    --silent|--show-error) shift ;;
    *) url="$1"; shift ;;
  esac
done
if [[ "$url" != "https://secret-host.invalid/api/health" && "$url" != "https://secret-host.invalid/api/ready" ]]; then
  echo 'wrong URL' >&2
  exit 2
fi
stage="${url##*/}"
counter="$MOCK_STATE_DIR/$stage"
hits=0
if [[ -f "$counter" ]]; then hits="$(cat "$counter")"; fi
hits=$((hits + 1))
printf '%s' "$hits" > "$counter"
case "${MOCK_MODE:-recover}" in
  recover)
    if ((hits < 3)); then printf '%s' '503' ; exit 0; fi
    printf '{"status":"ok"}\n' > "$out"
    printf '%s' '200'
    ;;
  tls-failure)
    printf '%s' '000'; exit 60
    ;;
  forbidden)
    printf '%s' '403'; exit 0
    ;;
esac
MOCK
cat > "$temp_dir/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$temp_dir/bin/curl" "$temp_dir/bin/sleep"
export PATH="$temp_dir/bin:$PATH"
export MOCK_STATE_DIR="$temp_dir"
export RELEASE_VERIFY_PROBE_ATTEMPTS=3 RELEASE_VERIFY_PROBE_DELAY_SECONDS=0
probe_release_http health https://secret-host.invalid /api/health "$temp_dir/health.json" 5
[[ "$(cat "$temp_dir/health")" == '3' ]]
probe_release_http readiness https://secret-host.invalid /api/ready "$temp_dir/ready.json" 5
[[ "$(cat "$temp_dir/ready")" == '3' ]]

export MOCK_MODE=tls-failure
if probe_release_http health https://secret-host.invalid /api/health "$temp_dir/health.json" 5 > "$temp_dir/stdout" 2> "$temp_dir/stderr"; then
  echo 'TLS failure was accepted' >&2; exit 1
fi
grep -q 'curl_exit=60' "$temp_dir/stderr"
! grep -q 'secret-host' "$temp_dir/stderr"
export MOCK_MODE=forbidden
if probe_release_http readiness https://secret-host.invalid /api/ready "$temp_dir/ready.json" 5 > "$temp_dir/stdout" 2> "$temp_dir/stderr"; then
  echo 'HTTP 403 was accepted' >&2; exit 1
fi
grep -q 'http_status=403' "$temp_dir/stderr"

RELEASE_VERIFY_PROBE_ATTEMPTS=200 bash -c 'source scripts/release-http-probe.sh; probe_release_http health https://secret-host.invalid /api/health /dev/null 5' 2> "$temp_dir/stderr" && { echo 'unbounded attempts were accepted' >&2; exit 1; }
grep -q 'retry policy is invalid' "$temp_dir/stderr"
echo 'release HTTP bounded startup probe: PASS'
