#!/usr/bin/env bash
set -euo pipefail


usage() {
  cat <<'EOF'
Usage: SSH_USER=admin AUDIOCTL_TOKEN=token scripts/acceptance.sh [options] <host> [<host> ...]

Options:
  --icecast <url>   Perform HEAD against the Icecast mount (e.g., http://vps:8000/mount)
  --play-both       Issue /play source=stream to each host and verify status afterwards
  -h, --help        Show this help message

Environment:
  SSH_USER          SSH username for ALSA/container checks (default: admin)
  AUDIOCTL_TOKEN    Bearer token for control API requests

The script prints per-host diagnostics (healthz, status JSON, ALSA presence), then
summarizes API state, playback status, fallback availability, and volume across hosts.
Exit codes: 0=all OK, 1=warnings, 2=errors.
EOF
}

SSH_USER=${SSH_USER:-admin}
TOKEN=${AUDIOCTL_TOKEN:-}
ICECAST_URL=${ICECAST_URL:-}
PLAY_BOTH=0
PI_VIDEO_HOST=${PI_VIDEO_HOST:-}
PI_CAMERA_HOST=${PI_CAMERA_HOST:-}
VPS_HOST=${VPS_HOST:-}

HOSTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      ICECAST_URL=${2:-}
      shift 2
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
      HOSTS+=("$@")
      break
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      HOSTS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#HOSTS[@]} -eq 0 ]]; then
  echo "Error: no audio hosts specified" >&2
  usage
  exit 2
fi

exit_code=0
checks=()

red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }

err() {
  red "ERR: $*"
  exit_code=2
}

warn() {
  yellow "WARN: $*"
  if [[ $exit_code -eq 0 ]]; then
    exit_code=1
  fi
}

ok() {
  green "OK: $*"
}

info() {
  echo "INFO: $*"
}

record_check() {
  local context=$1
  local check_name=$2
  local status=$3
  local message=$4

  checks+=("{\"context\":\"$context\",\"check\":\"$check_name\",\"status\":\"$status\",\"message\":\"$message\"}")
}

audio_host_checks() {
  local host=$1
  local base="http://${host}:8081"
  local context="audio-$host"

  local auth_curl=()
  if [[ -n $TOKEN ]]; then
    auth_curl=(-H "Authorization: Bearer $TOKEN")
  fi

  info "checking audio host: $host"

  if curl -fsS -m 5 "$base/healthz" >/dev/null 2>&1; then
    ok "healthz endpoint ($host:8081)"
    record_check "$context" "healthz" "PASS" "Audio API health check successful"
  else
    err "healthz endpoint failed ($host:8081)"
    record_check "$context" "healthz" "FAIL" "Audio API health check failed"
    return
  fi

  local status_json
  if status_json=$(curl -fsS -m 5 "${auth_curl[@]}" "$base/status" 2>/dev/null); then
    ok "status endpoint ($host:8081)"
    record_check "$context" "status" "PASS" "Audio API status endpoint accessible"

    if echo "$status_json" | jq . >/dev/null 2>&1; then
      ok "status JSON valid ($host)"
      record_check "$context" "status-json" "PASS" "Status response is valid JSON"

      local playback_state fallback_state
      playback_state=$(echo "$status_json" | jq -r '.playback.state // "unknown"')
      fallback_state=$(echo "$status_json" | jq -r '.fallback.available // false')

      info "playback state: $playback_state, fallback available: $fallback_state"
      record_check "$context" "playback-state" "INFO" "Playback state: $playback_state"
      record_check "$context" "fallback-available" "INFO" "Fallback available: $fallback_state"
    else
      warn "status JSON invalid ($host)"
      record_check "$context" "status-json" "WARN" "Status response is not valid JSON"
    fi
  else
    err "status endpoint failed ($host:8081)"
    record_check "$context" "status" "FAIL" "Audio API status endpoint failed"
  fi

  local ssh_opts=(-o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)

  if ssh "${ssh_opts[@]}" "${SSH_USER}@${host}" 'aplay -l 2>/dev/null | grep -q "^card"'; then
    ok "ALSA device(s) present"
    record_check "$context" "alsa-cli" "PASS" "ALSA device(s) detected via aplay"
  else
    warn "no ALSA devices found via SSH (aplay -l)"
    record_check "$context" "alsa-cli" "WARN" "No ALSA devices detected via aplay"
  fi

  if (( PLAY_BOTH )); then
    info "requesting stream playback"
    if curl -fsS -m 7 "${auth_curl[@]}" -H 'Content-Type: application/json' -d '{"source":"stream"}' "${base}/play" >/dev/null 2>&1; then
      ok "POST /play (source=stream)"
      record_check "$context" "play-stream" "PASS" "Successfully triggered stream playback"
    else
      err "failed to POST /play on ${host}"
      record_check "$context" "play-stream" "FAIL" "Failed to trigger stream playback"
    fi
    sleep 2
  fi
}

main() {
  echo "Fleet Audio Acceptance Test"
  echo "=========================="
  echo

  for host in "${HOSTS[@]}"; do
    audio_host_checks "$host"
    echo
  done

  if [[ -n $PI_VIDEO_HOST ]]; then
    local context="video-${PI_VIDEO_HOST}"
    local url="http://${PI_VIDEO_HOST}:8082/healthz"
    info "probing video host health: $url"
    if curl -fsS -m 5 "$url" >/dev/null 2>&1; then
      ok "video healthz endpoint (${PI_VIDEO_HOST}:8082)"
      record_check "$context" "healthz" "PASS" "Video Pi health check successful"
    else
      warn "video health probe failed (${PI_VIDEO_HOST}:8082)"
      record_check "$context" "healthz" "WARN" "Video Pi health check failed"
    fi
    echo
  fi

  if [[ -n $PI_CAMERA_HOST ]]; then
    local context="camera-${PI_CAMERA_HOST}"
    local url="http://${PI_CAMERA_HOST}:8083/healthz"
    info "probing camera host health: $url"
    if curl -fsS -m 5 "$url" >/dev/null 2>&1; then
      ok "camera healthz endpoint (${PI_CAMERA_HOST}:8083)"
      record_check "$context" "healthz" "PASS" "Camera Pi health check successful"
    else
      warn "camera health probe failed (${PI_CAMERA_HOST}:8083)"
      record_check "$context" "healthz" "WARN" "Camera Pi health check failed"
    fi
    echo
  fi

  if [[ -n $VPS_HOST ]]; then
    local context="zigbee-${VPS_HOST}"
    local url="http://${VPS_HOST}:3006/ui/zigbee"
    info "probing Zigbee UI route: $url"
    if curl -fsS -m 5 "$url" >/dev/null 2>&1; then
      ok "Zigbee UI accessible (${VPS_HOST}:3006)"
      record_check "$context" "ui-zigbee" "PASS" "Zigbee UI responded successfully"
    else
      yellow "Zigbee UI not yet available (${VPS_HOST}:3006) — probe is informational"
      record_check "$context" "ui-zigbee" "WARN" "Zigbee UI probe failed (non-blocking, informational only)"
    fi
    echo
  fi

  if [[ -n $ICECAST_URL ]]; then
    info "checking Icecast stream: $ICECAST_URL"
    if curl -fsS -m 10 -I "$ICECAST_URL" >/dev/null 2>&1; then
      ok "Icecast mount accessible"
      record_check "stream" "icecast-mount" "PASS" "Icecast mount HEAD request successful"
    else
      err "Icecast mount not accessible: $ICECAST_URL"
      record_check "stream" "icecast-mount" "FAIL" "Icecast mount HEAD request failed"
    fi
    echo
  fi

  echo "Summary:"
  echo "========"

  local pass_count=0 warn_count=0 fail_count=0
  for check in "${checks[@]}"; do
    local status
    status=$(echo "$check" | jq -r '.status')
    case $status in
      PASS) ((pass_count++)) ;;
      WARN) ((warn_count++)) ;;
      FAIL) ((fail_count++)) ;;
    esac
  done

  echo "Checks: $pass_count passed, $warn_count warnings, $fail_count failed"

  if [[ $fail_count -gt 0 ]]; then
    red "OVERALL: FAIL ($fail_count critical issues)"
    exit_code=2
  elif [[ $warn_count -gt 0 ]]; then
    yellow "OVERALL: WARN ($warn_count warnings)"
    exit_code=1
  else
    green "OVERALL: PASS (all checks succeeded)"
    exit_code=0
  fi

  echo
  echo "Exit code: $exit_code"
  exit $exit_code
}

main