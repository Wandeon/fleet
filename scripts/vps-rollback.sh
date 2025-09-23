#!/usr/bin/env bash
set -euo pipefail

log() {
  local ts
  ts=$(date '+%Y-%m-%dT%H:%M:%S%z')
  printf '[%s] %s\n' "$ts" "$*"
}

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_DIR=${COMPOSE_DIR:-${ROOT_DIR}/vps}
COMPOSE_FILE=${COMPOSE_FILE:-compose.fleet.yml}
PROJECT_NAME=${COMPOSE_PROJECT_NAME:-fleet}
STATE_DIR=${STATE_DIR:-${ROOT_DIR}/.deploy}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-300}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-5}

LAST_SUCCESS="${STATE_DIR}/last-successful.env"
PREVIOUS_SUCCESS="${STATE_DIR}/previous-successful.env"
ROLLBACK_TARGET="${STATE_DIR}/rollback-target.env"
CURRENT_COPY="${STATE_DIR}/rollback-from.env"
ACCEPTANCE_LOG="${STATE_DIR}/last-acceptance.log"
HISTORY_FILE="${STATE_DIR}/history.log"

if [[ ! -f "${PREVIOUS_SUCCESS}" ]]; then
  log "No previous successful deployment recorded. Nothing to rollback to."
  exit 1
fi

if [[ -f "${LAST_SUCCESS}" ]]; then
  cp "${LAST_SUCCESS}" "${CURRENT_COPY}"
fi

cp "${PREVIOUS_SUCCESS}" "${ROLLBACK_TARGET}"

set -a
# shellcheck disable=SC1090
source "${ROLLBACK_TARGET}"
set +a

compose() {
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_DIR}/${COMPOSE_FILE}" "$@"
}

wait_for_health() {
  local services=()
  mapfile -t services < <(compose ps --services)
  if [[ ${#services[@]} -eq 0 ]]; then
    log "No services defined in compose configuration"
    return 0
  fi
  local service
  for service in "${services[@]}"; do
    log "Waiting for ${service} to report healthy"
    local deadline=$((SECONDS + HEALTH_TIMEOUT))
    while (( SECONDS < deadline )); do
      local cid
      cid=$(compose ps -q "${service}" || true)
      if [[ -z "${cid}" ]]; then
        sleep "${HEALTH_INTERVAL}"
        continue
      fi
      local health
      health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${cid}" 2>/dev/null || echo "unknown")
      case "${health}" in
        healthy|running)
          log "${service} is ${health}"
          break
          ;;
        exited|dead|unhealthy)
          log "${service} entered ${health} state" >&2
          return 1
          ;;
      esac
      sleep "${HEALTH_INTERVAL}"
    done
    if (( SECONDS >= deadline )); then
      log "Timed out waiting for ${service}" >&2
      return 1
    fi
  done
}

parse_acceptance_hosts() {
  local hosts_raw=${ACCEPTANCE_HOSTS:-}
  local tokens=()
  local parsed=()
  if [[ -n "${hosts_raw}" ]]; then
    IFS=$' \n,\t' read -r -a tokens <<<"${hosts_raw}"
    for host in "${tokens[@]}"; do
      [[ -z "${host}" ]] && continue
      parsed+=("${host}")
    done
  fi
  printf '%s\n' "${parsed[@]}"
}

run_acceptance() {
  local script="${ROOT_DIR}/scripts/acceptance.sh"
  if [[ ! -x "${script}" ]]; then
    log "Acceptance script not found at ${script}"
    return 1
  fi
  mapfile -t hosts < <(parse_acceptance_hosts)
  if [[ ${#hosts[@]} -eq 0 ]]; then
    log "ACCEPTANCE_HOSTS not provided; skipping acceptance checks"
    return 0
  fi
  log "Running acceptance smoke tests for hosts: ${hosts[*]}"
  if ICECAST_URL="${ICECAST_URL:-}" SSH_USER="${ACCEPTANCE_SSH_USER:-admin}" AUDIOCTL_TOKEN="${AUDIOCTL_TOKEN:-}" "${script}" "${hosts[@]}" | tee "${ACCEPTANCE_LOG}"; then
    log "Acceptance checks succeeded"
    return 0
  fi
  log "Acceptance checks failed" >&2
  return 1
}

log "Rolling back compose project ${PROJECT_NAME}"
compose pull
compose up -d --remove-orphans

wait_for_health
run_acceptance

cp "${ROLLBACK_TARGET}" "${LAST_SUCCESS}"
if [[ -f "${CURRENT_COPY}" ]]; then
  cp "${CURRENT_COPY}" "${PREVIOUS_SUCCESS}"
fi

if [[ -n "${FLEET_RELEASE_SHA:-}" ]]; then
  printf 'rollback-to %s %s\n' "${FLEET_RELEASE_SHA}" "$(date '+%Y-%m-%dT%H:%M:%S%z')" >> "${HISTORY_FILE}"
fi

log "Rollback completed"
