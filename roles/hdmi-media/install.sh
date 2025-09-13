#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt install -y mpv v4l-utils python3 python3-pip

echo "Install complete. Optional: enable systemd units:"
echo "  sudo cp roles/hdmi-media/systemd/mpv-hdmi@.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now mpv-hdmi@hdmi.service"

