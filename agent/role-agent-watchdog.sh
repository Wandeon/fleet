#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"
RUNTIME_DIR="/run/fleet"
PERSIST_DIR="/var/lib/fleet"
LOCK_FILE="$RUNTIME_DIR/role-agent-watchdog.lock"
STATE_FILE="$PERSIST_DIR/role-agent-watchdog.state"
TEXTFILE_COLLECTOR_DIR="${ROLE_AGENT_TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"
METRIC_STATE_FILE="$RUNTIME_DIR/role-agent-watchdog.prom"
THRESHOLD_MINUTES=${WATCHDOG_THRESHOLD_MINUTES:-60}
WINDOW_START_MINUTES=60   # 01:00
WINDOW_END_MINUTES=120    # 02:00
LOG_TAG="role-agent-watchdog"

mkdir -p "$RUNTIME_DIR" "$PERSIST_DIR"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  exit 0
fi

for cmd in journalctl systemctl hostname awk date logger sync; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "${LOG_TAG}: required command '$cmd' missing" >&2
    exit 1
  fi
done

HOSTNAME_ACTUAL=$(hostname)

STATE_WINDOW_DATE=""
STATE_ATTEMPTS=0
STATE_REBOOTS=0
WATCHDOG_LAST_ACTION=0

write_metrics() {
  local action="$1"
  local ts
  ts=$(date +%s)
  cat >"$METRIC_STATE_FILE" <<EOF_METRICS
role_agent_watchdog_last_action_timestamp{host="$HOSTNAME_ACTUAL"} $ts
role_agent_watchdog_last_action{host="$HOSTNAME_ACTUAL"} $action
role_agent_watchdog_attempts{host="$HOSTNAME_ACTUAL"} ${STATE_ATTEMPTS}
role_agent_watchdog_reboots{host="$HOSTNAME_ACTUAL"} ${STATE_REBOOTS}
EOF_METRICS
  if [[ -d "$TEXTFILE_COLLECTOR_DIR" && -w "$TEXTFILE_COLLECTOR_DIR" ]]; then
    cp "$METRIC_STATE_FILE" "$TEXTFILE_COLLECTOR_DIR/role-agent-watchdog.prom" 2>/dev/null || true
  fi
}

load_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    return 0
  fi
  while IFS='=' read -r key value; do
    case "$key" in
      window_date)
        STATE_WINDOW_DATE="$value"
        ;;
      attempts)
        if [[ "$value" =~ ^[0-9]+$ ]]; then
          STATE_ATTEMPTS=$((10#$value))
        fi
        ;;
      reboots)
        if [[ "$value" =~ ^[0-9]+$ ]]; then
          STATE_REBOOTS=$((10#$value))
        fi
        ;;
    esac
  done <"$STATE_FILE"
}

save_state() {
  cat >"$STATE_FILE" <<EOF_STATE
window_date=$STATE_WINDOW_DATE
attempts=$STATE_ATTEMPTS
reboots=$STATE_REBOOTS
EOF_STATE
}

clear_state() {
  STATE_WINDOW_DATE=""
  STATE_ATTEMPTS=0
  STATE_REBOOTS=0
  rm -f "$STATE_FILE"
}

ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "$ROLE" ]]; then
  logger -t "$LOG_TAG" "no role mapping for host ${HOSTNAME_ACTUAL}; skipping"
  write_metrics "$WATCHDOG_LAST_ACTION"
  exit 0
fi

load_state
TODAY=$(date +%F)
if [[ -n "$STATE_WINDOW_DATE" && "$STATE_WINDOW_DATE" != "$TODAY" ]]; then
  clear_state
fi

if journalctl -u role-agent.service --since "${THRESHOLD_MINUTES} minutes ago" --grep 'Converged role=' --no-pager | grep -q 'Converged role='; then
  if (( STATE_ATTEMPTS > 0 || STATE_REBOOTS > 0 )); then
    logger -t "$LOG_TAG" "recent convergence detected; clearing watchdog state"
  fi
  clear_state
  WATCHDOG_LAST_ACTION=3
  write_metrics "$WATCHDOG_LAST_ACTION"
  exit 0
fi

read -r CURRENT_HOUR CURRENT_MINUTE <<<"$(date +'%H %M')"
CURRENT_TOTAL_MINUTES=$((10#$CURRENT_HOUR * 60 + 10#$CURRENT_MINUTE))

if (( CURRENT_TOTAL_MINUTES < WINDOW_START_MINUTES || CURRENT_TOTAL_MINUTES >= WINDOW_END_MINUTES )); then
  WATCHDOG_LAST_ACTION=5
  logger -t "$LOG_TAG" "convergence stale but outside maintenance window (01:00-02:00); watchdog idle"
  write_metrics "$WATCHDOG_LAST_ACTION"
  exit 0
fi

if [[ -z "$STATE_WINDOW_DATE" ]]; then
  STATE_WINDOW_DATE="$TODAY"
fi

if (( STATE_ATTEMPTS >= 2 )); then
  WATCHDOG_LAST_ACTION=4
  logger -t "$LOG_TAG" "convergence still stale after ${STATE_ATTEMPTS} attempts on ${STATE_WINDOW_DATE}; leaving node running"
  save_state
  write_metrics "$WATCHDOG_LAST_ACTION"
  exit 0
fi

attempt_converge() {
  local label="$1"
  logger -t "$LOG_TAG" "no convergence in last ${THRESHOLD_MINUTES}m; ${label} role-agent.service"
  set +e
  systemctl start role-agent.service
  local rc=$?
  set -e
  return $rc
}

if (( STATE_ATTEMPTS == 0 )); then
  if attempt_converge "starting"; then
    clear_state
    WATCHDOG_LAST_ACTION=3
    logger -t "$LOG_TAG" "role-agent.service completed successfully during watchdog attempt"
    write_metrics "$WATCHDOG_LAST_ACTION"
    exit 0
  fi
  STATE_ATTEMPTS=1
  STATE_REBOOTS=1
  STATE_WINDOW_DATE="$TODAY"
  save_state
  WATCHDOG_LAST_ACTION=2
  logger -t "$LOG_TAG" "role-agent.service failed (attempt 1/2); rebooting once to retry within maintenance window"
  write_metrics "$WATCHDOG_LAST_ACTION"
  sync
  systemctl reboot
fi

if (( STATE_ATTEMPTS == 1 && STATE_REBOOTS == 0 )); then
  STATE_REBOOTS=1
  save_state
  WATCHDOG_LAST_ACTION=2
  logger -t "$LOG_TAG" "first converge attempt failed without reboot; rebooting now to retry"
  write_metrics "$WATCHDOG_LAST_ACTION"
  sync
  systemctl reboot
fi

if (( STATE_ATTEMPTS == 1 )); then
  if attempt_converge "post-reboot retrying"; then
    clear_state
    WATCHDOG_LAST_ACTION=3
    logger -t "$LOG_TAG" "role-agent.service completed successfully after watchdog reboot"
    write_metrics "$WATCHDOG_LAST_ACTION"
    exit 0
  fi
  STATE_ATTEMPTS=2
  save_state
  WATCHDOG_LAST_ACTION=4
  logger -t "$LOG_TAG" "role-agent.service failed after watchdog reboot (attempt 2/2); leaving node running"
  write_metrics "$WATCHDOG_LAST_ACTION"
  exit 0
fi

WATCHDOG_LAST_ACTION=4
logger -t "$LOG_TAG" "unexpected state (attempts=${STATE_ATTEMPTS}, reboots=${STATE_REBOOTS}); leaving node unchanged"
save_state
write_metrics "$WATCHDOG_LAST_ACTION"
exit 0
