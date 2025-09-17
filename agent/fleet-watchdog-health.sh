#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"

log_warn() {
  logger -t fleet-watchdog-health "$1" || echo "$1" >&2
}

if ! command -v systemctl >/dev/null 2>&1; then
  log_warn "systemctl unavailable"
  exit 0
fi

if ! systemctl is-active --quiet docker.service; then
  log_warn "docker.service inactive"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log_warn "docker binary missing"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log_warn "docker daemon not responding"
  exit 0
fi

HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" 2>/dev/null | tr -d '[:space:]')

if [[ -z "$ROLE" ]]; then
  log_warn "role mapping missing"
  exit 0
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log_warn "repo missing at $REPO_DIR"
  exit 0
fi

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || true)
if [[ -z "$COMMIT" ]]; then
  log_warn "unable to determine current commit"
  exit 0
fi
PROJECT="${ROLE}_${COMMIT}"

CONTAINERS=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.ID}}')
if [[ -z "$CONTAINERS" ]]; then
  exit 0
fi

while read -r cid; do
  [[ -z "$cid" ]] && continue
  info=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo "unknown none")
  status=${info%% *}
  health=${info##* }
  effective="$status"
  if [[ "$health" != "none" ]]; then
    effective="$health"
  fi
  case "$effective" in
    healthy|running|starting)
      :
      ;;
    *)
      log_warn "container $cid unhealthy ($effective)"
      exit 1
      ;;
  esac
  if [[ "$status" != "running" ]]; then
    log_warn "container $cid not running ($status)"
    exit 1
  fi
done <<<"$CONTAINERS"

exit 0