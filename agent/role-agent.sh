#!/usr/bin/env bash
set -euo pipefail

# Make repo safe for git operations when ownership differs
git config --system --add safe.directory /opt/fleet 2>/dev/null || true

ROLE=""
REPO_DIR="/opt/fleet"
AGE_KEY_FILE="/etc/fleet/age.key"

# Ensure required commands exist
for cmd in git docker jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found"
    exit 1
  fi
done

# Determine role from inventory/devices.yaml by hostname
HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "${ROLE}" ]]; then
  echo "ERROR: Role not found for hostname ${HOSTNAME_ACTUAL} in inventory/devices.yaml"
  exit 1
fi

# Update repo
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch --depth 1 origin main
  git -C "$REPO_DIR" reset --hard origin/main
else
  echo "ERROR: Repo not found at $REPO_DIR"
  exit 1
fi

# Ensure Claude Code CLI and MCP servers are present
SETUP_CLAUDE="$REPO_DIR/agent/setup-claude-tools.sh"
if [[ -x "$SETUP_CLAUDE" ]]; then
  if ! "$SETUP_CLAUDE"; then
    echo "WARNING: setup-claude-tools failed; continuing" >&2
  fi
fi

# Decrypt role env if present
ENC_ENV="$REPO_DIR/roles/$ROLE/.env.sops.enc"
if [[ -f "$ENC_ENV" ]]; then
  if ! command -v sops >/dev/null 2>&1; then
    echo "ERROR: required command 'sops' not found for env decryption"
    exit 1
  fi
  if [[ ! -f "$AGE_KEY_FILE" ]]; then
    echo "ERROR: AGE key not found at $AGE_KEY_FILE"
    exit 1
  fi
  export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"
  TMP_ENV="/run/${ROLE}.env"
  sops --decrypt "$ENC_ENV" > "$TMP_ENV"
  set -a
  # shellcheck source=/dev/null
  source "$TMP_ENV"
  set +a
  rm -f "$TMP_ENV"
fi

# Compose files (baseline + role, with lexical mix-ins if present)
BASE="$REPO_DIR/baseline/docker-compose.yml"
ROLE_DIR="$REPO_DIR/roles/$ROLE"
readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '*.yml' | sort)

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
PROJECT="${ROLE}_${COMMIT}"

COMPOSE_FILES=("-f" "$BASE")
for f in "${ROLE_OVERRIDES[@]}"; do
  COMPOSE_FILES+=("-f" "$f")
done

# Proactively stop and remove any old projects for this role (avoid port conflicts)
mapfile -t OLD_PROJECTS_PRE < <(docker compose ls --format json | jq -r '.[] | .Name' | grep "^${ROLE}_" || true)
for OLD in "${OLD_PROJECTS_PRE[@]}"; do
  if [[ "$OLD" != "$PROJECT" ]]; then
    docker compose -p "$OLD" down --volumes || true
  fi
done

# Optional env-file support from repo root
DOCKER_ARGS=()
if [[ -f "/opt/fleet/.env" ]]; then
  DOCKER_ARGS+=("--env-file" "/opt/fleet/.env")
fi

docker compose "${DOCKER_ARGS[@]}" -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

# Cleanup old projects for same role
mapfile -t OLD_PROJECTS < <(docker compose ls --format json | jq -r '.[] | .Name' | grep "^${ROLE}_" | grep -v "$PROJECT" || true)
for OLD in "${OLD_PROJECTS[@]}"; do
  docker compose -p "$OLD" down --volumes || true
done

echo "Converged role=$ROLE project=$PROJECT"

# Reclaim space: remove dangling images (old commit builds)
docker image prune -f >/dev/null 2>&1 || true

exit 0
