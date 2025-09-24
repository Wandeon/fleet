# Architecture Overview

The Fleet platform combines a GitOps-managed device fleet, a control-plane API, and a SvelteKit UI served from the VPS stack. This document summarizes how the UI, API, workers, and device roles fit together along with the shared observability plane.

## System map

| Layer | Components | Responsibilities | Production Deployment |
| --- | --- | --- | --- |
| Control plane | `apps/api` (Express API), worker queue executor | Authenticate operators via bearer token, proxy device commands with retry/circuit breaker, persist jobs/events, emit metrics/logs | Runs in `infra/vps/compose.fleet.yml` as `fleet-api` and `fleet-worker`, backed by SQLite volume `fleet-data`【F:infra/vps/compose.fleet.yml†L1-L63】 |
| Operator experience | `apps/ui` SvelteKit app | Provides dashboard, module views (`/audio`, `/video`, `/zigbee`, `/camera`, `/fleet`, `/logs`, `/settings`), proxies `/ui/*` requests to the API with correlation IDs | Deployed as `fleet-ui` container behind Caddy reverse proxy, SSR fetches target `http://fleet-api:3015` with bearer token【F:infra/vps/compose.fleet.yml†L64-L90】【F:infra/vps/caddy.fleet.Caddyfile†L1-L22】 |
| Device agents | `agent/role-agent.sh`, baseline compose, role overlays | GitOps convergence: pull `main`, decrypt env, compose baseline services (Netdata, Promtail) plus role-specific stack | Installed on each Pi; composes `baseline/docker-compose.yml` with `roles/<role>/*.yml`, writes health to `/var/run/fleet/health.json` and metrics for Prometheus scraping【F:baseline/docker-compose.yml†L1-L49】【F:agent/role-agent.sh†L1-L180】 |
| Device roles | Audio (`roles/audio-player`), HDMI/Zigbee (`roles/hdmi-media`), Camera (`roles/camera`) | Provide local control APIs (`:8081`, `:8082`, `:8083`), playback, Zigbee coordinator, camera streaming | Converged per host defined in `inventory/devices.yaml`; each role exposes Prometheus metrics and `/healthz` probes defined in the overlay compose files【F:roles/audio-player/40-app.yml†L1-L86】【F:roles/hdmi-media/40-app.yml†L1-L23】【F:roles/camera/40-app.yml†L1-L63】 |
| Observability | Prometheus, Grafana, Loki, Blackbox | Scrape fleet metrics, ship logs, expose alerting via Slack webhook | Operated via `infra/vps/compose.prom-grafana-blackbox.yml` and `infra/vps/compose.promtail.yml`; device Promtail forwards to VPS Loki endpoint configured in `/etc/fleet/agent.env`【F:infra/vps/compose.prom-grafana-blackbox.yml†L1-L55】【F:infra/vps/compose.promtail.yml†L1-L12】 |

## Data flow highlights

1. **UI to API** – Browser requests hit Caddy (`app.headspamartina.hr`), which proxies `/api/*` and `/metrics` to the API container and all other routes to the UI server. The UI’s server-side handlers reuse `FLEET_API_BASE` and inject `Authorization: Bearer <API_BEARER>` before forwarding to the API (`proxyFleetRequest`).【F:infra/vps/caddy.fleet.Caddyfile†L1-L22】【F:apps/ui/src/lib/server/proxy.ts†L1-L87】 
2. **API to devices** – API routes resolve device metadata from the registry, forward commands to the device control APIs over HTTP with 3s timeout, exponential retry, and circuit breaker instrumentation. Commands and configuration writes record structured events for `/health/events/recent` and `/logs` streaming.【F:apps/api/src/routes/audio.ts†L1-L121】【F:apps/api/ARCHITECTURE.md†L5-L49】 
3. **Workers** – Background executor polls pending jobs (e.g., TV CEC commands), posts to device control endpoints with bearer tokens, and updates status/metrics while closing circuit breakers on success.【F:apps/api/src/workers/executor.ts†L1-L67】 
4. **Agents to control plane** – `role-agent.sh` records convergence health files, metrics, and JSON logs; Promtail ships device logs to the VPS Loki instance for UI consumption on the `/logs` page and Grafana dashboards.【F:agent/role-agent.sh†L1-L180】【F:baseline/docker-compose.yml†L21-L49】 

## Inventories & registry

- The canonical device list lives in `inventory/devices.yaml`; each entry pins `role`, logging flags, and Loki source labels consumed by the UI and monitoring pipelines.【F:inventory/devices.yaml†L1-L13】 
- Detailed control metadata (API URLs, operations, Prometheus targets) is defined in `inventory/device-interfaces.yaml` and transformed into Prometheus target files under `infra/vps/` plus UI actions.【F:inventory/device-interfaces.yaml†L1-L162】 
- `vps/fleet.env.example` enumerates runtime secrets and tokens that the VPS stack expects; update this template when adding new services or device credentials.【F:vps/fleet.env.example†L1-L49】 

## Where to dive deeper

- Deployment specifics → [02-deployment-and-networks](./02-deployment-and-networks.md)
- API contract → [04-api-surface](./04-api-surface.md)
- Device role operations → [09-audio-operations](./09-audio-operations.md), [10-video-operations](./10-video-operations.md), [11-camera-operations](./11-camera-operations.md), [12-zigbee-operations](./12-zigbee-operations.md)
- Observability → [13-logs-and-monitoring](./13-logs-and-monitoring.md)
