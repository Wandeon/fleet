# Settings & Configuration Surfaces

Operators configure Fleet through UI settings, API environment files, and device agent env vars. This guide consolidates those touchpoints.

## UI settings page (`/settings`)

- Current UI renders mocked fields: API bearer token, proxy timeout (ms), debug logging toggle, device scan interval, max retries, and system info (version/build/env/uptime). Changes trigger `restartRequired` banner and save status toasts.【F:apps/ui/src/routes/settings/+page.svelte†L1-L140】
- When backend endpoints exist, map fields to:
  - API bearer token → persisted in secure server storage (`vps/fleet.env` or secret manager) and reloaded by SSR proxy. 
  - Proxy timeout → update `proxyFleetRequest` timeout configuration or store in control plane for future use.【F:apps/ui/src/lib/server/proxy.ts†L59-L103】
  - Debug logging toggle → flips structured log level (`LOG_LEVEL`) or enables verbose metrics. Ensure change triggers redeploy or hot reload.
- Read-only device scan and retry fields hint at backend scheduler values; expose actual data once inventory polling service is implemented.

## VPS configuration (`vps/fleet.env`)

Key variables driving production stack:【F:vps/fleet.env.example†L1-L49】

| Category | Variables | Notes |
| --- | --- | --- |
| Database/API | `DATABASE_URL`, `PORT`, `NODE_ENV` | SQLite path relative to container (`/app/data`). |
| Device registry | `DEVICES_FILE` | Path to JSON registry consumed by API/worker. |
| Auth | `API_BEARER`, `AUTH_USERS`, `AUTH_SESSION_TTL`, `AUTH_COOKIE_NAME`, `SESSION_SECRET` | Keep secrets unique per environment; set `AUTH_COOKIE_SECURE=true` behind HTTPS. |
| Device tokens | `HDMI_PI_VIDEO_01_TOKEN`, `CAMERA_PI_CAMERA_01_TOKEN`, `AUDIO_PI_AUDIO_0*_TOKEN` | Required for upstream proxy. |
| Zigbee/MQTT | `MQTT_URL`, `ZIGBEE_MQTT_PREFIX`, `ZIGBEE_PERMIT_JOIN_SECONDS` | Mirror with `/etc/fleet/agent.env` on Pi. |
| UI runtime | `ORIGIN`, `FLEET_API_BASE`, `API_BASE_URL`, `VITE_API_BASE`, `VITE_USE_MOCKS` | Set `VITE_USE_MOCKS=0` in production. |
| Monitoring | `PROM_URL`, `BLACKBOX_URL` | Control plane health checks. |
| Logging | `FLEET_LOG_FILE` | Optional file sink. |

## Device agent env (`/etc/fleet/agent.env`)

- Defines shared variables exported before compose (e.g., `LOKI_ENDPOINT`, `LOG_SITE`, `LOG_ENVIRONMENT`, Zigbee serial/credentials). Required for Promtail shipping and Zigbee stack stability.【F:baseline/docker-compose.yml†L21-L49】【F:roles/hdmi-media/README.md†L35-L78】
- Keep permissions restricted (0600) since tokens may be stored in plain text when sops disabled.

## Role-specific env

- `roles/audio-player/.env.sops.enc` – `AUDIO_OUTPUT_DEVICE`, `STREAM_URL`/`ICECAST_*`, `AUDIO_CONTROL_TOKEN`, mixer options.【F:roles/audio-player/README.md†L10-L36】
- `roles/hdmi-media/.env` – `MEDIA_CONTROL_TOKEN`, `HDMI_CONNECTOR`, `CEC_DEVICE_INDEX`, Zigbee credentials (if not in agent env). Ensure both container and systemd units share the same defaults.【F:roles/hdmi-media/README.md†L1-L78】
- `roles/camera/.env.sops.enc` – `CAMERA_RTSP_URL`, `CAMERA_HLS_URL`, resolution/bitrate parameters, `CAMERA_CONTROL_TOKEN`.【F:roles/camera/README.md†L15-L36】

## Proxy behavior

- `/ui/*` proxy uses env values from UI server (`FLEET_API_BASE`, `API_BEARER`, `VITE_USE_MOCKS`). When mocks disabled, ensure tokens are valid and network path reachable. Errors propagate with JSON bodies for UI to display.【F:apps/ui/src/lib/server/proxy.ts†L1-L87】
- Settings changes should trigger UI message prompting restart (as mocked) to re-read env values. Build backend endpoint to persist modifications and redeploy stack.

Cross-reference [14-security-and-auth](./14-security-and-auth.md) for credential handling and [02-deployment-and-networks](./02-deployment-and-networks.md) for compose context.
