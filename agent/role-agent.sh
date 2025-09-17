#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"
STATE_DIR="/run/fleet"
LOCK_FILE="$STATE_DIR/role-agent.lock"
AGE_KEY_FILE="/etc/fleet/age.key"
ROLE=""

mkdir -p "$STATE_DIR"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "role-agent: another execution is already in progress" >&2
  exit 0
fi

# Make repo safe for git operations when ownership differs
git config --system --add safe.directory "$REPO_DIR" 2>/dev/null || true

# Ensure required commands exist
for cmd in git docker jq systemctl find install; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found" >&2
    exit 1
  fi
done

ensure_systemd_units() {
  local -a units=(
    role-agent.service
    role-agent.timer
    role-agent-watchdog.service
    role-agent-watchdog.timer
    role-agent-healthcheck.service
    role-agent-healthcheck.timer
  )
  local reload=0
  for unit in "${units[@]}"; do
    local src="$REPO_DIR/agent/$unit"
    local dest="/etc/systemd/system/$unit"
    if [[ ! -f "$src" ]]; then
      echo "WARNING: expected unit $unit missing in repo" >&2
      continue
    fi
    if [[ ! -f "$dest" ]] || ! cmp -s "$src" "$dest"; then
      install -D -m 0644 "$src" "$dest"
      reload=1
    fi
  done
  if (( reload )); then
    systemctl daemon-reload
  fi
  for timer in role-agent.timer role-agent-watchdog.timer role-agent-healthcheck.timer; do
    systemctl enable --now "$timer" >/dev/null 2>&1 || true
  done
}

compose_list_projects() {
  local output names
  if output=$(docker compose ls --format json 2>/dev/null); then
    if names=$(jq -r '.[] | .Name' <<<"$output" 2>/dev/null); then
      if [[ -n "$names" ]]; then
        printf '%s\n' "$names"
      fi
      return 0
    fi
  fi
  docker compose ls 2>/dev/null | awk 'NR>1 {print $1}' || true
  return 0
}

ensure_systemd_units

# Determine role from inventory/devices.yaml by hostname
HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "${ROLE}" ]]; then
  echo "ERROR: Role not found for hostname ${HOSTNAME_ACTUAL} in inventory/devices.yaml" >&2
  exit 1
fi

# Update repo
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch --depth 1 origin main
  git -C "$REPO_DIR" reset --hard origin/main
else
  echo "ERROR: Repo not found at $REPO_DIR" >&2
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
    echo "ERROR: required command 'sops' not found for env decryption" >&2
    exit 1
  fi
  if [[ ! -f "$AGE_KEY_FILE" ]]; then
    echo "ERROR: AGE key not found at $AGE_KEY_FILE" >&2
    exit 1
  fi
  export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"
  TMP_ENV="$STATE_DIR/${ROLE}.env"
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
readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '[0-9][0-9]-*.yml' | sort)

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
PROJECT="${ROLE}_${COMMIT}"

COMPOSE_FILES=("-f" "$BASE")
for f in "${ROLE_OVERRIDES[@]}"; do
  COMPOSE_FILES+=("-f" "$f")
done

# Proactively stop and remove any old projects for this role (avoid port conflicts)
mapfile -t OLD_PROJECTS_PRE < <(compose_list_projects | grep "^${ROLE}_" || true)
for OLD in "${OLD_PROJECTS_PRE[@]}"; do
  if [[ "$OLD" != "$PROJECT" ]]; then
    docker compose -p "$OLD" down --volumes || true
  fi
done

# Optional env-file support from repo root
DOCKER_ARGS=()
if [[ -f "$REPO_DIR/.env" ]]; then
  DOCKER_ARGS+=("--env-file" "$REPO_DIR/.env")
fi

LOCK_FILE_COMPOSE="$STATE_DIR/compose.lock"
exec 201>"$LOCK_FILE_COMPOSE"
flock 201

docker compose "${DOCKER_ARGS[@]}" -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

# Cleanup old projects for same role
mapfile -t OLD_PROJECTS < <(compose_list_projects | grep "^${ROLE}_" | grep -v "$PROJECT" || true)
for OLD in "${OLD_PROJECTS[@]}"; do
  docker compose -p "$OLD" down --volumes || true
done

echo "Converged role=$ROLE project=$PROJECT"

# Reclaim space: remove dangling images (old commit builds)
docker image prune -f >/dev/null 2>&1 || true

exit 0
