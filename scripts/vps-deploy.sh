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

FLEET_API_IMAGE=${FLEET_API_IMAGE:-}
FLEET_UI_IMAGE=${FLEET_UI_IMAGE:-}
FLEET_WORKER_IMAGE=${FLEET_WORKER_IMAGE:-${FLEET_API_IMAGE}}
FLEET_RELEASE_SHA=${FLEET_RELEASE_SHA:-unknown}

if [[ -z "${FLEET_API_IMAGE}" || -z "${FLEET_UI_IMAGE}" ]]; then
  log "FLEET_API_IMAGE and FLEET_UI_IMAGE must be provided"
  exit 1
fi

mkdir -p "${STATE_DIR}"
ATTEMPT_ENV="${STATE_DIR}/current-attempt.env"
LAST_SUCCESS="${STATE_DIR}/last-successful.env"
PREVIOUS_SUCCESS="${STATE_DIR}/previous-successful.env"
ACCEPTANCE_LOG="${STATE_DIR}/last-acceptance.log"
HISTORY_FILE="${STATE_DIR}/history.log"

if [[ -f "${LAST_SUCCESS}" ]]; then
  cp "${LAST_SUCCESS}" "${PREVIOUS_SUCCESS}"
fi

cat >"${ATTEMPT_ENV}" <<EOF_ENV
FLEET_API_IMAGE=${FLEET_API_IMAGE}
FLEET_WORKER_IMAGE=${FLEET_WORKER_IMAGE}
FLEET_UI_IMAGE=${FLEET_UI_IMAGE}
FLEET_RELEASE_SHA=${FLEET_RELEASE_SHA}
ACCEPTANCE_HOSTS=${ACCEPTANCE_HOSTS:-}
ACCEPTANCE_SSH_USER=${ACCEPTANCE_SSH_USER:-}
ICECAST_URL=${ICECAST_URL:-}
AUDIOCTL_TOKEN=${AUDIOCTL_TOKEN:-}
EOF_ENV

set -a
# shellcheck disable=SC1090
source "${ATTEMPT_ENV}"
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
        *)
          ;; # keep waiting
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

rollback() {
  if [[ ! -f "${PREVIOUS_SUCCESS}" ]]; then
    log "No previous successful deployment found; cannot rollback" >&2
    return 1
  fi
  log "Attempting rollback to previous successful deployment"
  local rollback_env="${STATE_DIR}/rollback.env"
  cp "${PREVIOUS_SUCCESS}" "${rollback_env}"
  set -a
  # shellcheck disable=SC1090
  source "${rollback_env}"
  set +a
  if ! compose up -d --remove-orphans; then
    log "docker compose up failed during rollback" >&2
    return 1
  fi
  if ! wait_for_health; then
    log "Rollback failed: services did not become healthy" >&2
    return 1
  fi
  if ! run_acceptance; then
    log "Rollback acceptance checks failed" >&2
    return 1
  fi
  cp "${rollback_env}" "${LAST_SUCCESS}"
  cp "${ATTEMPT_ENV}" "${PREVIOUS_SUCCESS}" 2>/dev/null || true
  log "Rollback completed successfully"
  return 0
}

cleanup() {
  local status=$?
  if (( status != 0 )); then
    log "Deployment failed with status ${status}"
    if (( ROLLBACK_REQUIRED )); then
      if rollback; then
        log "Rollback executed after failure"
      else
        log "Rollback failed or unavailable" >&2
      fi
    fi
  fi
}

trap cleanup EXIT

ROLLBACK_REQUIRED=1

log "Pulling images for compose project ${PROJECT_NAME}"
compose pull

log "Applying compose stack"
compose up -d --remove-orphans

wait_for_health

if run_acceptance; then
  log "Deployment checks complete"
else
  log "Deployment acceptance checks failed" >&2
  exit 1
fi

ROLLBACK_REQUIRED=0
cp "${ATTEMPT_ENV}" "${LAST_SUCCESS}"
if [[ -n "${FLEET_RELEASE_SHA}" ]]; then
  printf '%s %s\n' "${FLEET_RELEASE_SHA}" "$(date '+%Y-%m-%dT%H:%M:%S%z')" >> "${HISTORY_FILE}"
fi

log "Deployment finished successfully"
