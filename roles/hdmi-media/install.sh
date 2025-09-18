#!/usr/bin/env bash
set -euo pipefail

ROLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sudo apt update
sudo apt install -y mpv v4l-utils python3 python3-pip
sudo install -m 0644 "${ROLE_DIR}/etc-default-hdmi-media" /etc/default/hdmi-media

echo "Install complete. Optional: enable systemd units:"
echo "  sudo cp ${ROLE_DIR}/systemd/mpv-hdmi@.service /etc/systemd/system/"
echo "  sudo cp ${ROLE_DIR}/systemd/cec-setup.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now mpv-hdmi@hdmi.service"
