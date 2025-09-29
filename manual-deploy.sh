#!/usr/bin/env bash
set -euo pipefail

# Manual deployment script to fix path issues
COMMIT_SHA="4295e61e55ec342c719cb7680326ce3bfd6d98ec"
API_IMAGE="fleet-api:local"
UI_IMAGE="fleet-ui:local"
COMPOSE_DIR="/home/admin/fleet/infra/vps"
COMPOSE_FILE="compose.fleet.yml"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting manual deployment of commit ${COMMIT_SHA}"

# Set environment variables for compose
export FLEET_API_IMAGE="${API_IMAGE}"
export FLEET_UI_IMAGE="${UI_IMAGE}"
export FLEET_WORKER_IMAGE="${API_IMAGE}"
export FLEET_RELEASE_SHA="${COMMIT_SHA}"

log "Images to deploy:"
log "  API: ${API_IMAGE}"
log "  UI: ${UI_IMAGE}"
log "  Worker: ${API_IMAGE}"

# Change to compose directory
cd "${COMPOSE_DIR}"

log "Pulling images..."
docker compose -f "${COMPOSE_FILE}" pull

log "Checking current running containers..."
docker compose -f "${COMPOSE_FILE}" ps

log "Deploying updated stack..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

log "Waiting for services to start..."
sleep 10

log "Checking service status..."
docker compose -f "${COMPOSE_FILE}" ps

log "Checking fleet-ui logs..."
docker compose -f "${COMPOSE_FILE}" logs --tail=20 fleet-ui

log "Manual deployment completed!"