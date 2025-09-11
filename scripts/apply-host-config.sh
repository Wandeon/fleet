#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${1:-/opt/fleet}"
ROLE="${2:-}"
if [ -z "$ROLE" ]; then
  echo "usage: $0 <repo_dir> <role>"
  exit 1
fi

apply_dir() {
  SRC="$1"
  if [ -d "$SRC" ]; then
    echo "[*] Applying host config from $SRC"
    sudo rsync -a "$SRC"/ /
  fi
}

apply_dir "$REPO_DIR/host-config/common"
apply_dir "$REPO_DIR/host-config/$ROLE"

echo "[*] Reloading systemd and networking if needed"
sudo systemctl daemon-reload || true
