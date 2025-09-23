#!/usr/bin/env bash
# shellcheck shell=bash

_fleet_log_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"
}

_fleet_json_escape() {
  FLEET_ESCAPE_VALUE="$1" python3 - <<'PY'
import json
import os

value = os.environ.get('FLEET_ESCAPE_VALUE', '')
print(json.dumps(value)[1:-1])
PY
}

_fleet_is_numeric() {
  [[ "$1" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]
}

_fleet_as_json_value() {
  local value="$1"
  local numeric="$2"
  if [[ -z "$value" ]]; then
    printf 'null'
    return
  fi
  if [[ "$numeric" == "1" ]]; then
    printf '%s' "$value"
    return
  fi
  local escaped_value
  escaped_value=$(_fleet_json_escape "$value")
  printf '"%s"' "$escaped_value"
}

_fleet_log() {
  local level="$1"
  shift || true
  local message="$1"
  shift || true

  local ts=$(_fleet_log_timestamp)
  local service="${FLEET_LOG_SERVICE:-${LOG_SERVICE:-role-agent}}"
  local host="${FLEET_LOG_HOST:-${LOG_SOURCE_HOST:-$(hostname 2>/dev/null || echo unknown)}}"
  local role="${FLEET_LOG_ROLE:-${ROLE:-unknown}}"
  local commit="${FLEET_LOG_COMMIT:-${COMMIT:-unknown}}"
  local correlation="${FLEET_LOG_CORRELATION_ID:-}"
  local duration="${FLEET_LOG_DURATION_MS:-}"
  local error_code="${FLEET_LOG_ERROR_CODE:-}"

  local -a ordered_keys=()
  declare -A fields_json=()

  append_field() {
    local key="$1"
    local value="$2"
    if [[ -z ${fields_json[$key]+set} ]]; then
      ordered_keys+=("$key")
    fi
    fields_json[$key]="$value"
  }

  local escaped_ts
  escaped_ts=$(_fleet_json_escape "$ts")
  append_field "ts" "\"$escaped_ts\""

  local escaped_level
  escaped_level=$(_fleet_json_escape "$level")
  append_field "level" "\"$escaped_level\""

  local escaped_message
  escaped_message=$(_fleet_json_escape "$message")
  append_field "msg" "\"$escaped_message\""

  local escaped_service
  escaped_service=$(_fleet_json_escape "$service")
  append_field "service" "\"$escaped_service\""

  local escaped_host
  escaped_host=$(_fleet_json_escape "$host")
  append_field "host" "\"$escaped_host\""

  local escaped_role
  escaped_role=$(_fleet_json_escape "$role")
  append_field "role" "\"$escaped_role\""

  local escaped_commit
  escaped_commit=$(_fleet_json_escape "$commit")
  append_field "commit" "\"$escaped_commit\""

  local correlation_json
  correlation_json=$(_fleet_as_json_value "$correlation" 0)
  append_field "correlationId" "$correlation_json"

  local duration_numeric=0
  if _fleet_is_numeric "$duration"; then
    duration_numeric=1
  fi
  local duration_json
  duration_json=$(_fleet_as_json_value "$duration" "$duration_numeric")
  append_field "durationMs" "$duration_json"

  local error_json
  error_json=$(_fleet_as_json_value "$error_code" 0)
  append_field "errorCode" "$error_json"

  local kv
  for kv in "$@"; do
    if [[ "$kv" != *=* ]]; then
      continue
    fi
    local key=${kv%%=*}
    local value=${kv#*=}
    if [[ -z "$key" ]]; then
      continue
    fi
    local numeric_flag=0
    if _fleet_is_numeric "$value"; then
      numeric_flag=1
    fi
    local value_json
    value_json=$(_fleet_as_json_value "$value" "$numeric_flag")
    append_field "$key" "$value_json"
  done

  local json="{"
  local first=1
  local key
  for key in "${ordered_keys[@]}"; do
    local json_key
    json_key=$(_fleet_json_escape "$key")
    if (( first )); then
      first=0
    else
      json+="," 
    fi
    json+="\"$json_key\":${fields_json[$key]}"
  done
  json+="}"
  printf '%s\n' "$json"
}

log_info() {
  _fleet_log "info" "$@"
}

log_warn() {
  _fleet_log "warn" "$@"
}

log_error() {
  _fleet_log "error" "$@"
}

log_debug() {
  _fleet_log "debug" "$@"
}
