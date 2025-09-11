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
   sudo cp /opt/fleet/agent/role-agent.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now role-agent.timer
   ```
6) Assign a role in `inventory/devices.yaml` and commit to `main`.
7) Confirm convergence in ~2 minutes (Netdata, Uptime Kuma, Docker containers running).
