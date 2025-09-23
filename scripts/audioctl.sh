#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  AUDIOCTL_HOST=<host> [AUDIOCTL_TOKEN=<token>] scripts/audioctl.sh [options] <command> [args]
  scripts/audioctl.sh [options] --host <host> <command> [args]

Options:
  --host <host>         Target host or host:port (defaults to AUDIOCTL_HOST)
  --token <token>       Bearer token (defaults to AUDIOCTL_TOKEN)
  --timeout <seconds>   Request timeout (default: 5)
  --retries <count>     Retries for idempotent GETs (default: 0)
  --json                Print raw JSON responses (no pretty-print)
  -h, --help            Show this help message

Commands:
  status                GET /status (pretty printed JSON)
  config                GET /config (pretty printed JSON)
  health                GET /healthz
  metrics               GET /metrics (first 20 lines)
  volume <0.0-2.0>      POST /volume with the provided multiplier
  play [stream|file]    POST /play (default source: stream)
  stop                  POST /stop
  set-url <url>         PUT /config to update stream_url
  mode <auto|manual>    PUT /config to update playback mode
  source <stream|file|stop>
                        PUT /config to update desired source
  upload <file>         POST /upload fallback file (multipart)

Examples:
  AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=secret scripts/audioctl.sh status
  scripts/audioctl.sh --host pi-audio-01 --token secret volume 0.8
  scripts/audioctl.sh --host pi-audio-01 --token secret mode auto
EOF
}

HOST=${AUDIOCTL_HOST:-}
TOKEN=${AUDIOCTL_TOKEN:-}
TIMEOUT=5
RETRIES=0
JSON_OUTPUT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST=${2:-}
      shift 2
      ;;
    --token)
      TOKEN=${2:-}
      shift 2
      ;;
    --timeout)
      TIMEOUT=${2:-}
      shift 2
      ;;
    --retries)
      RETRIES=${2:-}
      shift 2
      ;;
    --json)
      JSON_OUTPUT=1
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
      usage
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "Error: host is required (set AUDIOCTL_HOST or use --host)." >&2
  usage
  exit 2
fi

if [[ -z "${1:-}" ]]; then
  echo "Error: command is required." >&2
  usage
  exit 2
fi

if ! [[ $TIMEOUT =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Error: --timeout must be a positive number." >&2
  exit 2
fi

if ! [[ $RETRIES =~ ^[0-9]+$ ]]; then
  echo "Error: --retries must be a non-negative integer." >&2
  exit 2
fi

BASE=""
if [[ $HOST == http://* || $HOST == https://* ]]; then
  BASE=${HOST%/}
elif [[ $HOST == *:* ]]; then
  BASE="http://${HOST}"
else
  BASE="http://${HOST}:8081"
fi

AUTH_HEADER=()
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${TOKEN}")
fi

HTTP_STATUS=0
HTTP_BODY=""
HTTP_ERROR=""

print_json_body() {
  local body=$1
  if (( JSON_OUTPUT )); then
    printf '%s
' "$body"
    return
  fi
  if [[ -z $body ]]; then
    return
  fi
  if [[ $body =~ ^[[:space:]]*[\{\[] ]]; then
    if command -v jq >/dev/null 2>&1; then
      printf '%s
' "$body" | jq .
    else
      printf '%s
' "$body"
    fi
  else
    printf '%s
' "$body"
  fi
}

http_request() {
  local method=$1
  local path=$2
  shift 2
  local -a extra_opts=("$@")
  local url="${BASE}${path}"
  local tmp
  tmp=$(mktemp)
  HTTP_ERROR=""
  HTTP_BODY=""
  HTTP_STATUS=0
  local status
  if ! status=$(curl -sS --show-error --max-time "$TIMEOUT" -w '%{http_code}' -o "$tmp" -X "$method" "${AUTH_HEADER[@]}" "${extra_opts[@]}" "$url"); then
    HTTP_ERROR="curl failed"
    rm -f "$tmp"
    return 1
  fi
  HTTP_STATUS=${status//$'\n'/}
  HTTP_BODY=$(cat "$tmp")
  rm -f "$tmp"
  return 0
}

perform_get() {
  local path=$1
  shift
  local -a extra_opts=("$@")
  local attempt=0
  while true; do
    if http_request GET "$path" "${extra_opts[@]}"; then
      local code=0
      if [[ $HTTP_STATUS =~ ^[0-9]+$ ]]; then
        code=$((10#$HTTP_STATUS))
      fi
      if (( code >= 500 && attempt < RETRIES )); then
        attempt=$((attempt + 1))
        sleep 1
        continue
      fi
      return 0
    fi
    if (( attempt < RETRIES )); then
      attempt=$((attempt + 1))
      sleep 1
      continue
    fi
    return 1
  done
}

escape_json_string() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

handle_response() {
  local description=$1
  local printer=$2
  local status_code=0
  if [[ $HTTP_STATUS =~ ^[0-9]+$ ]]; then
    status_code=$((10#$HTTP_STATUS))
  fi
  if [[ -n $HTTP_ERROR && $status_code -eq 0 ]]; then
    echo "Request failed (${description}): ${HTTP_ERROR}" >&2
    return 2
  fi
  if (( status_code >= 200 && status_code < 300 )); then
    case "$printer" in
      json)
        print_json_body "$HTTP_BODY"
        ;;
      raw)
        if [[ -n $HTTP_BODY ]]; then
          printf '%s
' "$HTTP_BODY"
        fi
        ;;
      metrics)
        if [[ -n $HTTP_BODY ]]; then
          printf '%s
' "$HTTP_BODY" | head -n 20
        fi
        ;;
      *)
        if [[ -n $HTTP_BODY ]]; then
          printf '%s
' "$HTTP_BODY"
        fi
        ;;
    esac
    return 0
  fi
  if (( status_code == 0 )); then
    echo "Request failed (${description}): no response" >&2
    return 2
  fi
  echo "Request failed (${description}): HTTP ${status_code}" >&2
  if [[ -n $HTTP_BODY ]]; then
    if [[ $printer == json && $HTTP_BODY =~ ^[[:space:]]*[\{\[] ]]; then
      if command -v jq >/dev/null 2>&1; then
        printf '%s
' "$HTTP_BODY" | jq . >&2
      else
        printf '%s
' "$HTTP_BODY" >&2
      fi
    else
      printf '%s
' "$HTTP_BODY" >&2
    fi
  fi
  return $((status_code / 100))
}

validate_volume() {
  local value=$1
  if ! [[ $value =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    echo "Error: volume must be numeric." >&2
    exit 2
  fi
  if ! awk -v v="$value" 'BEGIN { exit !(v >= 0 && v <= 2) }'; then
    echo "Error: volume must be between 0.0 and 2.0." >&2
    exit 2
  fi
}

cmd=$1
shift

case "$cmd" in
  status)
    perform_get "/status"
    rc=$(handle_response "GET /status" json)
    exit "$rc"
    ;;
  config)
    perform_get "/config"
    rc=$(handle_response "GET /config" json)
    exit "$rc"
    ;;
  health)
    perform_get "/healthz"
    rc=$(handle_response "GET /healthz" raw)
    exit "$rc"
    ;;
  metrics)
    perform_get "/metrics"
    rc=$(handle_response "GET /metrics" metrics)
    exit "$rc"
    ;;
  volume)
    volume_value=${1:-}
    if [[ -z $volume_value ]]; then
      echo "Usage: $0 volume <0.0-2.0>" >&2
      exit 2
    fi
    validate_volume "$volume_value"
    payload="{\"volume\":${volume_value}}"
    http_request POST "/volume" -H 'Content-Type: application/json' --data "$payload"
    rc=$(handle_response "POST /volume" json)
    exit "$rc"
    ;;
  play)
    source_arg=${1:-stream}
    escaped=$(escape_json_string "$source_arg")
    payload="{\"source\":${escaped}}"
    http_request POST "/play" -H 'Content-Type: application/json' --data "$payload"
    rc=$(handle_response "POST /play" json)
    exit "$rc"
    ;;
  stop)
    http_request POST "/stop"
    rc=$(handle_response "POST /stop" json)
    exit "$rc"
    ;;
  set-url)
    url=${1:-}
    if [[ -z $url ]]; then
      echo "Usage: $0 set-url <url>" >&2
      exit 2
    fi
    escaped=$(escape_json_string "$url")
    payload="{\"stream_url\":${escaped}}"
    http_request PUT "/config" -H 'Content-Type: application/json' --data "$payload"
    rc=$(handle_response "PUT /config" json)
    exit "$rc"
    ;;
  mode)
    mode_value=${1:-}
    if [[ -z $mode_value ]]; then
      echo "Usage: $0 mode <auto|manual>" >&2
      exit 2
    fi
    escaped=$(escape_json_string "$mode_value")
    payload="{\"mode\":${escaped}}"
    http_request PUT "/config" -H 'Content-Type: application/json' --data "$payload"
    rc=$(handle_response "PUT /config" json)
    exit "$rc"
    ;;
  source)
    source_value=${1:-}
    if [[ -z $source_value ]]; then
      echo "Usage: $0 source <stream|file|stop>" >&2
      exit 2
    fi
    escaped=$(escape_json_string "$source_value")
    payload="{\"source\":${escaped}}"
    http_request PUT "/config" -H 'Content-Type: application/json' --data "$payload"
    rc=$(handle_response "PUT /config" json)
    exit "$rc"
    ;;
  upload)
    file_path=${1:-}
    if [[ -z $file_path ]]; then
      echo "Usage: $0 upload <file>" >&2
      exit 2
    fi
    if [[ ! -f $file_path ]]; then
      echo "Error: file not found: $file_path" >&2
      exit 2
    fi
    http_request POST "/upload" -F "file=@${file_path}"
    rc=$(handle_response "POST /upload" json)
    exit "$rc"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 2
    ;;
 esac
