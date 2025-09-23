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
4.5) Configure host overrides that the agent exports before composing (log shipper, site tags, etc.):
   ```bash
   sudo tee /etc/fleet/agent.env >/dev/null <<'EOF'
   # Loki push endpoint reachable from this node (Tailscale DNS or IP)
   LOKI_ENDPOINT=http://fleet-vps:3100/loki/api/v1/push
   # Optional site/region tag that flows into log labels
   LOG_SITE=main
   EOF
   ```
   Replace `fleet-vps` with the hostname or IP your nodes use to reach the central Loki service.
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
   sudo systemctl enable --now role-agent.timer
   ```

   The convergence timer above is the only unit enabled automatically. When
   you're ready for the optional watchdog + healthcheck loops, turn them on
   explicitly (the agent will respect your choice and leave them disabled until
   you re-enable them):

   ```bash
   sudo systemctl enable --now role-agent-watchdog.timer role-agent-healthcheck.timer
   ```

   If you created the files manually or copied them from a Windows host, ensure the agent script is executable (or rely on the updated service that invokes bash explicitly):
   ```bash
   sudo chmod +x /opt/fleet/agent/role-agent.sh || true
   ```

   Verify the unit uses bash to execute the agent (avoids execute‑bit issues):
   ```bash
   systemctl cat role-agent.service | grep -F "ExecStart=/usr/bin/env bash" -n || true
   ```
6) Enable watchdog protections (optional but recommended once the node is in
   steady state):
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
- **hdmi-media**: record the `/dev/serial/by-id/...` path for the coordinator, add it to `/etc/fleet/agent.env` as `ZIGBEE_SERIAL`, and define `ZIGBEE_MQTT_USER`/`ZIGBEE_MQTT_PASSWORD` so Mosquitto can build its password file. Update `roles/hdmi-media/.env` (or decrypt `.env.sops.enc`) for network keys and other Zigbee2MQTT settings.
- **audio-player**: follow [`docs/runbooks/audio.md`](./audio.md) to enable the HiFiBerry
  overlay, configure Icecast credentials, and operate the control API.



