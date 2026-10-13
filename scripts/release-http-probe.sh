#!/usr/bin/env bash
# A bounded, TLS-verifying HTTP 200 probe for an immutable CB Connect release.
# Never emit the configured production URL, credentials, response body, or curl stderr.
probe_release_http() {
  local phase="$1" base_url="$2" endpoint="$3" output_file="$4" timeout_seconds="$5"
  local attempts="${RELEASE_VERIFY_PROBE_ATTEMPTS:-12}"
  local delay="${RELEASE_VERIFY_PROBE_DELAY_SECONDS:-2}"
  if [[ ! "$attempts" =~ ^([1-9]|1[0-9]|20)$ ]] ||
     [[ ! "$delay" =~ ^[0-5]$ ]]; then
    echo 'release HTTP probe retry policy is invalid' >&2
    return 1
  fi

  local attempt http_status last_status='000' curl_exit=0
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    http_status='000'
    curl_exit=0
    if http_status="$(
      curl --silent --show-error --max-time "$timeout_seconds" \
        --output "$output_file" --write-out '%{http_code}' \
        "$base_url$endpoint" 2>/dev/null
    )"; then
      :
    else
      curl_exit=$?
    fi
    if [[ "$http_status" =~ ^[0-9]{3}$ ]]; then
      last_status="$http_status"
    else
      last_status='000'
    fi
    if (( curl_exit == 0 )) && [[ "$last_status" == '200' ]]; then
      return 0
    fi
    if (( attempt < attempts )); then
      sleep "$delay"
    fi
  done
  printf 'release %s HTTP probe failed after %s attempts (http_status=%s; curl_exit=%s)\n' \
    "$phase" "$attempts" "$last_status" "$curl_exit" >&2
  return 1
}
