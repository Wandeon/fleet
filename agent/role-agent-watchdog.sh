#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/fleet"
STATE_DIR="/run/fleet"
LOCK_FILE="$STATE_DIR/role-agent.lock"
THRESHOLD_MINUTES=${WATCHDOG_THRESHOLD_MINUTES:-15}
MAX_RETRIES=${WATCHDOG_MAX_RETRIES:-3}
STATE_FILE="$STATE_DIR/role-agent-watchdog.failcount"

mkdir -p "$STATE_DIR"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  exit 0
fi

for cmd in journalctl systemctl hostname awk; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "role-agent-watchdog: required command '$cmd' missing" >&2
    exit 1
  fi
done

HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "$ROLE" ]]; then
  logger -t role-agent-watchdog "no role mapping for host ${HOSTNAME_ACTUAL}; skipping"
  exit 0
fi

if journalctl -u role-agent.service --since "${THRESHOLD_MINUTES} minutes ago" --grep 'Converged role=' --no-pager | grep -q 'Converged role='; then
  rm -f "$STATE_FILE"
  exit 0
fi

RETRY_COUNT=0
if [[ -f "$STATE_FILE" ]]; then
  RETRY_COUNT=$(<"$STATE_FILE")
fi
RETRY_COUNT=$((RETRY_COUNT + 1))

echo "$RETRY_COUNT" > "$STATE_FILE"
logger -t role-agent-watchdog "no convergence in last ${THRESHOLD_MINUTES}m (attempt ${RETRY_COUNT}/${MAX_RETRIES}); starting role-agent"

systemctl start role-agent.service || true

if (( RETRY_COUNT >= MAX_RETRIES )); then
  rm -f "$STATE_FILE"
  logger -t role-agent-watchdog "maximum retries reached, rebooting host"
  systemctl reboot
fi

exit 0
