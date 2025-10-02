#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2034
# Exit codes
EXIT_SUCCESS=0
EXIT_INVENTORY_NOT_FOUND=10
EXIT_SECRETS_MISSING=11
EXIT_SECRETS_DECRYPT=12
EXIT_COMPOSE_FAILED=20
EXIT_ROLLBACK_FAILED=21
EXIT_PREREQ_MISSING=30

SCRIPT_NAME="role-agent"
DRY_RUN=0
TRACE=0
LOG_JSON=0
FORCE_REBUILD=0

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME}.sh [--dry-run] [--trace] [--log-json] [--force-rebuild]

Flags:
  --dry-run        Validate and plan without applying changes.
  --trace          Enable shell tracing for debugging.
  --log-json       Emit structured JSON logs in addition to human-readable logs.
  --force-rebuild  Rebuild images without cache and force container recreation.
  --help           Show this message.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --trace)
      TRACE=1
      shift
      ;;
    --log-json)
      LOG_JSON=1
      shift
      ;;
    --force-rebuild)
      FORCE_REBUILD=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      usage
      exit $EXIT_PREREQ_MISSING
      ;;
  esac
done

if (( TRACE )); then
  set -x
fi

# Globals and defaults
REPO_DIR="${ROLE_AGENT_REPO_DIR:-/opt/fleet}"
RUN_DIR="${ROLE_AGENT_RUN_DIR:-/var/run/fleet}"
LEGACY_RUN_DIR="/run/fleet"
LOCK_FILE="$RUN_DIR/role-agent.lock"
LOCK_COMPOSE="$RUN_DIR/compose.lock"
HEALTH_FILE="$RUN_DIR/health.json"
COMMIT_FILE="$RUN_DIR/commit.sha"
HISTORY_DIR="$RUN_DIR/projects"
PLAN_HISTORY_BASE="$HISTORY_DIR/plan"
HISTORY_KEEP=${ROLE_AGENT_HISTORY_KEEP:-2}
METRIC_FILE="$RUN_DIR/role-agent.prom"
TEXTFILE_COLLECTOR_DIR="${ROLE_AGENT_TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"
AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/etc/fleet/age.key}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LIB_DIR="$SCRIPT_DIR/lib"
INVENTORY_TO_JSON="$LIB_DIR/inventory_to_json.py"
HOSTNAME_ACTUAL="${ROLE_AGENT_HOSTNAME:-$(hostname -f 2>/dev/null || hostname)}"
LOG_HOST="$HOSTNAME_ACTUAL"
LOG_ROLE=""
LOG_COMMIT=""
CURRENT_STEP="startup"
CURRENT_STEP_START=0
SCRIPT_START_MS=0
HEALTH_ERRORS=()
ROLLBACK_ATTEMPTED=0
ROLLBACK_SUCCEEDED=0
PREVIOUS_COMMIT=""
TARGET_COMMIT=""

ensure_run_dir() {
  install -d -m 0700 "$RUN_DIR"
  if [[ "$RUN_DIR" != "$LEGACY_RUN_DIR" ]]; then
    if [[ ! -e "$LEGACY_RUN_DIR" ]]; then
      ln -s "$RUN_DIR" "$LEGACY_RUN_DIR" 2>/dev/null || true
    fi
  fi
  install -d -m 0700 "$HISTORY_DIR"
  install -d -m 0700 "$PLAN_HISTORY_BASE"
}

now_ms() {
  local now
  if now=$(date +%s%3N 2>/dev/null); then
    printf '%s\n' "$now"
  else
    python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
  fi
}

iso_time() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

start_step() {
  CURRENT_STEP="$1"
  CURRENT_STEP_START=$(now_ms)
}

log_emit() {
  local level="$1"
  local message="$2"
  local ts
  ts=$(iso_time)
  local duration_ms
  if [[ -n "$CURRENT_STEP_START" && "$CURRENT_STEP_START" != 0 ]]; then
    local now
    now=$(now_ms)
    duration_ms=$((now - CURRENT_STEP_START))
  else
    duration_ms=0
  fi
  printf '[role-agent] %s %-5s %s\n' "$ts" "$level" "$message"
  if (( LOG_JSON )); then
    jq -n \
      --arg ts "$ts" \
      --arg level "$level" \
      --arg msg "$message" \
      --arg host "$LOG_HOST" \
      --arg role "$LOG_ROLE" \
      --arg commit "$LOG_COMMIT" \
      --arg step "$CURRENT_STEP" \
      --argjson duration $duration_ms \
      '{ts:$ts, level:$level, msg:$msg, host:$host, role:$role, commit:$commit, step:$step, duration_ms:$duration}'
  fi
}

log_info() { log_emit INFO "$1"; }
log_warn() { log_emit WARN "$1"; }
log_err() { log_emit ERROR "$1"; }

append_error() {
  HEALTH_ERRORS+=("$1")
  log_err "$1"
}

# shellcheck disable=SC2317
write_metrics() {
  local status_value="$1"
  local ts
  ts=$(date +%s)
  cat >"$METRIC_FILE" <<EOF
role_agent_last_run_timestamp{host="$LOG_HOST"} $ts
role_agent_last_run_success{host="$LOG_HOST"} $status_value
EOF
  if [[ -d "$TEXTFILE_COLLECTOR_DIR" && -w "$TEXTFILE_COLLECTOR_DIR" ]]; then
    cp "$METRIC_FILE" "$TEXTFILE_COLLECTOR_DIR/role-agent.prom" 2>/dev/null || true
  fi
}

# shellcheck disable=SC2317
errors_json() {
  if (( ${#HEALTH_ERRORS[@]} )); then
    printf '%s\0' "${HEALTH_ERRORS[@]}" | jq -Rs 'split("\u0000")[:-1]'
  else
    printf '[]'
  fi
}

# shellcheck disable=SC2317
write_health() {
  local exit_code="$1"
  local finished
  finished=$(iso_time)
  local finished_ms
  finished_ms=$(now_ms)
  local duration_ms=$((finished_ms - SCRIPT_START_MS))
  local status_text="error"
  case "$exit_code" in
    0)
      status_text="ok"
      ;;
    "$EXIT_COMPOSE_FAILED")
      if (( ROLLBACK_ATTEMPTED )) && (( ROLLBACK_SUCCEEDED )); then
        status_text="degraded"
      fi
      ;;
    *)
      status_text="error"
      ;;
  esac
  local errors_json
  errors_json=$(errors_json)
  local base_json
  base_json=$(jq -n \
    --arg host "$LOG_HOST" \
    --arg role "$LOG_ROLE" \
    --arg commit "$LOG_COMMIT" \
    --arg status "$status_text" \
    --arg started "$SCRIPT_STARTED_AT" \
    --arg finished "$finished" \
    --argjson duration "$duration_ms" \
    --argjson errors "$errors_json" \
    '{hostname:$host, role:$role, commit:$commit, status:$status, startedAt:$started, finishedAt:$finished, durationMs:$duration, errors:$errors}')
  local result="$base_json"
  if (( DRY_RUN )); then
    result=$(jq -n --argjson base "$result" '$base + {dryRun:true}')
  fi
  if (( ROLLBACK_ATTEMPTED )); then
    result=$(jq -n --argjson base "$result" --argjson rollback "$ROLLBACK_SUCCEEDED" '$base + {rollbackAttempted:true, rollbackSucceeded:($rollback == 1)}')
  fi
  printf '%s\n' "$result" > "$HEALTH_FILE"
}

# shellcheck disable=SC2317
cleanup_temp_env() {
  if [[ -n "${TMP_ENV_FILE:-}" && -f "$TMP_ENV_FILE" ]]; then
    rm -f "$TMP_ENV_FILE"
  fi
}

# shellcheck disable=SC2317
on_exit() {
  local exit_code=$?
  trap - EXIT
  cleanup_temp_env
  write_health "$exit_code" || true
  if (( exit_code == 0 )); then
    write_metrics 1
  else
    write_metrics 0
  fi
  exit "$exit_code"
}

trap on_exit EXIT

ensure_run_dir
SCRIPT_START_MS=$(now_ms)
SCRIPT_STARTED_AT=$(iso_time)

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log_warn "another execution is already in progress"
  exit 0
fi

exec 201>"$LOCK_COMPOSE"
if ! flock 201; then
  append_error "failed to acquire compose lock"
  exit $EXIT_PREREQ_MISSING
fi

start_step "prerequisites"

required_cmds=(git jq python3)
if ! command -v docker >/dev/null 2>&1; then
  append_error "docker binary not found"
  exit $EXIT_PREREQ_MISSING
fi
if command -v docker compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  append_error "docker compose CLI not available"
  exit $EXIT_PREREQ_MISSING
fi
for cmd in "${required_cmds[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    append_error "required command missing: $cmd"
    exit $EXIT_PREREQ_MISSING
  fi
done

if [[ ! -d "$REPO_DIR/.git" ]]; then
  append_error "repo not found at $REPO_DIR"
  exit $EXIT_PREREQ_MISSING
fi

git config --system --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

start_step "inventory"
if [[ ! -x "$INVENTORY_TO_JSON" ]]; then
  append_error "inventory helper missing at $INVENTORY_TO_JSON"
  exit $EXIT_PREREQ_MISSING
fi

INVENTORY_JSON=$(/usr/bin/env python3 "$INVENTORY_TO_JSON" "$REPO_DIR/inventory/devices.yaml" 2>/dev/null || true)
if [[ -z "$INVENTORY_JSON" ]]; then
  append_error "failed to parse inventory at $REPO_DIR/inventory/devices.yaml"
  exit $EXIT_PREREQ_MISSING
fi

ROLE=$(printf '%s' "$INVENTORY_JSON" | jq -r --arg host "$HOSTNAME_ACTUAL" '.[$host].role // empty')
if [[ -z "$ROLE" || "$ROLE" == "null" ]]; then
  append_error "Role for host $HOSTNAME_ACTUAL not found. Add to inventory/devices.yaml:\n  devices:\n    $HOSTNAME_ACTUAL:\n      role: <role-name>"
  exit $EXIT_INVENTORY_NOT_FOUND
fi
LOG_ROLE="$ROLE"
log_info "resolved host $HOSTNAME_ACTUAL role=$ROLE"

start_step "git-sync"
update_repo() {
  local attempts=3
  local attempt=1
  while (( attempt <= attempts )); do
    if git -C "$REPO_DIR" fetch --depth 1 origin main; then
      if git -C "$REPO_DIR" reset --hard origin/main; then
        return 0
      fi
    fi
    log_warn "git sync attempt $attempt failed"
    sleep $((attempt * 5))
    attempt=$((attempt + 1))
  done
  return 1
}

if ! update_repo; then
  append_error "failed to update repository"
  exit $EXIT_PREREQ_MISSING
fi

TARGET_COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
LOG_COMMIT="$TARGET_COMMIT"
log_info "repo synced to commit $TARGET_COMMIT"

if [[ -f "$COMMIT_FILE" ]]; then
  PREVIOUS_COMMIT=$(cat "$COMMIT_FILE" 2>/dev/null || true)
fi

PROJECT_NAME="${ROLE}_${TARGET_COMMIT}"
PREVIOUS_PROJECT=""
if [[ -n "$PREVIOUS_COMMIT" ]]; then
  PREVIOUS_PROJECT="${ROLE}_${PREVIOUS_COMMIT}"
fi

start_step "secrets"
ROLE_DIR="$REPO_DIR/roles/$ROLE"
ENC_ENV="$ROLE_DIR/.env.sops.enc"
PLAIN_ENV="$ROLE_DIR/.env"
ENV_SOURCED=0
if [[ -f "$ENC_ENV" ]]; then
  if ! command -v sops >/dev/null 2>&1; then
    append_error "sops required for $ENC_ENV but not found"
    exit $EXIT_SECRETS_MISSING
  fi
  if [[ ! -f "$AGE_KEY_FILE" ]]; then
    append_error "AGE key missing at $AGE_KEY_FILE"
    exit $EXIT_SECRETS_MISSING
  fi
  perms=$(stat -c %a "$AGE_KEY_FILE" 2>/dev/null || echo "")
  if [[ "$perms" != "600" ]]; then
    append_error "AGE key $AGE_KEY_FILE must have 0600 permissions"
    exit $EXIT_SECRETS_MISSING
  fi
  TMP_ENV_FILE=$(mktemp "$RUN_DIR/${ROLE}.env.XXXXXX")
  export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"
  if sops --decrypt "$ENC_ENV" >"$TMP_ENV_FILE"; then
    set -a
    # shellcheck source=/dev/null
    source "$TMP_ENV_FILE"
    set +a
    ENV_SOURCED=1
  else
    append_error "failed to decrypt $ENC_ENV"
    exit $EXIT_SECRETS_DECRYPT
  fi
  rm -f "$TMP_ENV_FILE"
  unset TMP_ENV_FILE
fi

if (( ! ENV_SOURCED )) && [[ -f "$PLAIN_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PLAIN_ENV"
  set +a
  ENV_SOURCED=1
fi

if (( ! ENV_SOURCED )); then
  log_warn "no role env overrides found for $ROLE"
fi

start_step "compose-plan"
BASE_COMPOSE="$REPO_DIR/baseline/docker-compose.yml"
if [[ ! -f "$BASE_COMPOSE" ]]; then
  append_error "baseline compose file missing at $BASE_COMPOSE"
  exit $EXIT_PREREQ_MISSING
fi
readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '[0-9][0-9]-*.yml' | sort)
COMPOSE_FILES_ARGS=(-f "$BASE_COMPOSE")
PLAN_FILES=("$BASE_COMPOSE")
for override in "${ROLE_OVERRIDES[@]}"; do
  COMPOSE_FILES_ARGS+=(-f "$override")
  PLAN_FILES+=("$override")
done
log_info "compose plan: ${PLAN_FILES[*]}"

PLAN_FILES_REL=()
for plan_path in "${PLAN_FILES[@]}"; do
  if [[ "$plan_path" == "$REPO_DIR"/* ]]; then
    PLAN_FILES_REL+=("${plan_path#"$REPO_DIR"/}")
  else
    PLAN_FILES_REL+=("$plan_path")
  fi
done

COMPOSE_GLOBAL_ARGS=()
COMPOSE_GLOBAL_ARGS+=(--project-directory "$ROLE_DIR")
if [[ -f "$REPO_DIR/.env" ]]; then
  COMPOSE_GLOBAL_ARGS+=(--env-file "$REPO_DIR/.env")
fi

compose_run() {
  "${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" "${COMPOSE_FILES_ARGS[@]}" "$@"
}

compose_ls() {
  "${DOCKER_COMPOSE[@]}" ls --format json
}

attempt_rollback() {
  local prev_commit="$1"
  local prev_project="$2"
  local plan_dir="$PLAN_HISTORY_BASE/$ROLE"
  local plan_file="$plan_dir/${prev_commit}.plan"
  if [[ ! -f "$plan_file" ]]; then
    append_error "rollback plan missing for commit $prev_commit"
    return 1
  fi
  local rollback_temp
  rollback_temp=$(mktemp -d "$RUN_DIR/rollback.${prev_project}.XXXXXX")
  local -a rollback_args=()
  local rollback_failed=0
  while IFS= read -r rel_path || [[ -n "$rel_path" ]]; do
    [[ -z "$rel_path" ]] && continue
    local dest="$rollback_temp/$rel_path"
    mkdir -p "$(dirname "$dest")"
    if ! git -C "$REPO_DIR" show "${prev_commit}:${rel_path}" >"$dest" 2>/dev/null; then
      append_error "unable to materialize ${rel_path} from $prev_commit"
      rollback_failed=1
      break
    fi
    rollback_args+=(-f "$dest")
  done <"$plan_file"
  if (( rollback_failed || ${#rollback_args[@]} == 0 )); then
    rm -rf "$rollback_temp"
    return 1
  fi
  if "${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" -p "$prev_project" "${rollback_args[@]}" up -d --remove-orphans; then
    rm -rf "$rollback_temp"
    return 0
  fi
  append_error "rollback failed for $prev_project"
  rm -rf "$rollback_temp"
  return 1
}

start_step "compose-validate"
if ! compose_run config >/dev/null; then
  append_error "docker compose config validation failed"
  exit $EXIT_COMPOSE_FAILED
fi

if (( DRY_RUN )); then
  log_info "dry-run complete; no changes applied"
  exit 0
fi

start_step "compose-converge"
OLD_PROJECTS=()
if compose_ls_output=$(compose_ls 2>/dev/null); then
  mapfile -t OLD_PROJECTS < <(printf '%s\n' "$compose_ls_output" | jq -r '.[].Name' | grep "^${ROLE}_" || true)
fi

if [[ -z "$PREVIOUS_PROJECT" && ${#OLD_PROJECTS[@]} -gt 0 ]]; then
  PREVIOUS_PROJECT="${OLD_PROJECTS[0]}"
fi

for old in "${OLD_PROJECTS[@]}"; do
  if [[ "$old" != "$PROJECT_NAME" ]]; then
    log_info "stopping compose project $old prior to converge"
    "${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" -p "$old" down || true
  fi
done

compose_up_args=("${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" -p "$PROJECT_NAME" "${COMPOSE_FILES_ARGS[@]}" up -d)
if (( FORCE_REBUILD )); then
  log_info "force rebuild enabled"
  "${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" -p "$PROJECT_NAME" "${COMPOSE_FILES_ARGS[@]}" build --no-cache --pull
  compose_up_args+=(--build --force-recreate --remove-orphans)
else
  compose_up_args+=(--build --remove-orphans)
fi

if ! "${compose_up_args[@]}"; then
  append_error "docker compose up failed"
  ROLLBACK_ATTEMPTED=1
  rollback_rc=$EXIT_COMPOSE_FAILED
  if [[ -n "$PREVIOUS_PROJECT" && -n "$PREVIOUS_COMMIT" ]]; then
    log_warn "attempting rollback to $PREVIOUS_PROJECT"
    if attempt_rollback "$PREVIOUS_COMMIT" "$PREVIOUS_PROJECT"; then
      ROLLBACK_SUCCEEDED=1
      log_warn "rollback succeeded using $PREVIOUS_PROJECT"
    else
      rollback_rc=$EXIT_ROLLBACK_FAILED
    fi
  fi
  exit $rollback_rc
fi

log_info "compose converge succeeded for project $PROJECT_NAME"

echo "$TARGET_COMMIT" > "$COMMIT_FILE"

start_step "cleanup"
HISTORY_FILE="$HISTORY_DIR/${ROLE}.history"
new_history=()
if [[ -f "$HISTORY_FILE" ]]; then
  mapfile -t existing_history <"$HISTORY_FILE"
  for commit in "${existing_history[@]}"; do
    [[ -n "$commit" && "$commit" != "$TARGET_COMMIT" ]] && new_history+=("$commit")
  done
fi
new_history+=("$TARGET_COMMIT")
max_entries=$(( HISTORY_KEEP + 1 ))
if (( max_entries < 1 )); then
  max_entries=1
fi
if (( ${#new_history[@]} > max_entries )); then
  start_index=$(( ${#new_history[@]} - max_entries ))
  new_history=("${new_history[@]:$start_index}")
fi
printf '%s\n' "${new_history[@]}" > "$HISTORY_FILE"

PLAN_DIR="$PLAN_HISTORY_BASE/$ROLE"
install -d -m 0700 "$PLAN_DIR"
PLAN_FILE_CURRENT="$PLAN_DIR/${TARGET_COMMIT}.plan"
printf '%s\n' "${PLAN_FILES_REL[@]}" > "$PLAN_FILE_CURRENT"

# Remove plan files no longer referenced
for plan_path in "$PLAN_DIR"/*.plan; do
  [[ -e "$plan_path" ]] || continue
  plan_commit=$(basename "$plan_path" .plan)
  keep=0
  for commit in "${new_history[@]}"; do
    if [[ "$plan_commit" == "$commit" ]]; then
      keep=1
      break
    fi
  done
  if (( ! keep )); then
    rm -f "$plan_path"
  fi
done

if compose_ls_output=$(compose_ls 2>/dev/null); then
  mapfile -t role_projects < <(printf '%s\n' "$compose_ls_output" | jq -r '.[].Name' | grep "^${ROLE}_" || true)
  for project in "${role_projects[@]}"; do
    keep=0
    for commit in "${new_history[@]}"; do
      if [[ "$project" == "${ROLE}_${commit}" ]]; then
        keep=1
        break
      fi
    done
    if (( ! keep )); then
      log_info "pruning compose project $project"
      "${DOCKER_COMPOSE[@]}" "${COMPOSE_GLOBAL_ARGS[@]}" -p "$project" down --volumes || true
    fi
  done
fi
prune_images_if_needed() {
  local threshold_gb=${ROLE_AGENT_PRUNE_THRESHOLD_GB:-3}
  local threshold_bytes=$((threshold_gb * 1024 * 1024 * 1024))
  local images_line
  images_line=$(docker system df --format '{{.Type}} {{.Size}}' 2>/dev/null | awk '$1=="Images" {print $2" "$3}' | head -n1)
  if [[ -z "$images_line" ]]; then
    return
  fi
  local size unit
  size=$(printf '%s' "$images_line" | awk '{print $1}')
  unit=$(printf '%s' "$images_line" | awk '{print tolower($2)}')
  local multiplier=1
  case "$unit" in
    b|bytes) multiplier=1 ;;
    kb|kib) multiplier=1024 ;;
    mb|mib) multiplier=$((1024*1024)) ;;
    gb|gib) multiplier=$((1024*1024*1024)) ;;
    tb|tib) multiplier=$((1024*1024*1024*1024)) ;;
    *) multiplier=1 ;;
  esac
  local size_bytes
  size_bytes=$(awk -v s="$size" -v m="$multiplier" 'BEGIN {printf "%.0f", s*m}')
  if [[ -n "$size_bytes" ]] && (( size_bytes > threshold_bytes )); then
    log_info "image usage exceeds threshold (${threshold_gb}GB); pruning dangling images"
    docker image prune -f >/dev/null 2>&1 || true
  fi
  local full_prune_file="$RUN_DIR/last-full-prune"
  local now_ts
  now_ts=$(date +%s)
  local prune_age=$((7*24*3600))
  local last_run=0
  if [[ -f "$full_prune_file" ]]; then
    last_run=$(cat "$full_prune_file" 2>/dev/null || echo 0)
  fi
  if (( now_ts - last_run > prune_age )); then
    log_info "performing weekly docker system prune"
    docker system prune -af >/dev/null 2>&1 || true
    echo "$now_ts" > "$full_prune_file"
  fi
}

prune_images_if_needed

log_info "convergence complete"
exit 0
