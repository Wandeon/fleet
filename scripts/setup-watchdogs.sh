#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "setup-watchdogs: must be run as root" >&2
  exit 1
fi

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TARGET_BIN="/usr/local/bin/fleet-watchdog-health.sh"
CONFIG="/etc/watchdog.conf"
BACKUP="${CONFIG}.fleet.bak"

install -D -m 0755 "$REPO_DIR/agent/fleet-watchdog-health.sh" "$TARGET_BIN"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq watchdog >/dev/null

if [[ ! -f "$BACKUP" ]]; then
  cp "$CONFIG" "$BACKUP"
fi

ensure_setting() {
  local key="$1"
  local value="$2"
  if grep -Eq "^${key}\\s*=" "$CONFIG"; then
    sed -i "s|^${key}\\s*=.*|${key} = ${value}|" "$CONFIG"
  else
    echo "${key} = ${value}" >> "$CONFIG"
  fi
}

ensure_setting "watchdog-device" "/dev/watchdog"
ensure_setting "interval" "10"
ensure_setting "realtime" "yes"
ensure_setting "priority" "1"
ensure_setting "test-binary" "$TARGET_BIN"

systemctl enable --now watchdog.service
systemctl restart watchdog.service

echo "Hardware watchdog enabled. Original config backed up at $BACKUP"
