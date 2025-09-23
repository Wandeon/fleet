# Audio Player Operations Runbook

Follow this runbook to deliver Icecast audio to Raspberry Pi players running the `audio-player` role defined in [`roles/audio-player/40-app.yml`](../../roles/audio-player/40-app.yml).

- Streaming server: Icecast stack on the VPS (`vps/compose.icecast.yml`).
- Player devices: Raspberry Pi units with HiFiBerry (or any ALSA output) converged by the GitOps agent.
- Control surface: HTTP API on each Pi (`:8081`) plus the helper CLI (`scripts/audioctl.sh`).
- Monitoring: Prometheus targets (`vps/targets-audio.json`) and Grafana dashboard (`vps/grafana-dashboard-audio.json`).

Complete all sections in order. Each command is copy/paste ready.

## 1. Provision Icecast on the VPS

1. SSH to the VPS that hosts Docker.
2. Copy the Icecast environment template and set strong credentials:
   ```bash
   cd /opt/fleet   # adjust to the repo checkout path on the VPS
   cp vps/icecast.env.example vps/icecast.env
   chmod 600 vps/icecast.env
   nano vps/icecast.env
   # Set ICECAST_SOURCE_PASSWORD, ICECAST_ADMIN_PASSWORD, ICECAST_RELAY_PASSWORD, ICECAST_OPTS
   ```
3. Launch Icecast with Docker Compose:
   ```bash
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env ps
   ```
4. Confirm the listener interface is reachable (replace `<vps-host>` as needed):
   ```bash
   curl -fsI http://<vps-host>:8000/
   ```
5. Record the source password for later use in encoders and in `roles/audio-player/.env`.
6. Tail logs if troubleshooting: `docker compose -f vps/compose.icecast.yml logs -f icecast`.

## 2. Prepare Raspberry Pi audio hardware

### Enable the HiFiBerry DAC overlay

1. SSH to each Pi and edit the boot config:
   ```bash
   sudo tee -a /boot/firmware/config.txt <<'EOF'
dtoverlay=hifiberry-dac
dtparam=audio=off
EOF
   sudo reboot
   ```
   (For other HATs, adapt the overlay per [`host-config/raspi-hifiberry.md`](../../host-config/raspi-hifiberry.md).)

2. Install ALSA utilities and verify the card enumerates:
   ```bash
   sudo apt-get update
   sudo apt-get install -y alsa-utils
   aplay -l
   # Expect the HiFiBerry card as hw:0,0 or similar
   ```

### Confirm the GitOps agent is installed

Provision the Pi per [`docs/runbooks/provisioning.md`](./provisioning.md). Ensure the agent service is active:
```bash
sudo systemctl status role-agent.timer
sudo journalctl -u role-agent.service -b
```

## 3. Configure the `audio-player` role

1. On your workstation (repository checkout), prepare the role environment:
   ```bash
   cd roles/audio-player
   cp .env.example .env
   nano .env
   # Set AUDIO_OUTPUT_DEVICE=plughw:0,0 (or your ALSA device)
   # Set STREAM_URL=http://<vps-host>:8000/<mount> (or use ICECAST_* variables)
   # Set AUDIO_CONTROL_TOKEN=<generate-a-strong-token>
   ```
2. Encrypt the environment file for the GitOps agent:
   ```bash
   sops --encrypt --age <YOUR-AGE-PUBLIC-KEY> .env > .env.sops.enc
   rm .env
   git add .env.sops.enc
   ```
3. Map devices to the audio role in [`inventory/devices.yaml`](../../inventory/devices.yaml). Example:
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
4. Commit and push the changes to `main`. The convergence agent (`agent/role-agent.sh`) will pull, decrypt `.env.sops.enc`, and deploy `roles/audio-player/40-app.yml` on each Pi.
5. Watch convergence on a Pi:
   ```bash
   ssh admin@pi-audio-01
   docker ps --format 'table {{.Names}}\t{{.Status}}'
   # Expect audio-player and audio-control containers running
   ```

## 4. Control API operations (`:8081`)

Set the base URL and token for commands:
```bash
export PI_HOST=pi-audio-01    # or Tailscale name/IP
export AUDIO_TOKEN=<same-token-as-in-.env>
```

### `/status`
- Inspect current config, fallback status, and playback source.
```bash
curl -sS -H "Authorization: Bearer ${AUDIO_TOKEN}" http://${PI_HOST}:8081/status | jq
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh status
```

### `/play`
- Force playback source (`stream`, `file`). Optional `mode` key switches between `auto` and `manual`.
```bash
curl -sS -X POST -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUDIO_TOKEN}" \
  -d '{"source":"stream"}' http://${PI_HOST}:8081/play
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh play stream
```

### `/stop`
- Halt playback.
```bash
curl -sS -X POST -H "Authorization: Bearer ${AUDIO_TOKEN}" http://${PI_HOST}:8081/stop
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh stop
```

### `/volume`
- Set software gain (0.0–2.0).
```bash
curl -sS -X POST -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUDIO_TOKEN}" \
  -d '{"volume":0.8}' http://${PI_HOST}:8081/volume
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh volume 0.8
```

### `/config`
- Update multiple fields (stream URL, mode, source, volume) in one call.
```bash
curl -sS -X PUT -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUDIO_TOKEN}" \
  -d '{"stream_url":"http://<vps-host>:8000/<mount>","mode":"auto","source":"stream"}' \
  http://${PI_HOST}:8081/config | jq
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh set-url http://<vps-host>:8000/<mount>
```

### `/upload`
- Upload (or replace) the fallback file at `/data/fallback.mp3`.
```bash
curl -sS -H "Authorization: Bearer ${AUDIO_TOKEN}" \
  -F "file=@/path/to/fallback.mp3" http://${PI_HOST}:8081/upload | jq
AUDIOCTL_HOST=${PI_HOST} AUDIOCTL_TOKEN=${AUDIO_TOKEN} ./scripts/audioctl.sh upload /path/to/fallback.mp3
```

### `/metrics` and `/healthz`
- Health probe (`/healthz`) is unauthenticated.
- Metrics expose Prometheus gauges (`audio_volume`, `audio_fallback_exists`, `audio_source_state`).
```bash
curl -fsS http://${PI_HOST}:8081/healthz
curl -fsS -H "Authorization: Bearer ${AUDIO_TOKEN}" http://${PI_HOST}:8081/metrics
```

## 5. Fallback upload procedure

1. Prepare a looping-safe MP3 (e.g., a 10-minute music bed).
2. Upload via API as shown above.
3. Verify the fallback exists:
   ```bash
   curl -sS -H "Authorization: Bearer ${AUDIO_TOKEN}" http://${PI_HOST}:8081/status | jq '.fallback_exists'
   ```
4. Test failover by forcing fallback playback, then restoring auto mode:
   ```bash
   curl -sS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer ${AUDIO_TOKEN}" \
     -d '{"source":"file","mode":"manual"}' http://${PI_HOST}:8081/play
   curl -sS -X PUT -H 'Content-Type: application/json' -H "Authorization: Bearer ${AUDIO_TOKEN}" \
     -d '{"mode":"auto","source":"stream"}' http://${PI_HOST}:8081/config
   ```

## 6. Monitoring and Grafana

1. Declare control endpoints in [`inventory/device-interfaces.yaml`](../../inventory/device-interfaces.yaml) if onboarding new devices.
2. Update Prometheus file-based discovery on the VPS (`vps/targets-audio.json`):
   ```json
   [
     { "targets": ["pi-audio-01:8081"], "labels": {"role": "audio-player", "instance": "pi-audio-01"} },
     { "targets": ["pi-audio-02:8081"], "labels": {"role": "audio-player", "instance": "pi-audio-02"} }
   ]
   ```
3. Redeploy Prometheus to pick up the targets:
   ```bash
   docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus
   docker compose -f vps/compose.prom-grafana-blackbox.yml logs --tail 20 prometheus
   ```
4. Each player’s `/metrics` endpoint now exposes:
   - `audio_volume`
   - `audio_fallback_exists`
   - `audio_source_state{source="stream"|"file"|"stop"}`
5. Import `vps/grafana-dashboard-audio.json` into Grafana. Suggested panels:
   - **Now playing source**: `audio_source_state{source="stream"}` (stat panel per instance).
   - **Fallback presence**: `audio_fallback_exists` (threshold alert when `0`).
   - **Volume**: `audio_volume` (time series for drift detection).
6. Add alerts in `vps/prometheus/alerts.yml` if the stream stays on fallback or stop for more than a defined interval.

## 7. Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `401 unauthorized` on API calls | Confirm `AUDIO_CONTROL_TOKEN` is set in `roles/audio-player/.env.sops.enc`. Include `Authorization: Bearer <token>` in every request except `/healthz`. Test with `AUDIOCTL_TOKEN` exported. |
| `aplay -l` shows no cards | Re-run the HiFiBerry overlay steps, ensure the DAC is seated, and reboot. Verify the `audio` group exists and the container has `/dev/snd`. |
| Icecast mount unreachable | Check the VPS: `docker compose -f vps/compose.icecast.yml ps`. Validate firewalls (only port 8000 needs to be exposed), and ensure your encoder is pushing audio using the correct source password. |
| Player stuck on fallback | Inspect logs: `ssh admin@pi-audio-01 'docker logs --tail 100 $(docker ps -q --filter name=audio-player)'`. Confirm the stream URL resolves from the Pi and that Icecast is emitting audio. |
| Metrics missing in Prometheus | Ensure `targets-audio.json` contains the Pi hostname or Tailscale IP and that Prometheus was reloaded. Hit `http://<vps>:9090/targets` to verify the new scrape target. |

## 8. Validate end-to-end

Run the acceptance checks once both Pis are converged (see [`acceptance.md`](./acceptance.md)):
```bash
SSH_USER=admin AUDIOCTL_TOKEN=${AUDIO_TOKEN} ICECAST_URL=http://<vps-host>:8000/<mount> \
  ./scripts/acceptance.sh --play-both pi-audio-01 pi-audio-02
```
Success criteria: both players report healthy control APIs, ALSA devices, and successful playback toggles.

## 9. Ongoing operations

- Keep `AUDIO_CONTROL_TOKEN` secret; rotate routinely (see [`security.md`](./security.md)).
- Monitor Grafana dashboards daily and alert on fallback usage.
- Use [`operator-checklist.md`](./operator-checklist.md) for Day 1/Day 2 workflows and disaster recovery procedures.
