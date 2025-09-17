# Provisioning Runbook (Base OS → Fleet)

1) Flash Raspberry Pi OS Lite (Bookworm) to SD card.
2) Boot, login, update packages:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl docker.io docker-compose-plugin tailscale sops jq alsa-utils
   ```
2.1) Set the hostname to match `inventory/devices.yaml` and reboot:
   ```bash
   # Choose one hostname listed in inventory, e.g. pi-audio-01 or pi-audio-02
   sudo hostnamectl set-hostname pi-audio-01
   sudo reboot
   ```
3) Join Tailscale:
   ```bash
   sudo tailscale up --authkey <YOUR-PREAUTH-KEY>
   ```
4) Place AGE key:
   ```bash
   sudo mkdir -p /etc/fleet
   sudo nano /etc/fleet/age.key  # paste your private age key
   sudo chmod 600 /etc/fleet/age.key
   ```
5) Clone fleet repo and enable agent timer:
   ```bash
   sudo mkdir -p /opt && cd /opt
   sudo git clone https://github.com/<your-org>/fleet.git
   sudo cp /opt/fleet/agent/role-agent.service /etc/systemd/system/
   sudo cp /opt/fleet/agent/role-agent-watchdog.service /etc/systemd/system/
   sudo cp /opt/fleet/agent/role-agent-watchdog.timer /etc/systemd/system/
   sudo cp /opt/fleet/agent/role-agent-healthcheck.service /etc/systemd/system/
   sudo cp /opt/fleet/agent/role-agent-healthcheck.timer /etc/systemd/system/
   sudo cp /opt/fleet/agent/role-agent.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now role-agent.timer role-agent-watchdog.timer role-agent-healthcheck.timer
   ```

   If you created the files manually or copied them from a Windows host, ensure the agent script is executable (or rely on the updated service that invokes bash explicitly):
   ```bash
   sudo chmod +x /opt/fleet/agent/role-agent.sh || true
   ```

   Verify the unit uses bash to execute the agent (avoids execute‑bit issues):
   ```bash
   systemctl cat role-agent.service | grep -F "ExecStart=/usr/bin/env bash" -n || true
   ```
6) Enable watchdog protections:
   ```bash
   cd /opt/fleet
   sudo ./scripts/setup-watchdogs.sh
   sudo systemctl list-timers "role-agent*"
   sudo systemctl status watchdog --no-pager
   ```
7) Assign a role in `inventory/devices.yaml` and commit to `main`.
8) Confirm convergence in ~2 minutes (Netdata, Uptime Kuma, Docker containers running).

## Role-specific prep

- **camera**: enable the CSI camera interface with `sudo raspi-config nonint do_camera 0` and set GPU memory to 256 MB before first convergence.
- **hdmi-media**: identify the Zigbee coordinator serial port (`ls /dev/ttyACM*`) and update `roles/hdmi-media/.env.sops.enc` (MQTT credentials, PAN IDs, network key).



