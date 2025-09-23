#!/usr/bin/env bash
set -euo pipefail

usage() {
cat <<'USAGE_HERE'
Usage: AUDIOCTL_HOST=host [AUDIOCTL_TOKEN=token] scripts/audioctl.sh [options] <command> [args]

Options:
  --host <host>           Override AUDIOCTL_HOST (hostname, host:port, or full URL)
  --token <token>         Override AUDIOCTL_TOKEN (Bearer token)
  --port <port>           Override port when --host is a bare hostname (default 8081)
  --base-url <url>        Use a fully-qualified base URL instead of http://host:port
  --timeout <seconds>     HTTP timeout for curl (default 5)
  --retries <count>       Retries for idempotent GETs (default 0)
  --json                  Print raw JSON responses (instead of jq pretty output)
  -h, --help              Show this help and exit

Commands:
  status                  GET /status (JSON)
  config                  GET /config (JSON)
  health                  GET /healthz (plain text)
  metrics                 GET /metrics (first 20 lines)
  volume <0.0-2.0>        POST /volume {"volume": value}
  play <stream|file>      POST /play {"source": value}
  stop                    POST /stop
  set-url <url>           PUT /config {"stream_url": url}
  upload <file>           POST /upload (multipart form file)
  mode <auto|manual>      PUT /config {"mode": value}
  source <stream|file|stop> PUT /config {"source": value}

Examples:
  AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=secret ./scripts/audioctl.sh status
  ./scripts/audioctl.sh --host pi-audio-01 --token secret volume 0.8
  ./scripts/audioctl.sh --host pi-audio-01 --token secret metrics
USAGE_HERE
}

HOST=${AUDIOCTL_HOST:-}
TOKEN=${AUDIOCTL_TOKEN:-}
PORT=${AUDIOCTL_PORT:-8081}
BASE_OVERRIDE=${AUDIOCTL_BASE_URL:-}
TIMEOUT=5
RETRIES=0
JSON_OUTPUT=0

POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST=${2:?--host requires a value}
      shift 2
      ;;
    --host=*)
      HOST=${1#*=}
      shift
      ;;
    --token)
      TOKEN=${2:?--token requires a value}
      shift 2
      ;;
    --token=*)
      TOKEN=${1#*=}
      shift
      ;;
    --port)
      PORT=${2:?--port requires a value}
      shift 2
      ;;
    --port=*)
      PORT=${1#*=}
      shift
      ;;
    --base-url)
      BASE_OVERRIDE=${2:?--base-url requires a value}
      shift 2
      ;;
    --base-url=*)
      BASE_OVERRIDE=${1#*=}
      shift
      ;;
    --timeout)
      TIMEOUT=${2:?--timeout requires a value}
      shift 2
      ;;
    --timeout=*)
      TIMEOUT=${1#*=}
      shift
      ;;
    --retries)
      RETRIES=${2:?--retries requires a value}
      shift 2
      ;;
    --retries=*)
      RETRIES=${1#*=}
      shift
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
      POSITIONAL+=("$@")
      break
      ;;
    -* )
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

set -- "${POSITIONAL[@]}"

if [[ -z ${BASE_OVERRIDE} ]] && [[ -z ${HOST} ]]; then
  echo "AUDIOCTL_HOST environment variable or --host flag is required" >&2
  usage
  exit 2
fi

if ! [[ ${TIMEOUT} =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Invalid --timeout value: ${TIMEOUT}" >&2
  exit 2
fi

if ! [[ ${RETRIES} =~ ^[0-9]+$ ]]; then
  echo "Invalid --retries value: ${RETRIES}" >&2
  exit 2
fi

if ! [[ ${PORT} =~ ^[0-9]+$ ]]; then
  echo "Invalid --port value: ${PORT}" >&2
  exit 2
fi

if [[ -n ${BASE_OVERRIDE} ]]; then
  BASE=${BASE_OVERRIDE%/}
else
  if [[ ${HOST} == *://* ]]; then
    BASE=${HOST%/}
  elif [[ ${HOST} == \[* ]]; then
    BASE="http://${HOST}:${PORT}"
  elif [[ ${HOST} == *:* ]]; then
    BASE="http://${HOST}"
  else
    BASE="http://${HOST}:${PORT}"
  fi
fi

AUTH_HEADER=()
if [[ -n ${TOKEN} ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${TOKEN}")
fi

CURL_BIN=${CURL:-curl}

error() {
  printf 'audioctl: %s\n' "$*" >&2
}

json_escape() {
  local s=${1-}
  s=${s//\/\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  s=${s//$'\b'/\\b}
  s=${s//$'\f'/\\f}
  printf '%s' "$s"
}

is_json() {
  local trimmed
  trimmed=$(printf '%s' "$1" | sed -e 's/^[[:space:]]*//')
  [[ $trimmed == \{* || $trimmed == \[* ]]
}

print_json() {
  local payload=$1
  if [[ ${JSON_OUTPUT} -eq 1 ]]; then
    printf '%s\n' "$payload"
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$payload" | jq .
  else
    printf '%s\n' "$payload"
  fi
}

map_http_status() {
  local status=${1:-0}
  if (( status >= 200 && status < 300 )); then
    printf '0'
  elif (( status >= 400 && status < 500 )); then
    printf '4'
  elif (( status >= 500 && status < 600 )); then
    printf '5'
  elif (( status >= 300 && status < 400 )); then
    printf '3'
  elif (( status >= 100 && status < 200 )); then
    printf '1'
  else
    printf '1'
  fi
}

http_reason_phrase() {
  case $1 in
    200) printf 'OK' ;;
    201) printf 'Created' ;;
    202) printf 'Accepted' ;;
    204) printf 'No Content' ;;
    301) printf 'Moved Permanently' ;;
    302) printf 'Found' ;;
    304) printf 'Not Modified' ;;
    400) printf 'Bad Request' ;;
    401) printf 'Unauthorized' ;;
    403) printf 'Forbidden' ;;
    404) printf 'Not Found' ;;
    409) printf 'Conflict' ;;
    422) printf 'Unprocessable Entity' ;;
    429) printf 'Too Many Requests' ;;
    500) printf 'Internal Server Error' ;;
    502) printf 'Bad Gateway' ;;
    503) printf 'Service Unavailable' ;;
    504) printf 'Gateway Timeout' ;;
    *) return 1 ;;
  esac
}

HTTP_BODY=""
HTTP_STATUS=0
HTTP_ERROR=""
HTTP_SUCCESS=0

perform_request() {
  local method=$1
  local path=$2
  local is_get=$3
  shift 3
  local -a extra_args=("$@")
  local url="${BASE}${path}"
  local attempt=0
  local max_attempts=1
  if (( is_get )); then
    max_attempts=$(( RETRIES + 1 ))
    if (( max_attempts <= 0 )); then
      max_attempts=1
    fi
  fi

  HTTP_BODY=""
  HTTP_STATUS=0
  HTTP_ERROR=""
  HTTP_SUCCESS=0

  local tmp
  tmp=$(mktemp)
  local status
  local curl_exit

  while (( attempt < max_attempts )); do
    attempt=$(( attempt + 1 ))
    status=""
    curl_exit=0
    set +e
    status=$("${CURL_BIN}" -sS --max-time "${TIMEOUT}" --connect-timeout "${TIMEOUT}" -w '%{http_code}' -o "${tmp}" -X "${method}" "${AUTH_HEADER[@]}" "${extra_args[@]}" "${url}")
    curl_exit=$?
    set -e
    if [[ -f ${tmp} ]]; then
      HTTP_BODY=$(cat "${tmp}")
    else
      HTTP_BODY=""
    fi
    if (( curl_exit != 0 )); then
      HTTP_ERROR="curl error (exit ${curl_exit}) contacting ${url}"
      HTTP_STATUS=0
      HTTP_SUCCESS=0
      if (( ! is_get )); then
        break
      fi
    else
      HTTP_STATUS=${status//$'\n'/}
      HTTP_STATUS=${HTTP_STATUS//$'\r'/}
      if ! [[ ${HTTP_STATUS} =~ ^[0-9]+$ ]]; then
        HTTP_ERROR="unexpected HTTP status '${HTTP_STATUS}' from ${url}"
        HTTP_STATUS=0
        HTTP_SUCCESS=0
        if (( ! is_get )); then
          break
        fi
      elif (( HTTP_STATUS >= 200 && HTTP_STATUS < 300 )); then
        HTTP_SUCCESS=1
        break
      elif (( is_get )) && (( HTTP_STATUS >= 500 )); then
        HTTP_SUCCESS=0
        HTTP_ERROR=""
      else
        HTTP_SUCCESS=0
        break
      fi
    fi
    if (( attempt < max_attempts )); then
      sleep 1
    fi
  done

  rm -f "${tmp}"
  [[ ${HTTP_SUCCESS} -eq 1 ]]
}

finalize_request() {
  local expect_json=$1
  local mode=${2:-body}
  local exit_code=0

  if (( HTTP_SUCCESS )); then
    case ${mode} in
      metrics)
        if [[ -n ${HTTP_BODY} ]]; then
          printf '%s\n' "${HTTP_BODY}" | head -n 20
        fi
        ;;
      body|raw)
        if (( expect_json )) && is_json "${HTTP_BODY}"; then
          print_json "${HTTP_BODY}"
        else
          printf '%s\n' "${HTTP_BODY}"
        fi
        ;;
      silent)
        ;;
      *)
        printf '%s\n' "${HTTP_BODY}"
        ;;
    esac
    return 0
  fi

  if [[ -n ${HTTP_ERROR} ]]; then
    error "${HTTP_ERROR}"
    return 7
  fi

  local reason
  if reason=$(http_reason_phrase "${HTTP_STATUS}"); then
    error "HTTP ${HTTP_STATUS} ${reason}"
  else
    error "HTTP ${HTTP_STATUS}"
  fi

  if [[ -n ${HTTP_BODY} ]]; then
    if (( expect_json )) && is_json "${HTTP_BODY}"; then
      if [[ ${JSON_OUTPUT} -eq 1 ]]; then
        printf '%s\n' "${HTTP_BODY}" >&2
      elif command -v jq >/dev/null 2>&1; then
        printf '%s\n' "${HTTP_BODY}" | jq . >&2
      else
        printf '%s\n' "${HTTP_BODY}" >&2
      fi
    else
      printf '%s\n' "${HTTP_BODY}" >&2
    fi
  fi

  exit_code=$(map_http_status "${HTTP_STATUS}")
  return "${exit_code}"
}

execute_request() {
  local expect_json=$1
  local mode=$2
  local method=$3
  local path=$4
  local is_get=$5
  shift 5
  perform_request "${method}" "${path}" "${is_get}" "$@" || true
  finalize_request "${expect_json}" "${mode}"
  return $?
}

run_and_exit() {
  local expect_json=$1
  local mode=$2
  shift 2
  if execute_request "${expect_json}" "${mode}" "$@"; then
    exit 0
  else
    local rc=$?
    exit "${rc}"
  fi
}

validate_volume() {
  local value=$1
  if ! [[ ${value} =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    error "volume must be numeric (0.0-2.0)"
    exit 2
  fi
  if ! awk -v v="${value}" 'BEGIN { exit (v >= 0.0 && v <= 2.0) ? 0 : 1 }'; then
    error "volume must be between 0.0 and 2.0"
    exit 2
  fi
}

CMD=${1:-}
if [[ -z ${CMD} ]]; then
  usage >&2
  exit 2
fi
shift || true

case ${CMD} in
  status)
    run_and_exit 1 body "GET" "/status" 1
    ;;
  config)
    run_and_exit 1 body "GET" "/config" 1
    ;;
  health)
    run_and_exit 0 body "GET" "/healthz" 1
    ;;
  metrics)
    run_and_exit 0 metrics "GET" "/metrics" 1
    ;;
  volume)
    value=${1:-}
    if [[ -z ${value} ]]; then
      error "volume requires a value"
      exit 2
    fi
    validate_volume "${value}"
    payload="{\"volume\":${value}}"
    run_and_exit 1 body "POST" "/volume" 0 -H 'Content-Type: application/json' --data "${payload}"
    ;;
  play)
    src=${1:-stream}
    case ${src} in
      stream|file) ;;
      *)
        error "play source must be 'stream' or 'file'"
        exit 2
        ;;
    esac
    escaped=$(json_escape "${src}")
    payload="{\"source\":\"${escaped}\"}"
    run_and_exit 1 body "POST" "/play" 0 -H 'Content-Type: application/json' --data "${payload}"
    ;;
  stop)
    run_and_exit 1 body "POST" "/stop" 0
    ;;
  set-url)
    url=${1:-}
    if [[ -z ${url} ]]; then
      error "set-url requires a URL"
      exit 2
    fi
    escaped=$(json_escape "${url}")
    payload="{\"stream_url\":\"${escaped}\"}"
    run_and_exit 1 body "PUT" "/config" 0 -H 'Content-Type: application/json' --data "${payload}"
    ;;
  upload)
    file=${1:-}
    if [[ -z ${file} ]]; then
      error "upload requires a file path"
      exit 2
    fi
    if [[ ! -f ${file} ]]; then
      error "file not found: ${file}"
      exit 2
    fi
    run_and_exit 1 body "POST" "/upload" 0 -F "file=@${file}"
    ;;
  mode)
    mode_value=${1:-}
    case ${mode_value} in
      auto|manual) ;;
      *)
        error "mode must be 'auto' or 'manual'"
        exit 2
        ;;
    esac
    escaped=$(json_escape "${mode_value}")
    payload="{\"mode\":\"${escaped}\"}"
    run_and_exit 1 body "PUT" "/config" 0 -H 'Content-Type: application/json' --data "${payload}"
    ;;
  source)
    source_value=${1:-}
    case ${source_value} in
      stream|file|stop) ;;
      *)
        error "source must be 'stream', 'file', or 'stop'"
        exit 2
        ;;
    esac
    escaped=$(json_escape "${source_value}")
    payload="{\"source\":\"${escaped}\"}"
    run_and_exit 1 body "PUT" "/config" 0 -H 'Content-Type: application/json' --data "${payload}"
    ;;
  *)
    error "Unknown command: ${CMD}"
    usage >&2
    exit 2
    ;;
esac