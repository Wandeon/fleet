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
for cmd in git docker jq curl systemctl find install; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found" >&2
    exit 1
  fi
done
HOSTNAME_ACTUAL=$(hostname)
HOST_ENV_FILE="/etc/fleet/agent.env"
if [[ -f "$HOST_ENV_FILE" ]]; then
  set -a
  # shellcheck source=/etc/fleet/agent.env
  source "$HOST_ENV_FILE"
  set +a
fi

# Backwards compatibility: allow hosts to set ZIGBEE_SERIAL and
# automatically mirror it to ZIGBEE_SERIAL_PORT for docker compose.
if [[ -n "${ZIGBEE_SERIAL:-}" && -z "${ZIGBEE_SERIAL_PORT:-}" ]]; then
  export ZIGBEE_SERIAL_PORT="$ZIGBEE_SERIAL"
fi

export ROLE_AGENT_HOSTNAME="$HOSTNAME_ACTUAL"
export LOG_SOURCE_HOST="${LOG_SOURCE_HOST:-$HOSTNAME_ACTUAL}"

# Optional Prometheus textfile collector output
TEXTFILE_COLLECTOR_DIR="${ROLE_AGENT_TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"
METRIC_STATE_FILE="$STATE_DIR/role-agent.prom"
lock_file_age_seconds() {
  local file="$1"
  local now mtime
  now=$(date +%s)
  if command -v stat >/dev/null 2>&1; then
    if mtime=$(stat -c %Y "$file" 2>/dev/null); then
      echo $((now - mtime))
      return 0
    elif mtime=$(stat -f %m "$file" 2>/dev/null); then
      echo $((now - mtime))
      return 0
    fi
  fi
  if command -v python3 >/dev/null 2>&1; then
    if mtime=$(python3 -c 'import os, sys; print(int(os.path.getmtime(sys.argv[1])))' "$file" 2>/dev/null); then
      echo $((now - mtime))
      return 0
    fi
  fi
  echo 0
  return 1
}

clear_stale_git_locks() {
  local repo="$1"
  local -a locks=(
    "$repo/.git/index.lock"
    "$repo/.git/shallow.lock"
    "$repo/.git/packed-refs.lock"
  )
  local git_running=0
  if command -v pgrep >/dev/null 2>&1; then
    if pgrep -f "git.*${repo}" >/dev/null 2>&1; then
      git_running=1
    fi
  fi
  for lock in "${locks[@]}"; do
    [[ -e "$lock" ]] || continue
    if (( git_running )); then
      echo "role-agent: git process detected; leaving lock $lock for next attempt" >&2
      continue
    fi
    local age
    age=$(lock_file_age_seconds "$lock") || age=0
    if (( age >= 60 )); then
      rm -f "$lock"
      echo "role-agent: removed stale git lock $lock (age ${age}s)" >&2
    else
      echo "role-agent: git lock $lock present (age ${age}s); will retry later" >&2
    fi
  done
}

update_repo() {
  local attempts=3
  local attempt=1
  while (( attempt <= attempts )); do
    clear_stale_git_locks "$REPO_DIR"
    set +e
    git -C "$REPO_DIR" fetch --depth 1 origin main
    local fetch_rc=$?
    if (( fetch_rc == 0 )); then
      git -C "$REPO_DIR" reset --hard origin/main
      local reset_rc=$?
      set -e
      if (( reset_rc == 0 )); then
        return 0
      else
        echo "role-agent: git reset failed on attempt ${attempt} (rc=${reset_rc})" >&2
      fi
    else
      set -e
      echo "role-agent: git fetch failed on attempt ${attempt} (rc=${fetch_rc})" >&2
    fi
    if (( attempt < attempts )); then
      sleep $((attempt * 10))
    fi
    attempt=$((attempt + 1))
  done
  echo "ERROR: git update failed after ${attempts} attempts" >&2
  exit 1
}
write_agent_metrics() {
  local status="${1:-0}"
  local ts=$(date +%s)
  mkdir -p "$(dirname "$METRIC_STATE_FILE")"
  cat > "$METRIC_STATE_FILE" <<EOF
role_agent_last_run_timestamp{host="$HOSTNAME_ACTUAL"} $ts
role_agent_last_run_success{host="$HOSTNAME_ACTUAL"} $status
EOF
  if [[ -d "$TEXTFILE_COLLECTOR_DIR" && -w "$TEXTFILE_COLLECTOR_DIR" ]]; then
    cp "$METRIC_STATE_FILE" "$TEXTFILE_COLLECTOR_DIR/role-agent.prom" 2>/dev/null || true
  fi
}
trap 'write_agent_metrics 0' ERR

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
  # Always ensure the primary convergence timer remains scheduled.
  systemctl enable --now role-agent.timer >/dev/null 2>&1 || true

  # Optional timers (watchdog + healthcheck) should only be re-enabled if the
  # host explicitly keeps them enabled. If an operator disables or masks the
  # timer during maintenance we should respect that choice on subsequent runs.
  local -a optional_timers=(
    role-agent-watchdog.timer
    role-agent-healthcheck.timer
  )
  for timer in "${optional_timers[@]}"; do
    if systemctl is-enabled "$timer" >/dev/null 2>&1; then
      systemctl enable --now "$timer" >/dev/null 2>&1 || true
    fi
  done
}

compose_list_projects() {
  local output names
  if output=$(docker compose ls --format json 2>/dev/null); then
    if names=$(printf '%s\n' "$output" | jq -r '.[] | .Name' 2>/dev/null); then
      printf '%s\n' "$names"
    fi
    return 0
  fi
  docker compose ls 2>/dev/null | awk 'NR>1 {print $1}' || true
  return 0
}

stop_role_projects() {
  local role_prefix="$1_"
  mapfile -t existing_projects < <(compose_list_projects | grep "^${role_prefix}" || true)
  if (( ${#existing_projects[@]} == 0 )); then
    return 0
  fi
  for project in "${existing_projects[@]}"; do
    echo "role-agent: stopping existing compose project ${project} before converge" >&2
    docker compose -p "$project" down --remove-orphans || true
  done
}

# Determine role from inventory/devices.yaml by hostname
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "${ROLE}" ]]; then
  echo "ERROR: Role not found for hostname ${HOSTNAME_ACTUAL} in inventory/devices.yaml" >&2
  exit 1
fi

stop_role_projects "$ROLE"

# Update repo
if [[ -d "$REPO_DIR/.git" ]]; then
  update_repo
else
  echo "ERROR: Repo not found at $REPO_DIR" >&2
  exit 1
fi

ensure_systemd_units

# Ensure Claude Code CLI and MCP servers are present
SETUP_CLAUDE="$REPO_DIR/agent/setup-claude-tools.sh"
if [[ -x "$SETUP_CLAUDE" ]]; then
  if ! "$SETUP_CLAUDE"; then
    echo "WARNING: setup-claude-tools failed; continuing" >&2
  fi
fi

# Decrypt role env if present
ENC_ENV="$REPO_DIR/roles/$ROLE/.env.sops.enc"
PLAIN_ENV="$REPO_DIR/roles/$ROLE/.env"
ENV_SOURCED=0

if [[ -f "$ENC_ENV" ]]; then
  if ! command -v sops >/dev/null 2>&1; then
    echo "WARNING: sops not found; skipping decryption for $ROLE" >&2
  elif [[ ! -f "$AGE_KEY_FILE" ]]; then
    echo "WARNING: AGE key not found at $AGE_KEY_FILE; skipping $ENC_ENV" >&2
  else
    export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"
    TMP_ENV="$STATE_DIR/${ROLE}.env"
    if sops --decrypt "$ENC_ENV" > "$TMP_ENV"; then
      set -a
      # shellcheck source=/dev/null
      source "$TMP_ENV"
      set +a
      ENV_SOURCED=1
    else
      echo "WARNING: failed to decrypt $ENC_ENV; falling back to plain env" >&2
    fi
    rm -f "$TMP_ENV"
  fi
fi

if (( ! ENV_SOURCED )) && [[ -f "$PLAIN_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PLAIN_ENV"
  set +a
  ENV_SOURCED=1
fi

if (( ! ENV_SOURCED )); then
  echo "INFO: proceeding without role-specific env overrides for $ROLE" >&2
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

write_agent_metrics 1

exit 0


