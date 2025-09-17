#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"
STATE_DIR="/run/fleet"
LOCK_FILE="$STATE_DIR/role-agent.lock"
MAX_FAILURES=${ROLE_AGENT_HEALTH_MAX_FAILURES:-3}
STATE_FILE="$STATE_DIR/role-agent-health.failcount"

mkdir -p "$STATE_DIR"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  exit 0
fi

for cmd in git docker jq find hostname awk logger systemctl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "role-agent-healthcheck: required command '$cmd' missing" >&2
    exit 1
  fi
done

HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "$ROLE" ]]; then
  logger -t role-agent-health "no role mapping for host ${HOSTNAME_ACTUAL}; skipping"
  exit 0
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  logger -t role-agent-health "repo missing at $REPO_DIR"
  exit 1
fi

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
PROJECT="${ROLE}_${COMMIT}"

mapfile -t CONTAINERS < <(docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.ID}} {{.Names}}')

if [[ "${#CONTAINERS[@]}" -eq 0 ]]; then
  rm -f "$STATE_FILE"
  exit 0
fi

UNHEALTHY=()
for entry in "${CONTAINERS[@]}"; do
  CID=${entry%% *}
  CNAME=${entry#* }
  INFO=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CID")
  STATUS=$(cut -d' ' -f1 <<<"$INFO")
  HEALTH=$(cut -d' ' -f2 <<<"$INFO")
  EFFECTIVE="$STATUS"
  if [[ "$HEALTH" != "none" ]]; then
    EFFECTIVE="$HEALTH"
  fi
  case "$EFFECTIVE" in
    healthy|running|starting)
      continue
      ;;
    *)
      UNHEALTHY+=("$CNAME:$EFFECTIVE")
      ;;
  esac
done

if [[ "${#UNHEALTHY[@]}" -eq 0 ]]; then
  rm -f "$STATE_FILE"
  exit 0
fi

FAIL_COUNT=0
if [[ -f "$STATE_FILE" ]]; then
  FAIL_COUNT=$(<"$STATE_FILE")
fi
FAIL_COUNT=$((FAIL_COUNT + 1))
echo "$FAIL_COUNT" > "$STATE_FILE"

logger -t role-agent-health "detected unhealthy containers: ${UNHEALTHY[*]} (attempt ${FAIL_COUNT}/${MAX_FAILURES})"

if (( FAIL_COUNT < MAX_FAILURES )); then
  exit 0
fi

rm -f "$STATE_FILE"

BASE="$REPO_DIR/baseline/docker-compose.yml"
ROLE_DIR="$REPO_DIR/roles/$ROLE"
readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '*.yml' | sort)

COMPOSE_FILES=("-f" "$BASE")
for f in "${ROLE_OVERRIDES[@]}"; do
  COMPOSE_FILES+=("-f" "$f")
done

DOCKER_ARGS=()
if [[ -f "$REPO_DIR/.env" ]]; then
  DOCKER_ARGS+=("--env-file" "$REPO_DIR/.env")
fi

LOCK_FILE_COMPOSE="$STATE_DIR/compose.lock"
exec 201>"$LOCK_FILE_COMPOSE"
flock 201

logger -t role-agent-health "recreating compose project $PROJECT"

docker compose "${DOCKER_ARGS[@]}" -p "$PROJECT" "${COMPOSE_FILES[@]}" down --remove-orphans || true

docker compose "${DOCKER_ARGS[@]}" -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

exit 0
