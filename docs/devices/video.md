# pi-video-01 — HDMI Media Hub

## Role and Inventory
- **Device ID:** `pi-video-01`
- **Role:** `hdmi-media`
- **Interfaces:** Control API exposed on `http://pi-video-01:8082` with bearer token `HDMI_PI_VIDEO_01_TOKEN`.
- **Inventory reference:** see `inventory/device-interfaces.yaml` for operations, Prometheus targets, and Zigbee pairing helpers.

## Fleet API Contract
All operator controls flow through the Fleet API service. The primary device endpoints are scoped under `/video/devices/{deviceId}`:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/video/devices` | `GET` | Enumerate HDMI endpoints with power, mute, input, volume, and playback state. |
| `/video/devices/{id}/power` | `POST` | Accepts `{ "power": "on" \| "standby" }` and enqueues a HDMI-CEC job. Returns `202` with `jobId`; returns `409` if HDMI-CEC is busy. |
| `/video/devices/{id}/mute` | `POST` | Accepts `{ "mute": boolean }`, queues mute command, responds with `jobId`. |
| `/video/devices/{id}/input` | `POST` | Accepts `{ "input": "HDMI1" \| "HDMI2" \| "CHROMECAST" ... }`. Conflicts produce `409`. |
| `/video/devices/{id}/volume` | `POST` | Accepts `{ "volumePercent": 0-100 }`, clamps and queues job. |
| `/video/devices/{id}/playback` | `POST` | Accepts `{ "action": "play" \| "pause" \| "resume" \| "stop", "url"?: string }` for media control. |

All responses include `jobId` and `accepted: true` upon queuing. Clients must poll `/jobs/{jobId}` (or subscribe to SSE) to observe completion.

## Monitoring & Metrics
- Prometheus scrape targets:
  - `media-control` → `pi-video-01:8082`
  - `zigbee-coordinator` → `pi-video-01:8082`
- Key metrics: `video_device_status{device="pi-video-01"}`, `zigbee_pairing_active`, API HTTP status counts.
- Grafana dashboard should include HDMI-CEC job success, TV power state, input distribution, and pairing status overlays.

## Operational Runbook
- **IF HDMI-CEC busy (API returns 409)** → surface as operator warning, retry after the currently queued job completes. Do **not** reboot; re-attempt once `jobId` completes.
- **IF playback job fails** → inspect `/logs?source=pi-video-01`, regenerate playback command via `/video/devices/{id}/playback` with validated media URL.
- **IF display stays in standby** → verify Zigbee automation didn't override input. Run `/video/devices/{id}/input` to re-select HDMI and reissue power command.
- **Maintenance window only (20:00–08:00):** restarting docker stack or HDMI service must occur outside salon hours to avoid interrupting live TV.

## Maintenance Checklist
1. Confirm bearer token `HDMI_PI_VIDEO_01_TOKEN` present on Fleet API and device.
2. Verify `/video/devices/pi-video-01/power` returns `202` with `jobId` in CI (see acceptance tests).
3. Validate Prometheus targets exist for both `media-control` and `zigbee-coordinator` jobs.
4. Ensure docs and inventory references stay synchronized when coordinator port or credentials change.
