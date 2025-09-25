# Device Detail Pages

The `/fleet/:id` route provides per-device diagnostics, actions, and log summaries. This guide documents expected data, actions, and future enhancements.

## Current UI implementation

- `src/routes/fleet/[id]/+page.svelte` loads device data (currently mock) and renders header with breadcrumb, status pill, role tag, and quick action buttons (Restart, Resync, Download Logs). Actions currently use mock promises; replace with API calls when backend endpoints exist.【F:apps/ui/src/routes/fleet/[id]/+page.svelte†L1-L120】
- Status card displays connection state, last seen, IP, uptime, version, module, and capability badges. Recent logs list timestamp/level/message, color-coded per severity. Quick actions panel includes health check, sync, and playlist shortcuts (mock).【F:apps/ui/src/routes/fleet/[id]/+page.svelte†L60-L160】
- Logs export builds text file from `device.logs`; when wired to real API, source log data from `/api/logs` filtered by device/correlation ID.

## Expected data contract

| Field | Source | Notes |
| --- | --- | --- |
| `status` (`online`/`offline`/`error`) | `/api/fleet/state` / `/api/<module>/<id>/status` | Use API status endpoints for precise reason codes.【F:apps/api/src/routes/audio.ts†L44-L117】【F:apps/api/src/routes/video.ts†L30-L70】 |
| `lastSeen` | Device control API (status payload) | Format relative (“5m ago”). |
| `ipAddress` | Inventory metadata or device registry | Extend `inventory/device-interfaces.yaml` to include network info if needed.【F:inventory/device-interfaces.yaml†L1-L162】 |
| `uptime` / `version` | Device status JSON or agent health file | Derive from `/data/status.json` for audio or future telemetry. |
| `capabilities` | Device registry `capabilities` array | Already defined in inventory for audio/video/camera operations.【F:inventory/device-interfaces.yaml†L1-L162】 |
| `logs` | `/api/logs` filtered by deviceId | Replace mock array with API response once query support implemented.【F:apps/api/src/routes/logs.ts†L1-L107】 |

## Actions mapping

| UI Action | Target API | Notes |
| --- | --- | --- |
| Restart device | Future endpoint (e.g., `/api/devices/{id}/jobs/restart`) | Enqueue job through worker; capture in `/health/events`. |
| Resync | Audio: `POST /audio/{id}/play` with current source; Zigbee/video: job queue. | Provide confirmation + correlation ID. |
| Health check | `GET /<module>/<id>/status` or `/healthz` | Display result inline with timestamp. |
| Download logs | Generate zipped logs from Loki or `/api/logs` query; include correlation IDs. |

## Enhancements to deliver

- Replace mock loader with server `load` function that fetches `/ui/fleet/state` for SSR data + `/ui/<module>/<id>/status` on demand. Use SvelteKit `load` + `parent()` data to reuse layout metadata.
- Surface Prometheus metrics summaries (e.g., last `audio_stream_up` change) and link to Grafana dashboards.
- Include device interface info (control API URL, operations) with quick links to run commands from UI using inventory definitions.
- Persist action outcomes with toasts and append to recent logs list (leveraging `/health/events/recent`).

Coordinate with [06-device-inventory](./06-device-inventory.md) to ensure UI references match inventory records and with [15-error-recovery](./15-error-recovery.md) for post-action troubleshooting guidance.
