# pi-camera-01 – AI Surveillance Node Readiness

## Role & Purpose
- **Device ID:** `pi-camera-01`
- **Role:** `camera-node`
- **Location:** Front entry vestibule
- **Mission:** Provide live surveillance, AI motion detection, and event logging once camera hardware is attached.
- **Current state:** Controller online, camera hardware not yet connected; all API surfaces return guarded offline placeholders.

## Inventory & Interfaces
- Listed in `inventory/devices.yaml` with role `camera-node`, front-entry location, and Loki log source.
- Interface definition in `inventory/device-interfaces.yaml` declares:
  - Control API at `http://pi-camera-01:8083`
  - `/healthz`, `/status`, `/metrics` endpoints with bearer auth (`CAMERA_PI_CAMERA_01_TOKEN`).
  - RTSP `rtsp://pi-camera-01:8554/camera` and HLS `http://pi-camera-01:8888/camera/index.m3u8` stream placeholders.
- Prometheus target `camera-control` configured for `pi-camera-01:8083` with `role="camera-node"` labels.

## API Contract (offline readiness)
All endpoints are prefixed with `/api/camera` and return explicit offline reasons until the lens hardware is attached.

| Endpoint | Method | Response summary |
| --- | --- | --- |
| `/api/camera/summary` | GET | `CameraState` payload with `status: "offline"`, empty events/clips, preview marked `unavailable`, and `camera_stream_online{camera_id="pi-camera-01"} = 0`.
| `/api/camera/events` | GET | Empty `events` array plus `status: "offline"`, preserves filter echo for clients.
| `/api/camera/events/{id}/ack` | POST | Returns `202` with acknowledgement note when fixture event exists; returns `422 validation_failed` if event is unknown (hardware absent).
| `/api/camera/preview/{id}` | GET | `CameraPreviewState` offline stub if camera exists; `404 not_found` for invalid IDs.
| `/api/camera/streams` | GET | Stream metadata array (`status: "offline"`, null URLs) for monitoring dashboards.

## Health & Metrics
- Device exports `/healthz` and `/metrics` (MediaMTX controller stub).
- Fleet API emits Prometheus gauge `camera_stream_online{camera_id="pi-camera-01"}` and holds value `0` until a stream comes online.
- Standard request metrics (`http_requests_total`, `http_request_duration_ms`) cover new `/api/camera/*` routes.

## Event Workflow (offline placeholders)
1. Detection pipeline is idle; `/api/camera/events` returns empty list with offline reason.
2. Operator acks to `/api/camera/events/{id}/ack` → returns `validation_failed` until events exist.
3. When hardware joins, event list populates and ack route will start returning `202 accepted` for valid IDs.

## IF → THEN Runbook
- **IF** camera hardware not attached → **THEN** all summary, preview, and streams endpoints respond `offline` with reason `"Camera hardware not attached"` while metrics stay at zero.
- **IF** `/api/camera/events/{id}/ack` called for non-existent event → **THEN** API returns `422 validation_failed` with `event_not_found` detail.
- **IF** stream connection drops after go-live → **THEN** integration must raise a log event, set `camera_stream_online` to `0`, and surface status via `/api/camera/streams` (future-ready hook).
- **IF** `/api/camera/preview/{id}` receives an unknown camera ID → **THEN** respond `404 not_found`.

## Acceptance & CI Coverage
- Playwright API smoke tests verify `/api/camera/summary` and `/api/camera/events` offline responses.
- UI feature flag unit test asserts camera navigation is hidden unless `VITE_FEATURE_CAMERA=1`.
- Backend vitest coverage (see `apps/api/src/routes/camera.ts` tests when added) should expand when real streams arrive.

## Next Steps When Hardware Arrives
1. Remove offline short-circuiting in `apps/api/src/routes/camera.ts`, wiring to actual camera controller.
2. Flip `VITE_FEATURE_CAMERA` to `1` in production environment variables to expose UI controls.
3. Update Prometheus alerting rules to treat `camera_stream_online == 0` as outage once hardware installed.
4. Provide contract fixtures for live event data and integrate clip generation.
