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
HTTP_TIMEOUT=5

HOSTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      ICECAST_URL=${2:?--icecast requires a value}
      shift 2
      ;;
    --icecast=*)
      ICECAST_URL=${1#*=}
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
      HOSTS+=("$@")
      break
      ;;
    -* )
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
  usage >&2
  exit 2
fi

ok()  { printf '\033[32mOK\033[0m %s\n'   "$*"; }
warn(){ printf '\033[33mWARN\033[0m %s\n' "$*"; WARN_COUNT=$((WARN_COUNT+1)); }
err() { printf '\033[31mERR\033[0m %s\n'  "$*"; ERROR_COUNT=$((ERROR_COUNT+1)); }

WARN_COUNT=0
ERROR_COUNT=0

AUTH_HEADER=()
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${TOKEN}")
fi

API_RESPONSE=""
API_STATUS=0

call_api() {
  local host="$1"
  local method="$2"
  local path="$3"
  shift 3
  local -a extra=("$@")
  local url="http://${host}:8081${path}"
  local tmp
  tmp=$(mktemp)
  local -a cmd=(curl -sS --max-time "$HTTP_TIMEOUT" --connect-timeout "$HTTP_TIMEOUT" -o "$tmp" -w '%{http_code}' -X "$method")
  if [[ "$path" != "/healthz" ]] && [[ ${#AUTH_HEADER[@]} -gt 0 ]]; then
    cmd+=("${AUTH_HEADER[@]}")
  fi
  cmd+=("${extra[@]}" "$url")
  local status
  if ! status=$("${cmd[@]}"); then
    API_RESPONSE=""
    API_STATUS=0
    rm -f "$tmp"
    return 1
  fi
  API_STATUS=${status//$'\n'/}
  API_STATUS=${API_STATUS//$'\r'/}
  API_RESPONSE=$(cat "$tmp")
  rm -f "$tmp"
  return 0
}

print_json() {
  local payload="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$payload" | jq .
  else
    printf '%s\n' "$payload"
  fi
}

extract_status_fields() {
  local json="$1"
  if command -v python3 >/dev/null 2>&1; then
    mapfile -t STATUS_FIELDS < <(python3 - "$json" <<'PY'
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception:
    data = {}
now = data.get("now_playing") or data.get("player_state") or data.get("source") or ""
fallback = data.get("fallback_exists")
volume = data.get("volume")
stream_up = data.get("stream_up")
print(now if now is not None else "")
print("true" if fallback else "false")
print("" if volume is None else volume)
print("" if stream_up is None else stream_up)
PY
    )
  elif command -v jq >/dev/null 2>&1; then
    mapfile -t STATUS_FIELDS < <(printf '%s\n' "$json" | jq -r '[.now_playing // .player_state // .source, (.fallback_exists // false), (.volume // ""), (.stream_up // "")] | @tsv' | tr '\t' '\n')
  else
    STATUS_FIELDS=("" "" "" "")
  fi
}

summary_hosts=()
summary_api=()
summary_now=()
summary_fallback=()
summary_volume=()

for host in "${HOSTS[@]}"; do
  echo "== ${host} =="
  control_ok=0
  status_ok=0
  status_json=""

  if call_api "$host" GET "/healthz"; then
    if [[ "$API_STATUS" == "200" ]]; then
      ok "control API healthy (:8081/healthz)"
      control_ok=1
    else
      err "control API health returned HTTP ${API_STATUS}"
    fi
  else
    err "control API not responding"
  fi

  if (( control_ok )); then
    if call_api "$host" GET "/status"; then
      if [[ "$API_STATUS" == "200" ]]; then
        status_ok=1
        status_json="$API_RESPONSE"
        print_json "$status_json"
      elif [[ "$API_STATUS" == "401" ]]; then
        err "unauthorized fetching /status (check AUDIOCTL_TOKEN)"
      else
        err "/status returned HTTP ${API_STATUS}"
      fi
    else
      warn "failed to reach /status"
    fi
  else
    warn "skipping /status due to control API failure"
  fi

  if ssh -o BatchMode=yes -o ConnectTimeout=5 "${SSH_USER}@${host}" 'aplay -l | grep -q "^card"'; then
    ok "ALSA device(s) present"
  else
    warn "no ALSA devices found (aplay -l)"
  fi

  if (( PLAY_BOTH )) && (( control_ok )); then
    payload='{"source":"stream"}'
    if call_api "$host" POST "/play" -H 'Content-Type: application/json' --data "$payload"; then
      if [[ "$API_STATUS" == "200" ]]; then
        ok "requested stream playback via /play"
      else
        err "/play stream returned HTTP ${API_STATUS}"
      fi
    else
      err "failed to invoke /play on ${host}"
    fi
    sleep 1
    if call_api "$host" GET "/status"; then
      if [[ "$API_STATUS" == "200" ]]; then
        status_ok=1
        status_json="$API_RESPONSE"
        print_json "$status_json"
        extract_status_fields "$status_json"
        now_playing_post=${STATUS_FIELDS[0]:-}
        if [[ "${now_playing_post}" != "stream" ]]; then
          warn "${host}: expected now_playing=stream after /play, got '${now_playing_post:-?}'"
        else
          ok "${host}: now playing stream"
        fi
      else
        err "post-play /status returned HTTP ${API_STATUS}"
      fi
    else
      warn "failed to verify /status after /play"
    fi
  fi

  summary_hosts+=("$host")
  if (( control_ok )) && (( status_ok )); then
    summary_api+=("UP")
  else
    summary_api+=("DOWN")
  fi

  now_value="?"
  fallback_value="?"
  volume_value="?"
  if (( status_ok )) && [[ -n "$status_json" ]]; then
    extract_status_fields "$status_json"
    now_value=${STATUS_FIELDS[0]:-}
    fallback_flag=${STATUS_FIELDS[1]:-false}
    volume_raw=${STATUS_FIELDS[2]:-}
    if [[ -z "$now_value" ]]; then
      now_value="?"
    fi
    if [[ "$fallback_flag" == "true" ]]; then
      fallback_value="yes"
    elif [[ "$fallback_flag" == "false" ]]; then
      fallback_value="no"
    else
      fallback_value="?"
    fi
    if [[ -n "$volume_raw" ]] && [[ "$volume_raw" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
      volume_value=$(printf '%.2f' "$volume_raw")
    elif [[ -n "$volume_raw" ]]; then
      volume_value="$volume_raw"
    fi
  fi

  summary_now+=("$now_value")
  summary_fallback+=("$fallback_value")
  summary_volume+=("$volume_value")

  echo
done

if [[ -n "$ICECAST_URL" ]]; then
  if curl -fsI --max-time "$HTTP_TIMEOUT" "$ICECAST_URL" >/dev/null 2>&1; then
    ok "Icecast mount reachable: ${ICECAST_URL}"
  else
    err "Icecast mount not reachable: ${ICECAST_URL}"
  fi
fi

printf '\nSummary:\n'
printf '%-18s %-8s %-12s %-12s %-8s\n' "Host" "API" "NowPlaying" "Fallback" "Volume"
for i in "${!summary_hosts[@]}"; do
  host=${summary_hosts[$i]}
  api_state=${summary_api[$i]}
  now=${summary_now[$i]}
  fb=${summary_fallback[$i]}
  vol=${summary_volume[$i]}
  if [[ "$api_state" == "UP" ]]; then
    api_fmt=$'\033[32mUP\033[0m'
  else
    api_fmt=$'\033[31mDOWN\033[0m'
  fi
  printf '%-18s %-8s %-12s %-12s %-8s\n' "$host" "$api_fmt" "${now}" "${fb}" "${vol}"
done

if (( ERROR_COUNT > 0 )); then
  exit 2
elif (( WARN_COUNT > 0 )); then
  exit 1
else
  exit 0
fi

