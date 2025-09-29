#!/usr/bin/env bash
set -euo pipefail

# VPS Rollback Script - restore previous working deployment

log() {
  local ts level="INFO"
  [[ $# -gt 1 ]] && level="$1" && shift
  ts=$(date '+%Y-%m-%dT%H:%M:%S%z')
  printf '[%s] [%s] %s\n' "$ts" "$level" "$*" >&2
}

error() {
  log "ERROR" "$@"
  return 1
}

# Configuration
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_DIR="${ROOT_DIR}/infra/vps"
COMPOSE_FILE="compose.fleet.yml"
PROJECT_NAME="fleet"
STATE_DIR="${ROOT_DIR}/.deploy"

# Validate we have a successful deployment to rollback to
SUCCESS_STATE="${STATE_DIR}/last-successful-deployment.json"
if [[ ! -f "${SUCCESS_STATE}" ]]; then
  error "No previous successful deployment found. Cannot rollback."
fi

log "Loading previous successful deployment state..."
if ! ROLLBACK_DATA=$(cat "${SUCCESS_STATE}"); then
  error "Could not read rollback state file"
fi

# Extract deployment info (using simple grep since jq might not be available)
ROLLBACK_SHA=$(echo "${ROLLBACK_DATA}" | grep '"release_sha"' | cut -d'"' -f4 || echo "unknown")
ROLLBACK_API_IMAGE=$(echo "${ROLLBACK_DATA}" | grep '"api_image"' | cut -d'"' -f4)
ROLLBACK_UI_IMAGE=$(echo "${ROLLBACK_DATA}" | grep '"ui_image"' | cut -d'"' -f4)
ROLLBACK_WORKER_IMAGE=$(echo "${ROLLBACK_DATA}" | grep '"worker_image"' | cut -d'"' -f4)

log "Rollback target:"
log "  SHA: ${ROLLBACK_SHA}"
log "  API: ${ROLLBACK_API_IMAGE}"
log "  UI: ${ROLLBACK_UI_IMAGE}"
log "  Worker: ${ROLLBACK_WORKER_IMAGE}"

if [[ -z "${ROLLBACK_API_IMAGE}" || -z "${ROLLBACK_UI_IMAGE}" ]]; then
  error "Rollback state is incomplete. Cannot proceed."
fi

# Confirm rollback
echo ""
read -p "Proceed with rollback to ${ROLLBACK_SHA}? (y/N): " -n 1 -r
echo
if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then
  log "Rollback cancelled by user"
  exit 0
fi

# Set environment for rollback
export FLEET_API_IMAGE="${ROLLBACK_API_IMAGE}"
export FLEET_UI_IMAGE="${ROLLBACK_UI_IMAGE}"
export FLEET_WORKER_IMAGE="${ROLLBACK_WORKER_IMAGE}"
export FLEET_RELEASE_SHA="${ROLLBACK_SHA}"

# Compose wrapper
compose() {
  cd "${COMPOSE_DIR}" || error "Failed to change to compose directory"
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" "$@"
}

log "Starting rollback deployment..."
if ! compose up -d --remove-orphans; then
  error "Rollback deployment failed"
fi

log "Waiting for services to start..."
sleep 15

log "Checking rollback status..."
compose ps

# Quick verification
if curl -fsS --max-time 10 "http://127.0.0.1:3006/" >/dev/null; then
  log "Rollback completed successfully"
  log "UI is responding at http://127.0.0.1:3006/"
else
  error "Rollback verification failed - UI not responding"
fi

log "Rollback complete. Previous working version restored."