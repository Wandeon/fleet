# Fleet (GitOps) - Single Source of Truth and Roadmap

This repository is the authoritative source for managing a Raspberry Pi + VPS fleet using a GitOps model. It defines device roles, services, configuration, secrets handling, monitoring, and operational runbooks. Commit to `main`, and the devices converge to the desired state automatically via the built-in agent.

If you only read one file to understand and operate the system, read this README. It links to all other source files and runbooks where deeper detail is maintained.

## Repository Structure

- `baseline/docker-compose.yml:1` - services that run on every device (e.g., Netdata)
- `roles/<role>/*.yml` - role-specific Docker Compose overlays
  - `roles/audio-player/40-app.yml:1` - Audio playback with fallback and control API
- `inventory/devices.yaml:1` - maps device hostnames to roles
- `inventory/device-interfaces.yaml:1` - single source of truth for control endpoints, monitoring targets, and UI metadata
- `host-config/common:1` - host OS configs (e.g., Docker daemon)
- `host-config/raspi-hifiberry.md:1` - HiFiBerry overlay + ALSA defaults
- `agent/role-agent.sh:1` - convergence agent that applies baseline + role
- `vps/*.yml` - VPS Compose stacks (Icecast, Prometheus, Grafana, Blackbox, etc.)
  - `vps/compose.icecast.yml:1`, `vps/icecast.env.example:1`
  - `vps/compose.prom-grafana-blackbox.yml:1`, `vps/prometheus.yml:1`, `vps/targets-audio.json.example:1`
- `scripts/audioctl.sh:1` - helper CLI to control audio players via API
- `docs/` - runbooks and ADRs
  - `docs/runbooks/provisioning.md:1` - OS + agent provisioning
  - `docs/runbooks/audio.md:1` - audio system: server, playback, API

## GitOps Model

- The agent (`agent/role-agent.sh:1`) runs on each Pi as a systemd timer. It pulls `main`, decrypts role env (SOPS/age), builds a Docker Compose project combining `baseline/` with the mapped role, and brings containers up.
- Inventory drives behavior: `inventory/devices.yaml:1` maps the current hostname to a role.
- Secrets: each role may include `.env.sops.enc` which the agent decrypts at runtime via `SOPS_AGE_KEY_FILE=/etc/fleet/age.key` on the device. Commit only encrypted files.

## Quick Start

- Provision a Pi: follow `docs/runbooks/provisioning.md:1`.
- Assign a role: edit `inventory/devices.yaml:1` and commit to `main`.
- Audio end-to-end: follow `docs/runbooks/audio.md:1`.

## Device Inventory (Current)

- `inventory/devices.yaml:1`
  - `pi-audio-01 -> audio-player` (output-only listener)
  - `pi-audio-02 -> audio-player` (output-only listener)

To add more devices, insert hostnames under `devices:` and set their roles.

## Roles

- Baseline (all devices): `baseline/docker-compose.yml:1`
  - Includes Netdata for local monitoring.
  - Installs and maintains Claude Code CLI plus Slack/Playwright MCP servers (see `docs/runbooks/claude-code.md`).

- Audio player (output-only listener): `roles/audio-player/40-app.yml:1`
  - `audio-player` service: supervises `ffmpeg`, plays stream to ALSA, auto-fallback to local file `/data/fallback.mp3`, then back to stream when healthy.
  - `audio-control` service: HTTP API on `:8081` for control and status, token-auth capable, exposes Prometheus metrics, optional hardware mixer control.
  - Configure via env (use SOPS): `roles/audio-player/.env.example:1`
    - Output: `AUDIO_OUTPUT_DEVICE` (default `plughw:0,0` for HiFiBerry DAC+ Zero)
    - Stream: `STREAM_URL` (or `ICECAST_*` parts)
    - Control: `AUDIO_CONTROL_TOKEN` (Bearer token)
    - Optional hardware mixer: `AUDIO_MIXER_CARD`, `AUDIO_MIXER_CONTROL`

## Audio System Overview (Playback-Only)

- Streaming server (VPS): Icecast stack `vps/compose.icecast.yml:1` (configure `vps/icecast.env:1` from example). Verify at `http://<vps>:8000`. Feed Icecast from a file or any external encoder/source per your setup.
- Player Pi (role `audio-player`): plays from Icecast to ALSA output. Supports automatic fallback and remote control. See `roles/audio-player/README.md:1` and `docs/runbooks/audio.md:1`.

## Control API (audio-player)

- Base URL: `http://<pi>:8081` (restrict to private network/Tailscale; use token).
- Auth: if `AUDIO_CONTROL_TOKEN` is set, include header `Authorization: Bearer <token>`.
- Endpoints:
  - `GET /status` - current config + fallback presence
  - `GET /config`, `PUT /config` - set `stream_url`, `volume` (0.0-2.0), `mode` (`auto`|`manual`), `source` (`stream`|`file`|`stop`)
  - `POST /play` - switch to `stream` or `file`; `POST /stop`
  - `POST /volume` - set software gain
  - `POST /upload` - upload fallback file to `/data/fallback.mp3`
  - `GET /hwvolume`, `POST /hwvolume` - read/set hardware mixer volume via `amixer`
  - `GET /metrics` - Prometheus metrics; `GET /healthz` - liveness
- Helper CLI: `scripts/audioctl.sh:1` (calls API with Bearer token)

## Hardware Notes

- HiFiBerry DAC+ Zero is playback-only (no ADC). Use it with the `audio-player` role. Enable overlay:
  - `/boot/firmware/config.txt`: `dtoverlay=hifiberry-dac` and `dtparam=audio=off` -> reboot.
  - Verify output device with `aplay -l` (typically `hw:0,0`).

## Monitoring (VPS)

- Stack: `vps/compose.prom-grafana-blackbox.yml:1` (Prometheus, Grafana, Blackbox)
- Service-to-service checks should use the container endpoints (`http://prometheus:9090/-/healthy` and `http://blackbox:9115`); host-mapped ports such as `9091` are only for interactive access from the host/browser.
- Prometheus scrape config: `vps/prometheus.yml:1` loads file SD targets from `/etc/prometheus/targets/*.json`.
- Add targets:
  - Audio: `vps/targets-audio.json:1`
  - HDMI/Zigbee: `vps/targets-hdmi-media.json:1`
  - Camera: `vps/targets-camera.json:1`
  These files are generated from the device interface registry—update `inventory/device-interfaces.yaml:1` and run the validation script.
- Dashboard: import `vps/grafana-dashboard-audio.json:1` in Grafana.
- `vps/blackbox.yml` includes a module (`http_any_2xx_3xx_4xx_ok`) that treats 401/404 as success for the rare endpoints that still demand auth; aim Prometheus probes at `/healthz` so they return clean 200s whenever possible.

## Security

- Prefer private networking via Tailscale (PIs join; VPS can also join). Avoid exposing control/API publicly.
- Use `AUDIO_CONTROL_TOKEN` for the control API; include the Bearer header on protected routes (`/status`, `/play`, `/volume`, etc.). `/healthz` is intentionally unauthenticated so probes and Prometheus can reach it without credentials.
- If you expose Icecast to the public internet, ensure strong source/admin passwords and consider rate limiting.

## Operations Cheatsheet

- Start Icecast on VPS:
  - `docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d`
- Provision a Pi: follow `docs/runbooks/provisioning.md:1`.
- Set hostname to match inventory and reboot:
  - `sudo hostnamectl set-hostname pi-audio-01` (or `pi-audio-02`) then `sudo reboot`
- Assign role: edit `inventory/devices.yaml:1` and wait ~2 minutes for convergence.
- Audio player control from VPS:
  - `AUDIOCTL_HOST=<pi-ts> AUDIOCTL_TOKEN=<tok> ./scripts/audioctl.sh status`
  - `... set-url http://<vps>:8000/<mount>` / `... upload fallback.mp3` / `... play file` / `... volume 0.8`
- Monitoring: create `vps/targets-audio.json` and restart Prometheus service from the compose stack.

Tips:
- Containers are project-keyed by commit (no fixed `container_name`). Use filters to inspect:
  - `docker compose ls` and `docker ps | grep audio-`
- Control API health endpoint: `curl -fsS http://<pi>:8081/healthz` (container has an internal healthcheck too).
- Env defaults suppress ICECAST warnings until you configure `STREAM_URL` (or `ICECAST_*`).
- Acceptance check from VPS:
  - `SSH_USER=admin AUDIOCTL_TOKEN=<tok> ICECAST_URL=http://<vps>:8000/<mount> ./scripts/acceptance.sh pi-audio-01 pi-audio-02`
- Prefer Tailscale DNS names (e.g., `pi-audio-01.tailnet.ts.net`) instead of raw IPs when adding Prometheus/Blackbox targets; if an IP must be used, reserve it via Tailscale ACLs so it survives device re-authentication.

## Project Status & Next Steps

- Implemented:
  - GitOps agent and baseline services
  - Audio player role with fallback + control API + metrics + CLI
  - VPS: Icecast; Prometheus + Grafana + Blackbox; sample dashboard
- Current inventory: `pi-audio-01` and `pi-audio-02` assigned to `audio-player`.
- Suggested next steps:
  - Lock down Tailscale ACLs for `:8081` access from the VPS only.
  - Optionally proxy control via the VPS as described in `vps/README.md:1`.

---

Change history and design notes live under `docs/changelog.md:1` and `docs/adr/:1`.
## Unified UI & Hardening

- Reverse proxy (NGINX) with CSP nonce, HSTS preload, WS upgrades: see `vps/nginx.conf`.
- API: Express with validation, rate limits, incident IDs; `/api/health`, `/api/devices`, `/api/logs`, `/api/operations/*`.
- UI: SvelteKit operations dashboard renders all devices declared in `inventory/device-interfaces.yaml`, showing current health, endpoints, and role-specific actions (audio playback, HDMI control, camera probes).
- Monitoring: Prometheus alert rules in `vps/prometheus/alerts.yml` (loaded via `vps/prometheus.yml`).
- Verification: run `scripts/stabilization-verification.ps1`.

## Device Interface Registry

- `inventory/device-interfaces.yaml` drives everything the VPS needs to know about each Raspberry Pi:
  - Control API base URLs (`base_url`, `health_path`, `status_path`, `metrics_path`)
  - Prometheus targets for the monitoring stack
  - UI metadata (display names, grouped operations, slider ranges)
- `scripts/validate-device-registry.mjs` cross-checks the registry with `inventory/devices.yaml` and the Prometheus target files.
- Update this file first when adding a new device; the UI, API, and monitoring stack will consume the new entry automatically.
- See `docs/specs/device-interfaces.md:1` for the schema, examples, and onboarding steps.

### Ops Commands
```bash
cd /opt/app
docker compose up -d --build
./scripts/acceptance.sh pi-audio-01 pi-audio-02
```
