# Health Overview

Health reporting spans API endpoints, device `/healthz` checks, and Prometheus metrics. This document summarises how to inspect overall system health.

## API health endpoints

| Endpoint                    | Description                                                                                     | Notes                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/api/healthz`              | Container liveness; no auth required.                                                           | Used by Caddy and deploy pipeline.                                                                                     |
| `/api/readyz`               | Ensures device registry loads; returns success once cached.                                     | Run after deploy to confirm registry access.【F:apps/api/README.md†L12-L36】                                           |
| `/api/health/summary`       | Aggregates module status, actively probing audio devices and listing unknown states for others. | UI should interpret `devices` array per module and display unknown as grey.!【F:apps/api/src/routes/health.ts†L1-L42】 |
| `/api/health/events/recent` | Returns recent fleet events (commands, failures) with optional `limit` (1–200).                 | Feed into activity feed/alerts.【F:apps/api/src/routes/health.ts†L44-L59】                                             |

## Device health probes

- Audio: `GET http://<pi>:8081/healthz` (no auth). Health check ensures `status.json` freshness.
- Video: `GET http://<pi>:8082/healthz` (requires token). Should include mpv/CEC status.
- Camera: `GET http://<pi>:8083/healthz` verifies RTSP/HLS availability.
- Zigbee: Expose future health endpoint via `zigbee2mqtt` or dedicated exporter; currently rely on service logs.【F:inventory/device-interfaces.yaml†L1-L162】【F:roles/audio-player/40-app.yml†L1-L86】【F:roles/camera/README.md†L1-L40】

Prometheus scrapes these endpoints based on targets defined in `infra/vps/targets-*.json`; update files whenever inventory changes.【F:infra/vps/README.md†L33-L74】

## UI signals

- Dashboard header should reflect `/api/health/summary` status (resolve audit issue where banner shows `Offline · 0 ms`).
- Recent errors/event feed should ingest `/api/health/events/recent` to surface command failures, circuit breaker opens, or job retries.
- `/health` route must render per-module tiles summarizing `total` vs. `online` counts along with failure reasons from the API response. Current implementation returns 500; fix by wiring to `/ui/health/summary` proxy and handling unknown modules gracefully.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】

### Audio quick triage

When troubleshooting audio playback issues, follow this sequence:

1. **Control plane health**: Check `/api/health/summary` → `modules[].module == "audio"` → verify `online` count matches `total`
2. **Device health probe**: Each audio device exposes `/healthz` (no auth) → should return `ok` within 1s
3. **Stream status**: Query Prometheus `audio_stream_up{instance="pi-audio-XX"}` → `1` means streaming, `0` means fallback/stopped
4. **Fallback readiness**: Check Prometheus `audio_fallback_exists{instance="pi-audio-XX"}` → `1` means safety file uploaded
5. **Icecast connectivity**: From VPS-01, `curl -s http://icecast:8000/status-json.xsl | jq '.icestats.source.listeners'` → confirms stream mount active
6. **Device config verification**: Use device `/config` endpoint to confirm `stream_url` is set to `http://icecast:8000/fleet.mp3`

**Common failure modes**:
- Device reports `stream_up: 0` + `fallback_active: 1` → Icecast unreachable or mount down; check VPS-01 Icecast container logs
- Device `/healthz` timeout → Tailscale network issue or device offline; verify Tailscale status on Pi
- Device `stream_url` misconfigured → Update via `/config` PUT endpoint with full URL including mount point

## Monitoring integration

- Prometheus metrics `upstream_device_failures_total`, `circuit_breaker_state`, and `jobs_fail` highlight systemic issues; combine with Blackbox checks (e.g., `http://pi-audio-01:8081/healthz`).【F:apps/api/ARCHITECTURE.md†L27-L49】【F:infra/vps/compose.prom-grafana-blackbox.yml†L1-L55】
- Alertmanager should fire Slack notifications when health metrics degrade; ensure rules consider circuit breakers and agent failures.

## Operational checklist

1. After deploy, hit `/api/healthz`, `/api/readyz`, `/api/health/summary`, and `/api/health/events/recent`.
2. Verify Grafana dashboards show expected device counts and no stale timestamps.
3. Investigate any unknown/offline devices by querying logs (`/api/logs` or Loki) with matching `deviceId`.
4. Update this doc when new modules (e.g., automation health) ship.

See [13-logs-and-monitoring](./13-logs-and-monitoring.md) for observability details and [15-error-recovery](./15-error-recovery.md) for remediation steps.
