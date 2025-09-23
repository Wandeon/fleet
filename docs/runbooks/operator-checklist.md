# Audio Operations Operator Checklist

This checklist provides day-zero through disaster recovery tasks for the audio playback stack. Cross-reference detailed procedures in [`audio.md`](./audio.md), [`acceptance.md`](./acceptance.md), and [`security.md`](./security.md).

## Day 1: Stand up a new player pair

1. **Provision Raspberry Pis.**
   - Flash Raspberry Pi OS (Bookworm) and boot each unit.
   - Join Tailscale, set hostnames, and install the GitOps agent per [`provisioning.md`](./provisioning.md).
   - Verify the timer:
     ```bash
     sudo systemctl status role-agent.timer
     ```
2. **Assign roles in inventory.**
   - Edit [`inventory/devices.yaml`](../../inventory/devices.yaml):
     ```yaml
devices:
  pi-audio-01:
    role: audio-player
    logs: true
    loki_source: pi-audio-01
  pi-audio-02:
    role: audio-player
    logs: true
    loki_source: pi-audio-02
     ```
   - Commit and push to `main`.
3. **Configure Icecast on the VPS.**
   - Copy env file and start the stack:
     ```bash
     cd /opt/fleet
     cp vps/icecast.env.example vps/icecast.env
     nano vps/icecast.env  # set all passwords
     docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
     docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env ps
     ```
4. **Prepare the audio-player role env.**
   ```bash
   cd roles/audio-player
   cp .env.example .env
   nano .env  # set STREAM_URL, AUDIO_OUTPUT_DEVICE, AUDIO_CONTROL_TOKEN
   sops --encrypt --age <YOUR-AGE-PUBLIC-KEY> .env > .env.sops.enc
   rm .env
   git add .env.sops.enc && git commit && git push
   ```
5. **Upload fallback audio.**
   ```bash
   export AUDIO_TOKEN=<same token as in .env>
   AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh upload media/fallback.mp3
   AUDIOCTL_HOST=pi-audio-02 AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh upload media/fallback.mp3
   ```
6. **Run acceptance tests.**
   ```bash
   SSH_USER=admin AUDIOCTL_TOKEN=${AUDIO_TOKEN} ICECAST_URL=http://<vps-host>:8000/<mount> \
     ./scripts/acceptance.sh --play-both pi-audio-01 pi-audio-02
   ```
   - All checks must return `OK` before moving on.

## Day 2: Routine operations

1. **Monitor dashboards daily.**
   - Open Grafana (`http://<vps-host>:3000`), load `Audio Players` dashboard from `vps/grafana-dashboard-audio.json`.
   - Check Prometheus targets: `docker compose -f vps/compose.prom-grafana-blackbox.yml exec prometheus wget -qO- localhost:9090/targets`.
2. **Rotate API tokens.**
   ```bash
   export NEW_TOKEN=$(openssl rand -hex 16)
   cd roles/audio-player
   sops --decrypt .env.sops.enc | sed "s/^AUDIO_CONTROL_TOKEN=.*/AUDIO_CONTROL_TOKEN=${NEW_TOKEN}/" > .env
   sops --encrypt --age <YOUR-AGE-PUBLIC-KEY> .env > .env.sops.enc
   rm .env
   git commit -am "Rotate audio control token" && git push
   AUDIOCTL_TOKEN=${NEW_TOKEN} ./scripts/audioctl.sh status
   ```
3. **Restart a Pi cleanly.**
   ```bash
   ssh admin@pi-audio-01 'sudo systemctl restart role-agent.service'
   ssh admin@pi-audio-01 'sudo reboot'
   ```
   - Re-run acceptance checks on the rebooted node.
4. **Update the stream URL.**
   ```bash
   AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh set-url http://<vps-host>:8000/new-mount
   AUDIOCTL_HOST=pi-audio-02 AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh set-url http://<vps-host>:8000/new-mount
   ```
   - Confirm via `./scripts/audioctl.sh status` on each Pi.

## Disaster recovery

1. **Reflash a compromised Pi.**
   - Image a fresh SD card, join Tailscale, and re-run the provisioning script.
   - Restore host-specific secrets by copying `/etc/fleet/age.key` from backups.
2. **Restore from repo state.**
   - Verify latest `main` commit contains correct inventory and `.env.sops.enc`.
   - On the Pi:
     ```bash
     sudo rm -rf /opt/fleet
     git clone https://github.com/<org>/fleet.git /opt/fleet
     sudo systemctl start role-agent.service
     ```
3. **Redeploy Icecast.**
   ```bash
   cd /opt/fleet
   docker compose -f vps/compose.icecast.yml down
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
   docker compose -f vps/compose.icecast.yml logs --tail 50
   ```
4. **Validate end-to-end.**
   - Run the acceptance suite with `--play-both`.
   - Check Grafana dashboards for fallback usage spikes.

Document every recovery action in the post-incident report and schedule a follow-up to review [`security.md`](./security.md) controls.
