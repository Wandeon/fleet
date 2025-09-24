# Camera Operations

The camera role streams video via MediaMTX and exposes control APIs for health probes, detections, and stream validation. This guide captures configuration, detection workflows, and troubleshooting.

## Role components

- `camera-streamer` runs `libcamera-vid` with parameters from environment variables (`CAMERA_WIDTH`, `CAMERA_HEIGHT`, `CAMERA_FRAMERATE`, `CAMERA_BITRATE`, `CAMERA_AWB`, `CAMERA_EXPOSURE`). It publishes to MediaMTX over RTSP (`rtsp://127.0.0.1:8554/camera`).【F:roles/camera/40-app.yml†L33-L63】【F:roles/camera/README.md†L1-L32】
- `camera-rtsp` (MediaMTX) exposes RTSP and HLS endpoints externally (`rtsp://<host>:8554/camera`, `http://<host>:8888/camera/index.m3u8`). Health check calls `mediamtx --version` to confirm binary availability.【F:roles/camera/40-app.yml†L17-L32】
- `camera-control` FastAPI service (port 8083, host network) proxies health checks, metrics, status, and probe requests. It requires `CAMERA_CONTROL_TOKEN` when auth is enabled. Dependencies ensure RTSP and streamer containers start first.【F:roles/camera/40-app.yml†L1-L24】

## API endpoints

| Endpoint | Description | Usage |
| --- | --- | --- |
| `GET /healthz` | Checks HLS playlist and RTSP socket availability. | Prometheus and deploy health probes. |
| `GET /metrics` | Exposes gauges such as `camera_stream_online`, `camera_last_probe_timestamp_seconds`. | Grafana dashboards. |
| `GET /status` | Returns last probe result and configuration summary. | UI status cards and `/fleet/:id` device detail. |
| `POST /probe` | Forces new probe, returning stream health diagnostics. | Manual verification after adjustments or incidents. |

API contract is stubbed in Express for now (responses mark status `offline` until integration is complete). Ensure UI handles placeholders gracefully while backend returns static data.【F:apps/api/src/routes/camera.ts†L1-L72】

## Configuration checklist

- Enable camera module via `sudo raspi-config nonint do_camera 0` and ensure `/dev/video0`, `/dev/vchiq` are accessible to Docker. Set GPU memory ≥256MB for 1080p streams.【F:roles/camera/README.md†L5-L24】
- Update encrypted `.env.sops.enc` with final stream URLs or override `CAMERA_RTSP_URL`/`CAMERA_HLS_URL` if camera feeds are proxied elsewhere.
- Tune bitrate and framerate per location; default 1080p@20fps at 6 Mbps. Adjust AWB/exposure for lighting conditions. Document overrides in device detail doc ([18-device-detail-pages](./18-device-detail-pages.md)).

## Detection & alerting pipeline

- AI detections (planned) should feed into `/camera/events` (API contract defined). UI expects event list with timestamps, thumbnails, and playback links; integrate with [23-alerting-and-integrations](./23-alerting-and-integrations.md) for Slack escalation when night mode rules fire.【F:apps/api/openapi.yaml†L1568-L1625】【F:docs/ux/operator-jobs-and-stories.md†L204-L256】
- Night mode configuration and escalation flows must include webhook signature verification and acknowledgement tracking per UX requirements.【F:docs/ux/operator-jobs-and-stories.md†L234-L276】

## Troubleshooting

- **Stream offline** – Check `docker logs camera-streamer` for libcamera errors, verify camera ribbon cable, and ensure `libcamera-hello` works on host. Health endpoint should flag offline state; probe endpoint returns detailed failure reason.
- **RTSP/HLS unreachable** – Confirm `camera-rtsp` container is running and network mode host exposes ports 8554/8888. Validate firewall/Tailscale settings.
- **Authentication issues** – Ensure `CAMERA_PI_CAMERA_01_TOKEN` is set in `vps/fleet.env` so API proxies can reach the device. Inventory registry maps token env to device actions.【F:inventory/device-interfaces.yaml†L128-L161】【F:vps/fleet.env.example†L15-L33】
- **Latency/quality** – Adjust `CAMERA_BITRATE` and `CAMERA_FRAMERATE`. Monitor metrics for dropped frames and update Grafana panels accordingly.

## Operational tips

- Promtail ships camera logs via baseline compose; query `{host="pi-camera-01"}` in Grafana Loki when diagnosing issues.【F:baseline/docker-compose.yml†L21-L49】
- Update `infra/vps/targets-camera.json` after adding camera hosts so Prometheus scrapes `/metrics`. Restart monitoring stack to pick up new targets.【F:infra/vps/README.md†L33-L74】
- Coordinate camera firmware or configuration changes with [22-firmware-and-updates](./22-firmware-and-updates.md) to ensure rollback plans exist.

For UX expectations, cross-reference [11-camera-operations](./11-camera-operations.md) (this document) when updating UI or API features.
