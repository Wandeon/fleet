# Fleet (GitOps) — Single Source of Truth and Roadmap

This repository is the authoritative source for managing a Raspberry Pi + VPS fleet using a GitOps model. It defines device roles, services, configuration, secrets handling, monitoring, and operational runbooks. Commit to `main`, and the devices converge to the desired state automatically via the built‑in agent.

If you only read one file to understand and operate the system, read this README. It links to all other source files and runbooks where deeper detail is maintained.

## Repository Structure

- `baseline/docker-compose.yml:1` — services that run on every device (e.g., Netdata)
- `roles/<role>/*.yml` — role‑specific Docker Compose overlays
  - `roles/audio/40-app.yml:1` — Audio capture/streaming (FFmpeg → Icecast)
  - `roles/audio-player/40-app.yml:1` — Audio playback with fallback and control API
- `inventory/devices.yaml:1` — maps device hostnames to roles
- `host-config/common:1` — host OS configs (e.g., Docker daemon)
- `agent/role-agent.sh:1` — convergence agent that applies baseline + role
- `vps/*.yml` — VPS Compose stacks (Icecast, Prometheus, Grafana, Blackbox, etc.)
  - `vps/compose.icecast.yml:1`, `vps/icecast.env.example:1`
  - `vps/compose.prom-grafana-blackbox.yml:1`, `vps/prometheus.yml:1`, `vps/targets-audio.json.example:1`
- `scripts/audioctl.sh:1` — helper CLI to control audio players via API
- `docs/` — runbooks and ADRs
  - `docs/runbooks/provisioning.md:1` — OS + agent provisioning
  - `docs/runbooks/audio.md:1` — audio system: server, capture, playback, API

## GitOps Model

- The agent (`agent/role-agent.sh:1`) runs on each Pi as a systemd timer. It pulls `main`, decrypts role env (SOPS/age), builds a Docker Compose project combining `baseline/` with the mapped role, and brings containers up.
- Inventory drives behavior: `inventory/devices.yaml:1` maps the current hostname to a role.
- Secrets: each role may include `.env.sops.enc` which the agent decrypts at runtime via `SOPS_AGE_KEY_FILE=/etc/fleet/age.key` on the device. Commit only encrypted files.

## Quick Start

- Provision a Pi: follow `docs/runbooks/provisioning.md:1`.
- Assign a role: edit `inventory/devices.yaml:1` and commit to `main`.
- Audio end‑to‑end: follow `docs/runbooks/audio.md:1`.

## Device Inventory (Current)

- `inventory/devices.yaml:1`
  - `pi-audio-01 → audio-player` (output‑only listener)

To add more devices, insert hostnames under `devices:` and set their roles.

## Roles

- Baseline (all devices): `baseline/docker-compose.yml:1`
  - Includes Netdata for local monitoring.

- Audio capture (stream source): `roles/audio/40-app.yml:1`
  - Container: FFmpeg
  - Captures from ALSA (`/dev/snd`) and streams Opus/Ogg to Icecast.
  - Configure via env (use SOPS): `roles/audio/.env.example:1`
  - Typical variables: `AUDIO_ALSA_DEVICE`, `AUDIO_RATE`, `AUDIO_CHANNELS`, `AUDIO_BITRATE`, `ICECAST_HOST`, `ICECAST_PASSWORD`, `ICECAST_MOUNT`.

- Audio player (output‑only listener): `roles/audio-player/40-app.yml:1`
  - `audio-player` service: supervises `ffmpeg`, plays stream to ALSA, auto‑fallback to local file `/data/fallback.mp3`, then back to stream when healthy.
  - `audio-control` service: HTTP API on `:8081` for control and status, token‑auth capable, exposes Prometheus metrics.
  - Configure via env (use SOPS): `roles/audio-player/.env.example:1`
    - Output: `AUDIO_OUTPUT_DEVICE` (e.g., `hw:0,0` for HiFiBerry DAC+ Zero)
    - Stream: `STREAM_URL` (or `ICECAST_*` parts)
    - Control: `AUDIO_CONTROL_TOKEN` (Bearer token)
    - Optional hardware mixer: `AUDIO_MIXER_CARD`, `AUDIO_MIXER_CONTROL`

## Audio System Overview

- Streaming server (VPS): Icecast stack `vps/compose.icecast.yml:1` (configure `vps/icecast.env:1` from example). Verify at `http://<vps>:8000`.
- Capture Pi (role `audio`): streams to Icecast using FFmpeg; requires an input device (USB sound card or ADC HAT). See `roles/audio/README.md:1` and `docs/runbooks/audio.md:1`.
- Player Pi (role `audio-player`): plays from Icecast to ALSA output. Supports automatic fallback and remote control. See `roles/audio-player/README.md:1` and `docs/runbooks/audio.md:1`.

### Control API (audio-player)

- Base URL: `http://<pi>:8081` (restrict to private network/Tailscale; use token).
- Auth: if `AUDIO_CONTROL_TOKEN` is set, include header `Authorization: Bearer <token>`.
- Endpoints:
  - `GET /status` — current config + fallback presence
  - `GET /config`, `PUT /config` — set `stream_url`, `volume` (0.0–2.0), `mode` (`auto`|`manual`), `source` (`stream`|`file`|`stop`)
  - `POST /play` — switch to `stream` or `file`; `POST /stop`
  - `POST /volume` — set software gain
  - `POST /upload` — upload fallback file to `/data/fallback.mp3`
  - `GET /hwvolume`, `POST /hwvolume` — read/set hardware mixer volume via `amixer`
  - `GET /metrics` — Prometheus metrics; `GET /healthz` — liveness
- Helper CLI: `scripts/audioctl.sh:1` (calls API with Bearer token)

### Hardware Notes

- HiFiBerry DAC+ Zero is playback‑only (no ADC). Use it with the `audio-player` role. For capture, use a USB sound card or ADC HAT. Enable overlay:
  - `/boot/firmware/config.txt`: `dtoverlay=hifiberry-dac` and `dtparam=audio=off` → reboot.
  - Verify output device with `aplay -l` (typically `hw:0,0`).

## Monitoring (VPS)

- Stack: `vps/compose.prom-grafana-blackbox.yml:1` (Prometheus, Grafana, Blackbox)
- Prometheus scrape config: `vps/prometheus.yml:1` loads file SD targets from `/etc/prometheus/targets/audio.json`.
- Add targets: create `vps/targets-audio.json` from `vps/targets-audio.json.example:1` with Pi `:8081` endpoints (reachable over Tailscale).
- Dashboard: import `vps/grafana-dashboard-audio.json:1` in Grafana.

## Security

- Prefer private networking via Tailscale (PIs join; VPS can also join). Avoid exposing control/API publicly.
- Use `AUDIO_CONTROL_TOKEN` for the control API; include Bearer header in all requests.
- If you expose Icecast to the public internet, ensure strong source/admin passwords and consider rate limiting.

## Operations Cheatsheet

- Start Icecast on VPS:
  - `docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d`
- Provision a Pi: follow `docs/runbooks/provisioning.md:1`.
- Assign role: edit `inventory/devices.yaml:1` and wait ~2 minutes for convergence.
- Audio player control from VPS:
  - `AUDIOCTL_HOST=<pi-ts> AUDIOCTL_TOKEN=<tok> ./scripts/audioctl.sh status`
  - `... set-url http://<vps>:8000/<mount>` / `... upload fallback.mp3` / `... play file` / `... volume 0.8`
- Monitoring: create `vps/targets-audio.json` and restart Prometheus service from the compose stack.

## Project Status & Next Steps

- Implemented:
  - GitOps agent and baseline services
  - Audio capture role (FFmpeg → Icecast)
  - Audio player role with fallback + control API + metrics + CLI
  - VPS: Icecast; Prometheus + Grafana + Blackbox; sample dashboard
- Current inventory: `pi-audio-01` assigned to `audio-player`.
- Suggested next steps:
  - Add a capture Pi entry in `inventory/devices.yaml:1` with a unique `ICECAST_MOUNT`.
  - Lock down Tailscale ACLs for `:8081` access from the VPS only.
  - Optionally proxy control via the VPS as described in `vps/README.md:1`.

---

Change history and design notes live under `docs/changelog.md:1` and `docs/adr/:1`.
