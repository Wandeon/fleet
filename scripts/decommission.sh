#!/usr/bin/env bash
set -euo pipefail

echo "[*] Stopping all containers..."
docker ps -q | xargs -r docker stop

echo "[*] Removing all containers and volumes..."
docker ps -aq | xargs -r docker rm -f
docker volume ls -q | xargs -r docker volume rm

echo "[*] Leaving Tailscale..."
sudo tailscale logout || true

echo "[*] Powering down in 10 seconds (Ctrl+C to abort)..."
sleep 10
sudo poweroff
