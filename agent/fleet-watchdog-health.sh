#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"

for cmd in docker systemctl jq hostname awk git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "fleet-watchdog-health: required command '$cmd' missing" >&2
    exit 1
  fi
done

if ! systemctl is-active --quiet docker.service; then
  echo "fleet-watchdog-health: docker service inactive" >&2
  exit 1
fi

if ! systemctl is-active --quiet role-agent.timer; then
  echo "fleet-watchdog-health: role-agent.timer inactive" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "fleet-watchdog-health: docker daemon not responding" >&2
  exit 1
fi

HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "$ROLE" ]]; then
  echo "fleet-watchdog-health: role mapping missing" >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "fleet-watchdog-health: repo missing at $REPO_DIR" >&2
  exit 1
fi

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
PROJECT="${ROLE}_${COMMIT}"

CONTAINERS=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.ID}}')

if [[ -z "$CONTAINERS" ]]; then
  exit 0
fi

while read -r cid; do
  [[ -z "$cid" ]] && continue
  info=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
  status=${info%% *}
  health=${info##* }
  effective="$status"
  if [[ "$health" != "none" ]]; then
    effective="$health"
  fi
  case "$effective" in
    healthy|running|starting)
      ;;
    *)
      echo "fleet-watchdog-health: container $cid unhealthy ($effective)" >&2
      exit 1
      ;;
  esac
  if [[ "$status" != "running" ]]; then
    echo "fleet-watchdog-health: container $cid not running ($status)" >&2
    exit 1
  fi
done <<<"$CONTAINERS"

exit 0
