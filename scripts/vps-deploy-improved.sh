#!/usr/bin/env bash
set -euo pipefail

# Improved VPS deployment script with guardrails
# Addresses issues found in deployment failure analysis

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

warn() {
  log "WARN" "$@"
}

# Configuration
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_DIR="${ROOT_DIR}/infra/vps"  # Fixed path issue
COMPOSE_FILE="compose.fleet.yml"
PROJECT_NAME="fleet"
STATE_DIR="${ROOT_DIR}/.deploy"
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-300}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-10}

# Environment validation
FLEET_API_IMAGE=${FLEET_API_IMAGE:-}
FLEET_UI_IMAGE=${FLEET_UI_IMAGE:-}
FLEET_WORKER_IMAGE=${FLEET_WORKER_IMAGE:-${FLEET_API_IMAGE}}
FLEET_RELEASE_SHA=${FLEET_RELEASE_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}

# Validate required parameters
if [[ -z "${FLEET_API_IMAGE}" || -z "${FLEET_UI_IMAGE}" ]]; then
  error "FLEET_API_IMAGE and FLEET_UI_IMAGE must be provided"
fi

# Ensure deployment state directory exists
mkdir -p "${STATE_DIR}"

log "Starting deployment process"
log "API Image: ${FLEET_API_IMAGE}"
log "UI Image: ${FLEET_UI_IMAGE}"
log "Worker Image: ${FLEET_WORKER_IMAGE}"
log "Release SHA: ${FLEET_RELEASE_SHA}"

# Validate compose file exists
if [[ ! -f "${COMPOSE_DIR}/${COMPOSE_FILE}" ]]; then
  error "Compose file not found: ${COMPOSE_DIR}/${COMPOSE_FILE}"
fi

# Validate environment file
ENV_FILE="${ROOT_DIR}/vps/fleet.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  warn "Environment file not found at ${ENV_FILE}, will use compose defaults"
fi

# Save deployment state
DEPLOYMENT_STATE="${STATE_DIR}/deployment-$(date +%s).json"
cat > "${DEPLOYMENT_STATE}" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "release_sha": "${FLEET_RELEASE_SHA}",
  "api_image": "${FLEET_API_IMAGE}",
  "ui_image": "${FLEET_UI_IMAGE}",
  "worker_image": "${FLEET_WORKER_IMAGE}",
  "compose_dir": "${COMPOSE_DIR}",
  "compose_file": "${COMPOSE_FILE}"
}
EOF

log "Deployment state saved: ${DEPLOYMENT_STATE}"

# Compose wrapper function
compose() {
  cd "${COMPOSE_DIR}" || error "Failed to change to compose directory"
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" "$@"
}

# Pre-deployment health check
log "Performing pre-deployment checks..."

# Check if images exist locally or can be pulled
check_image() {
  local image="$1"
  log "Checking image availability: ${image}"

  if docker image inspect "${image}" >/dev/null 2>&1; then
    log "Image available locally: ${image}"
    return 0
  fi

  log "Attempting to pull image: ${image}"
  if docker pull "${image}" 2>/dev/null; then
    log "Successfully pulled image: ${image}"
    return 0
  fi

  warn "Image not available: ${image}"
  return 1
}

# Check all required images
IMAGES_OK=true
for image in "${FLEET_API_IMAGE}" "${FLEET_UI_IMAGE}" "${FLEET_WORKER_IMAGE}"; do
  if ! check_image "${image}"; then
    IMAGES_OK=false
  fi
done

if [[ "${IMAGES_OK}" != "true" ]]; then
  error "Some required images are not available. Aborting deployment."
fi

# Save current running containers for rollback
log "Saving current state for potential rollback..."
CURRENT_STATE="${STATE_DIR}/pre-deployment-state.json"
{
  echo "{"
  echo "  \"containers\": ["
  compose ps --format json 2>/dev/null | sed 's/$/,/' | sed '$ s/,$//'
  echo "  ],"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
  echo "}"
} > "${CURRENT_STATE}" || warn "Could not save current state"

# Set environment variables for compose
export FLEET_API_IMAGE FLEET_UI_IMAGE FLEET_WORKER_IMAGE FLEET_RELEASE_SHA

log "Deploying services..."
if ! compose up -d --remove-orphans; then
  error "Docker compose deployment failed"
fi

# Wait for services to be healthy
log "Waiting for services to become healthy..."
wait_for_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))

  while (( SECONDS < deadline )); do
    local all_healthy=true
    local services

    # Get list of services
    if ! services=$(compose ps --services 2>/dev/null); then
      warn "Could not get service list"
      sleep "${HEALTH_INTERVAL}"
      continue
    fi

    # Check each service
    while IFS= read -r service; do
      [[ -z "${service}" ]] && continue

      local container_id
      if ! container_id=$(compose ps -q "${service}" 2>/dev/null); then
        warn "Service ${service} not found"
        all_healthy=false
        continue
      fi

      if [[ -z "${container_id}" ]]; then
        warn "Service ${service} has no container"
        all_healthy=false
        continue
      fi

      local health_status
      health_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || echo "unknown")

      case "${health_status}" in
        healthy|running)
          log "Service ${service} is ${health_status}"
          ;;
        starting|unhealthy)
          log "Service ${service} is ${health_status}, waiting..."
          all_healthy=false
          ;;
        *)
          warn "Service ${service} has unexpected status: ${health_status}"
          all_healthy=false
          ;;
      esac
    done <<< "${services}"

    if [[ "${all_healthy}" == "true" ]]; then
      log "All services are healthy"
      break
    fi

    sleep "${HEALTH_INTERVAL}"
  done

  if (( SECONDS >= deadline )); then
    error "Timeout waiting for services to become healthy"
  fi
}

wait_for_health

# Post-deployment verification
log "Performing post-deployment verification..."

# Check UI endpoint
if ! curl -fsS --max-time 10 "http://127.0.0.1:3006/" >/dev/null; then
  error "UI endpoint verification failed"
fi

# Check API endpoint (if applicable)
if ! curl -fsS --max-time 10 "http://127.0.0.1:3005/healthz" >/dev/null 2>&1; then
  warn "API health endpoint not responding, but continuing..."
fi

# Save successful deployment record
SUCCESS_STATE="${STATE_DIR}/last-successful-deployment.json"
cp "${DEPLOYMENT_STATE}" "${SUCCESS_STATE}"

# Cleanup old deployment states (keep last 10)
find "${STATE_DIR}" -name "deployment-*.json" -type f | sort | head -n -10 | xargs rm -f 2>/dev/null || true

log "Deployment completed successfully!"
log "Release SHA: ${FLEET_RELEASE_SHA}"
log "Services status:"
compose ps

# Output final verification
log "Final verification:"
log "- UI available at: http://127.0.0.1:3006/"
log "- External URL: https://app.headspamartina.hr/"
log "- Deployment state: ${SUCCESS_STATE}"