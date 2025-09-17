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
MODULE_CONF="/etc/modules-load.d/fleet-watchdog.conf"

install -D -m 0755 "$REPO_DIR/agent/fleet-watchdog-health.sh" "$TARGET_BIN"

if ! lsmod | grep -q '^bcm2835_wdt'; then
  if ! modprobe bcm2835_wdt; then
    echo "setup-watchdogs: failed to load bcm2835_wdt module" >&2
  fi
fi

install -D -m 0644 /dev/null "$MODULE_CONF"
echo 'bcm2835_wdt' > "$MODULE_CONF"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || true
apt-get install -y -qq watchdog >/dev/null

if [[ ! -f "$BACKUP" && -f "$CONFIG" ]]; then
  cp "$CONFIG" "$BACKUP"
fi

ensure_setting() {
  local key="$1"
  local value="$2"
  if [[ -f "$CONFIG" ]] && grep -Eq "^${key}\\s*=" "$CONFIG"; then
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

systemctl enable --now watchdog.service || true
systemctl restart watchdog.service || true

systemctl status watchdog --no-pager || true

echo "Hardware watchdog enabled. Original config backed up at $BACKUP"