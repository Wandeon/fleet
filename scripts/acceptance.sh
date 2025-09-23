#!/usr/bin/env bash
set -euo pipefail


usage() {
  cat <<'USAGE'
Usage: scripts/acceptance.sh [options] [<audio-host> ...]

Options:
  --json                 Output JSON summary only (no human-readable logs)
  --api <url>            Base URL for Fleet backend API (e.g. https://host/api)
  --ui <url>             Base URL for Fleet UI (e.g. https://host)
  --icecast <url>        Full Icecast mount URL to probe (HEAD request)
  -h, --help             Show this help message and exit

Environment variables:
  SSH_USER               SSH username for Pi hosts (default: admin)
  AUDIOCTL_TOKEN         Bearer token for audio control API requests
  ACCEPTANCE_API_TOKEN   Bearer token for Fleet API requests (if required)
  UI_EXPECTED_TITLE      Expected marker text in UI HTML (default: Head Spa Control)
  ACCEPTANCE_INSECURE    Set to 1 to disable TLS verification for curl requests
USAGE
}

if ! command -v jq >/dev/null 2>&1; then
  echo "scripts/acceptance.sh requires jq to be installed" >&2
  exit 2
fi

SSH_USER=${SSH_USER:-admin}
TOKEN=${AUDIOCTL_TOKEN:-}
API_TOKEN=${ACCEPTANCE_API_TOKEN:-${FLEET_API_TOKEN:-}}
ICECAST_URL_ENV=${ICECAST_URL:-}
EXPECTED_UI_TITLE=${UI_EXPECTED_TITLE:-Head Spa Control}
INSECURE=${ACCEPTANCE_INSECURE:-0}

json_only=false
api_url=""
ui_url=""
icecast_url="$ICECAST_URL_ENV"
hosts=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      json_only=true
      shift
      ;;
    --api)
      api_url=${2:?--api requires a value}
      shift 2
      ;;
    --api=*)
      api_url=${1#*=}
      shift
      ;;
    --ui)
      ui_url=${2:?--ui requires a value}
      shift 2
      ;;
    --ui=*)
      ui_url=${1#*=}
      shift
      ;;
    --icecast)
      icecast_url=${2:?--icecast requires a value}
      shift 2
      ;;
    --icecast=*)
      icecast_url=${1#*=}
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        hosts+=("$1")
        shift
      done
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      hosts+=("$1")
      shift
      ;;
  esac
done

if [[ ${#hosts[@]} -eq 0 && -z "$api_url" && -z "$ui_url" && -z "$icecast_url" ]]; then
  echo "No checks requested. Provide at least one host or --api/--ui/--icecast." >&2
  usage
  exit 2
fi

curl_common=(--fail --silent --show-error --max-time 10)
if [[ "$INSECURE" == "1" ]]; then
  curl_common+=(--insecure)
fi


usage() {
  cat <<'EOF'
Usage:
  SSH_USER=admin AUDIOCTL_TOKEN=<token> scripts/acceptance.sh [options] <host> [<host> ...]

Options:
  --icecast <url>   Verify Icecast mount via HTTP HEAD (e.g., http://vps:8000/mount)
  --play-both       Instruct each host to /play source=stream and verify status
  -h, --help        Show this help text

Environment:
  SSH_USER          SSH user for ALSA checks (default: admin)
  AUDIOCTL_TOKEN    Bearer token for control API (optional)
  ICECAST_URL       Default Icecast URL (overridden by --icecast)

EOF
}

# Acceptance script to sanity-check player Pis and the stream.
# Usage:
#   SSH_USER=admin AUDIOCTL_TOKEN=token ICECAST_URL=http://vps:8000/mount \
#     scripts/acceptance.sh pi-audio-01 pi-audio-02
# Options:
#   --icecast <url>   # Override ICECAST_URL without exporting env
#   --play-both       # Trigger stream + fallback playback checks (requires token)


SSH_USER=${SSH_USER:-admin}
TOKEN=${AUDIOCTL_TOKEN:-}
ICECAST_URL=${ICECAST_URL:-}
PLAY_BOTH=0


HOSTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      ICECAST_URL=${2:-}
      shift 2


auth_hdr=( )

usage(){
  cat <<'USAGE' >&2
usage: [SSH_USER=admin] [AUDIOCTL_TOKEN=token] [ICECAST_URL=http://...] scripts/acceptance.sh [options] <pi-host> [<pi-host> ...]

Options:
  --icecast <url>   Override ICECAST_URL for Icecast reachability check
  --play-both       Trigger stream and fallback playback toggles (requires AUDIOCTL_TOKEN)
  -h, --help        Show this help message
USAGE
}

hosts=( )
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      shift
      if [[ $# -lt 1 ]]; then
        echo "--icecast requires a URL" >&2
        usage
        exit 2
      fi
      ICECAST_URL=$1
      shift

      ;;
    --play-both)
      PLAY_BOTH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift

      break
      ;;
    --*)
      echo "Unknown option: $1" >&2

      while [[ $# -gt 0 ]]; do
        hosts+=("$1")
        shift
      done
      break
      ;;
    -*)
      echo "unknown option: $1" >&2

      usage
      exit 2
      ;;
    *)

      HOSTS+=("$1")

      hosts+=("$1")

      shift
      ;;
  esac
done


if (( ${#HOSTS[@]} == 0 )); then
  usage
  exit 2

if [[ ${#hosts[@]} -eq 0 ]]; then
  usage
  exit 2
fi

if [[ -n "$TOKEN" ]]; then

  auth_hdr+=( -H "Authorization: Bearer ${TOKEN}" )
fi

api_auth_hdr=( )
if [[ -n "$API_TOKEN" ]]; then
  api_auth_hdr+=( -H "Authorization: Bearer ${API_TOKEN}" )

  auth_hdr=( -H "Authorization: Bearer ${TOKEN}" )


fi

warnings=0
errors=0

ok()  { printf "\033[32mOK\033[0m %s\n"   "$*"; }
warn(){ warnings=$((warnings + 1)); printf "\033[33mWARN\033[0m %s\n" "$*"; }
err() { errors=$((errors + 1)); printf "\033[31mERR\033[0m %s\n"  "$*"; }
info(){ printf "\033[36mINFO\033[0m %s\n" "$*"; }


summary_status="pass"
pass_count=0
warn_count=0
fail_count=0
declare -a recorded_checks=()

update_status() {
  local level=$1
  case "$level" in
    PASS)
      ((pass_count++))
      ;;
    WARN)
      ((warn_count++))
      if [[ "$summary_status" == "pass" ]]; then
        summary_status="warn"
      fi
      ;;
    FAIL)
      ((fail_count++))
      summary_status="fail"
      ;;
  esac
}

record_check() {
  local context=$1
  local check=$2
  local status=$3
  local message=$4

  update_status "$status"
  local json
  json=$(jq -n --arg context "$context" --arg check "$check" --arg status "$status" --arg message "$message" '{context:$context,check:$check,status:$status,message:$message}')
  recorded_checks+=("$json")

  if ! $json_only; then
    case "$status" in
      PASS) ok "[$context] $check - $message" ;;
      WARN) warn "[$context] $check - $message" ;;
      FAIL) err "[$context] $check - $message" ;;
    esac
  fi
}

print_section_header() {
  local title=$1
  if ! $json_only; then
    printf "\n== %s ==\n" "$title"
  fi
}

fetch_audio_logs() {
  local host=$1
  local ssh_target="${SSH_USER}@${host}"
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$ssh_target" \
    'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 50' 2>/dev/null || true
}

check_audio_host() {
  local host=$1
  local base="http://${host}:8081"
  local context="audio:${host}"

  print_section_header "$host"

  if curl "${curl_common[@]}" "$base/healthz" >/dev/null 2>&1; then
    record_check "$context" "healthz" "PASS" "${base}/healthz responded"
  else
    record_check "$context" "healthz" "FAIL" "${base}/healthz unreachable"
    if ! $json_only; then
      fetch_audio_logs "$host"
    fi
  fi

  local status_body=""
  if status_body=$(curl "${curl_common[@]}" "${auth_hdr[@]}" "$base/status" 2>/dev/null); then
    record_check "$context" "status" "PASS" "Fetched /status successfully"
    local device_count
    device_count=$(jq '[.alsa_cards, .alsa.cards, .cards, .devices, .audio.devices] | map(select(type=="array")) | (add // []) | length' <<<"$status_body" 2>/dev/null || echo "")
    if [[ -n "$device_count" && "$device_count" =~ ^[0-9]+$ ]]; then
      if (( device_count > 0 )); then
        record_check "$context" "audio-devices" "PASS" "${device_count} device(s) reported via /status"
      else
        record_check "$context" "audio-devices" "WARN" "No audio devices reported in /status"
      fi
    else
      record_check "$context" "audio-devices" "WARN" "Unable to parse audio device data from /status"
    fi


auth_curl=()
if [[ -n $TOKEN ]]; then
  auth_curl=(-H "Authorization: Bearer ${TOKEN}")
fi

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no)

declare -A summary_online
declare -A summary_source
declare -A summary_fallback
declare -A summary_volume

for host in "${HOSTS[@]}"; do
  summary_online["$host"]="no"
  summary_source["$host"]="?"
  summary_fallback["$host"]="?"
  summary_volume["$host"]="?"

  echo "== ${host} =="

  base="http://${host}:8081"

  if curl -fsS -m 5 "${base}/healthz" >/dev/null 2>&1; then

for host in "${hosts[@]}"; do
  echo "== ${host} =="
  base="http://${host}:8081"
  # Control API health
  if curl -fsS "${base}/healthz" >/dev/null 2>&1; then

    ok "control API healthy (:8081/healthz)"
    summary_online["$host"]="yes"
  else
    err "control API not responding on ${host}"
  fi


  status_json=""
  if status_json=$(curl -fsS -m 7 "${auth_curl[@]}" "${base}/status" 2>/dev/null); then
    if command -v jq >/dev/null 2>&1; then
      printf '%s\n' "$status_json" | jq .
    else
      printf '%s\n' "$status_json"
    fi
    current_source=$(printf '%s' "$status_json" | jq -r '.current_source // .source // "?"' 2>/dev/null || printf '?')
    fallback_exists=$(printf '%s' "$status_json" | jq -r '.fallback_exists // false' 2>/dev/null || printf 'false')
    volume_value=$(printf '%s' "$status_json" | jq -r '.volume // empty' 2>/dev/null || printf '')
    stream_up_flag=$(printf '%s' "$status_json" | jq -r '.stream_up // false' 2>/dev/null || printf 'false')
    summary_source["$host"]=$current_source
    if [[ $fallback_exists == "true" ]]; then
      summary_fallback["$host"]="yes"
    elif [[ $fallback_exists == "false" ]]; then
      summary_fallback["$host"]="no"
    fi
    if [[ -n $volume_value ]]; then
      if awk -v v="$volume_value" 'BEGIN { if (v == "") exit 1; if (v+0 == v) exit 0; exit 1 }'; then
        summary_volume["$host"]=$(printf '%.2f' "$volume_value")
      else
        summary_volume["$host"]=$volume_value
      fi
    fi

  # Status JSON (best-effort)
  if curl -fsS "${auth_hdr[@]}" "${base}/status" >/dev/null 2>&1; then
    curl -fsS "${auth_hdr[@]}" "${base}/status" || true
    echo


  else
    record_check "$context" "status" "FAIL" "Failed to fetch /status"
  fi


  local ssh_output
  local ssh_target="${SSH_USER}@${host}"
  if ssh_output=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$ssh_target" 'aplay -l' 2>/dev/null); then
    if grep -q '^card' <<<"$ssh_output"; then
      record_check "$context" "alsa-cli" "PASS" "ALSA device(s) detected via aplay"
    else
      record_check "$context" "alsa-cli" "WARN" "No ALSA devices detected via aplay"
    fi
  else
    record_check "$context" "alsa-cli" "WARN" "SSH connection or aplay failed"

  if ssh "${ssh_opts[@]}" "${SSH_USER}@${host}" 'aplay -l 2>/dev/null | grep -q "^card"'; then
    ok "ALSA device(s) present"
  else
    warn "no ALSA devices found via SSH (aplay -l)"
  fi

  if (( PLAY_BOTH )); then
    info "requesting stream playback"
    if curl -fsS -m 7 "${auth_curl[@]}" -H 'Content-Type: application/json' -d '{"source":"stream"}' "${base}/play" >/dev/null 2>&1; then
      ok "POST /play (source=stream)"
    else
      err "failed to POST /play on ${host}"
    fi
    sleep 2
    if status_after=$(curl -fsS -m 7 "${auth_curl[@]}" "${base}/status" 2>/dev/null); then
      current_source=$(printf '%s' "$status_after" | jq -r '.current_source // .source // "?"' 2>/dev/null || printf '?')
      stream_up_flag=$(printf '%s' "$status_after" | jq -r '.stream_up // false' 2>/dev/null || printf 'false')
      fallback_exists=$(printf '%s' "$status_after" | jq -r '.fallback_exists // false' 2>/dev/null || printf 'false')
      volume_value=$(printf '%s' "$status_after" | jq -r '.volume // empty' 2>/dev/null || printf '')
      summary_source["$host"]=$current_source
      if [[ $fallback_exists == "true" ]]; then
        summary_fallback["$host"]="yes"
      elif [[ $fallback_exists == "false" ]]; then
        summary_fallback["$host"]="no"
      fi
      if [[ -n $volume_value ]]; then
        if awk -v v="$volume_value" 'BEGIN { if (v == "") exit 1; if (v+0 == v) exit 0; exit 1 }'; then
          summary_volume["$host"]=$(printf '%.2f' "$volume_value")
        else
          summary_volume["$host"]=$volume_value
        fi
      fi
      if [[ $current_source == "stream" || $stream_up_flag == "true" ]]; then
        ok "${host} reports stream playback"
      else
        warn "${host} did not report stream playback after /play"
      fi
    else
      warn "cannot refresh /status after /play"
    fi
  fi

  if [[ ${PLAY_BOTH} -eq 1 ]]; then
    if [[ -z "$TOKEN" ]]; then
      warn "--play-both requested but AUDIOCTL_TOKEN not set; skipping playback toggles"
    else
      if curl -fsS "${auth_hdr[@]}" -H 'Content-Type: application/json' -d '{"source":"stream"}' "${base}/play" >/dev/null 2>&1; then
        ok "play stream requested via /play"
      else
        warn "unable to request stream playback"
      fi
      sleep 1
      if curl -fsS "${auth_hdr[@]}" -H 'Content-Type: application/json' -d '{"source":"file"}' "${base}/play" >/dev/null 2>&1; then
        ok "play fallback requested via /play"
      else
        warn "unable to request fallback playback"
      fi
      if curl -fsS "${auth_hdr[@]}" -X PUT -H 'Content-Type: application/json' -d '{"mode":"auto","source":"stream"}' "${base}/config" >/dev/null 2>&1; then
        ok "restored auto stream mode"
      else
        warn "could not restore auto stream mode"
      fi
    fi

  fi
}

check_icecast() {
  local url=$1
  print_section_header "Icecast"
  if curl -I "${curl_common[@]}" -X HEAD "$url" >/dev/null 2>&1; then
    record_check "icecast" "mount" "PASS" "Icecast mount reachable (${url})"
  else
    record_check "icecast" "mount" "FAIL" "Icecast mount unreachable (${url})"
  fi
}

normalize_base() {
  local value="$1"
  value="${value%%/}"
  echo "$value"
}

check_api() {
  local base
  base=$(normalize_base "$1")
  print_section_header "API ${base}"
  local context="api:${base}"

  local health_url="${base}/healthz"
  if curl "${curl_common[@]}" "${api_auth_hdr[@]}" "$health_url" >/dev/null 2>&1; then
    record_check "$context" "healthz" "PASS" "${health_url} responded"
  else
    record_check "$context" "healthz" "FAIL" "${health_url} unreachable"
  fi

  local state_body
  local state_url="${base}/fleet/state"
  if state_body=$(curl "${curl_common[@]}" "${api_auth_hdr[@]}" "$state_url" 2>/dev/null); then
    if jq -e 'type == "object"' <<<"$state_body" >/dev/null 2>&1; then
      record_check "$context" "fleet-state" "PASS" "${state_url} returned JSON"
    else
      record_check "$context" "fleet-state" "WARN" "${state_url} returned unexpected payload"
    fi
  else
    record_check "$context" "fleet-state" "FAIL" "${state_url} unreachable"
  fi

  local layout_body
  local layout_url="${base}/fleet/layout"
  if layout_body=$(curl "${curl_common[@]}" "${api_auth_hdr[@]}" "$layout_url" 2>/dev/null); then
    if jq -e 'type == "object"' <<<"$layout_body" >/dev/null 2>&1; then
      record_check "$context" "fleet-layout" "PASS" "${layout_url} returned JSON"
    else
      record_check "$context" "fleet-layout" "WARN" "${layout_url} returned unexpected payload"
    fi
  else
    record_check "$context" "fleet-layout" "FAIL" "${layout_url} unreachable"
  fi
}


check_ui() {
  local base
  base=$(normalize_base "$1")
  print_section_header "UI ${base}"
  local context="ui:${base}"

  local page_body
  if page_body=$(curl "${curl_common[@]}" "$base" 2>/dev/null); then
    record_check "$context" "root" "PASS" "${base} responded"
    if grep -qi "${EXPECTED_UI_TITLE}" <<<"$page_body"; then
      record_check "$context" "title" "PASS" "Found '${EXPECTED_UI_TITLE}' in HTML"
    else
      record_check "$context" "title" "FAIL" "Did not find '${EXPECTED_UI_TITLE}' in HTML"
    fi

if [[ -n $ICECAST_URL ]]; then
  if curl -fsI -m 5 "$ICECAST_URL" >/dev/null 2>&1; then
    ok "Icecast mount reachable: ${ICECAST_URL}"

  else
    record_check "$context" "root" "FAIL" "${base} unreachable"
  fi
}

for host in "${hosts[@]}"; do
  check_audio_host "$host"
done

if [[ -n "$icecast_url" ]]; then
  check_icecast "$icecast_url"
fi

if [[ -n "$api_url" ]]; then
  check_api "$api_url"
fi

if [[ -n "$ui_url" ]]; then
  check_ui "$ui_url"
fi

checks_json="[]"
if [[ ${#recorded_checks[@]} -gt 0 ]]; then
  checks_json=$(printf '%s\n' "${recorded_checks[@]}" | jq -s '.')
fi

summary_json=$(jq -n \
  --arg status "$summary_status" \
  --arg pass "$pass_count" \
  --arg warn "$warn_count" \
  --arg fail "$fail_count" \
  --argjson checks "$checks_json" \
  '{status:$status,counts:{pass:($pass|tonumber),warn:($warn|tonumber),fail:($fail|tonumber)},checks:$checks}')

exit_code=0
case "$summary_status" in
  pass) exit_code=0 ;;
  warn) exit_code=1 ;;
  fail) exit_code=2 ;;
  *) exit_code=2 ;;
esac

if $json_only; then
  echo "$summary_json"
else
  printf "\nSummary: %s (pass=%d warn=%d fail=%d)\n" "${summary_status^^}" "$pass_count" "$warn_count" "$fail_count"
  echo "$summary_json"
fi


exit $exit_code


printf "Summary:\n"
printf "%-22s %-8s %-14s %-10s %-8s\n" "Host" "Online" "Source" "Fallback" "Volume"
  for host in "${HOSTS[@]}"; do
    printf "%-22s %-8s %-14s %-10s %-8s\n" \
      "$host" \
      "${summary_online[$host]}" \
      "${summary_source[$host]}" \
      "${summary_fallback[$host]}" \
      "${summary_volume[$host]}"
  done

exit_code=0
if (( errors > 0 )); then
  exit_code=2
elif (( warnings > 0 )); then
  exit_code=1
fi

case $exit_code in
  0) ok "All checks passed" ;;
  1) warn "Completed with warnings" ;;
  2) err "Completed with errors" ;;
 esac

  exit "$exit_code"

echo "Done."

# --- Video role hooks (stubs) ---
# If you later add a video-capture role/API, wire checks here, e.g.:
# for host in "${hosts[@]}"; do
#   if curl -fsS "http://${host}:8091/healthz" >/dev/null 2>&1; then
#     ok "video API healthy (:8091/healthz)"
#   else
#     warn "video API not responding on ${host}"
#   fi
# done


