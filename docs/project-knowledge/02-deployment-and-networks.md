# Deployment & Networks

This guide explains how the GitOps agent, VPS compose stacks, and network paths deliver production releases. It focuses on compose topology, external entry points, and where network security controls live.

## Device convergence flow

1. `agent/role-agent.sh` runs as a systemd timer on every Pi. Each execution pulls `main`, decrypts any SOPS env files, renders a combined compose project (baseline + role overlay), and keeps health/metrics files in `/var/run/fleet`. Exit codes differentiate inventory issues vs. compose failures for alerting.【F:agent/role-agent.sh†L1-L180】
2. Baseline services include Netdata (host network) and Promtail (journald + Docker tail). Both restart automatically and export health checks (`curl` to `127.0.0.1:19999/health`).【F:baseline/docker-compose.yml†L1-L38】
3. Role overlays mount device-specific hardware and expose control ports:
   - Audio player binds ALSA devices, publishes `:8081`, stores playback state under the `audio_data` volume, and enforces token auth via `AUDIO_CONTROL_TOKEN` when set.【F:roles/audio-player/40-app.yml†L1-L86】
   - HDMI media role runs `media-control` in host network mode for CEC access and expects secrets via plain `.env` or `/etc/fleet/agent.env` (e.g., Zigbee serial path). Additional Zigbee/MQTT containers attach through `roles/hdmi-media/50-zigbee.yml`.【F:roles/hdmi-media/40-app.yml†L1-L23】【F:roles/hdmi-media/README.md†L1-L78】
   - Camera role composes MediaMTX, a libcamera streamer, and the FastAPI control surface, all sharing host network so RTSP/HLS ports stay stable.【F:roles/camera/40-app.yml†L1-L63】

## VPS stack and compose topology

**All services run on VPS-01 (app.headspamartina.hr)**. This includes the Fleet control plane, Icecast/Liquidsoap streaming services, and monitoring stack.

- `infra/vps/compose.fleet.yml` deploys `fleet-api`, `fleet-worker`, `fleet-ui`, `filebrowser`, and `caddy` on an internal bridge network (`br-fleet`). Each service reads from `vps/fleet.env`, mounts configuration (`./config`), and persists SQLite data to the `fleet-data` volume.【F:infra/vps/compose.fleet.yml†L1-L147】
- Published ports:
  - `fleet-api`: host `3005` → container `3015`
  - `fleet-ui`: host `3006` → container `3000`
  - `caddy`: `80/443` for public TLS termination
  - `filebrowser`: no host ports (internal only, accessed via Caddy proxy)
- The `filebrowser` service provides a web-based file manager for operator assets. Files are stored in the `fleet-assets` Docker volume and accessed through `/files` proxied by Caddy. File Browser runs with `--noauth` as authentication is handled at the perimeter (Caddy layer).【F:infra/vps/compose.fleet.yml†L102-L114】
- Caddy routes `/api/*`, `/stream`, `/metrics`, and `/files/*` to their respective services while proxying all other requests to the UI. It preserves incoming Authorization headers when proxying.【F:infra/vps/caddy.fleet.Caddyfile†L1-L36】
- Audio streaming stack (`infra/vps/compose.liquidsoap.yml`) deploys **Icecast** (`:8000`) and **Liquidsoap** (control port `:1234`) on the same VPS-01 host. Liquidsoap streams from the `liquidsoap-music` volume to Icecast mount `/fleet.mp3`. The Fleet API container connects to the `liquidsoap-network` bridge to enable music library upload features.
- Monitoring stack (`infra/vps/compose.prom-grafana-blackbox.yml`) exposes Prometheus (`9090`), Grafana (`3001`), Loki (`3100`), Blackbox (`9115`), and Alertmanager (`9093`). Use `infra/vps/compose.promtail.yml` to ship VPS host logs into the same Loki instance.【F:infra/vps/compose.prom-grafana-blackbox.yml†L1-L55】【F:infra/vps/compose.promtail.yml†L1-L12】

## External networks & access

- **Tailscale-first access** – Inventory and README assume the fleet communicates over a private Tailscale tailnet; expose control ports (8081–8084) only on that network. Prometheus target files expect hostnames such as `pi-audio-01:8081` and should point at Tailscale DNS names where possible.【F:inventory/device-interfaces.yaml†L1-L162】【F:infra/vps/README.md†L33-L62】
- **TLS termination** – Caddy handles HTTPS for `app.headspamartina.hr`. Certificates are provisioned by Caddy’s automatic HTTPS; ensure DNS points to the VPS. API consumers should never bypass Caddy unless performing internal diagnostics.
- **Log + metrics ingress** – Device Promtail pushes to `LOKI_ENDPOINT` defined in `/etc/fleet/agent.env` (default `http://fleet-vps:3100/loki/api/v1/push`). Prometheus scrapes device targets by reading JSON files under `/etc/prometheus/targets/*.json` generated from the inventory registry.【F:baseline/docker-compose.yml†L21-L49】【F:infra/vps/README.md†L33-L74】
- **SSH and acceptance** – The deploy workflow syncs the repo to `/opt/fleet` on the VPS, then runs `scripts/vps-deploy.sh`. Acceptance scripts SSH into devices using hostnames from `ACCEPTANCE_HOSTS`, so keep Tailscale hostnames resolvable and keys in GitHub secrets.【F:scripts/vps-deploy.sh†L1-L120】【F:README.md†L52-L104】

## Operational references

- Secrets + runtime env: maintain `vps/fleet.env` (API/UI tokens, device bearer values, Zigbee credentials) and `infra/vps/monitoring.env` (Grafana credentials).【F:vps/fleet.env.example†L1-L49】【F:infra/vps/README.md†L5-L23】
- Device-specific overrides: populate `/etc/fleet/agent.env` on each Pi with Zigbee serial paths, Loki endpoints, and additional host-level environment values referenced in role overlays.【F:roles/hdmi-media/README.md†L43-L78】
- For rollback, `scripts/vps-deploy.sh` writes state into `.deploy/` and reuses `scripts/vps-rollback.sh` if acceptance fails. Ensure Docker keeps the project name `fleet` so history files line up.【F:scripts/vps-deploy.sh†L1-L200】

See also [14-security-and-auth](./14-security-and-auth.md) for network auth expectations and [13-logs-and-monitoring](./13-logs-and-monitoring.md) for telemetry endpoints.
