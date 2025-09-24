# API Surface

The Fleet API is a bearer-protected Express service exposing module-specific endpoints for the UI and automation. All routes require `Authorization: Bearer <API_BEARER>` except `/healthz` and `/readyz`.

## Authentication & transport

- Bearer enforcement lives in `apps/api/src/auth/bearer.ts`; mismatched tokens return `401` with `WWW-Authenticate: Bearer error="invalid_token"`. Configure the shared secret via `API_BEARER` in `vps/fleet.env`.【F:apps/api/src/auth/bearer.ts†L1-L34】【F:vps/fleet.env.example†L1-L33】 
- Global limits: the server enforces per-IP and global rate limits (`RATE_LIMIT_*` env vars) and times out upstream device calls after 3s (`TIMEOUT_MS`).【F:apps/api/src/config.ts†L1-L40】【F:apps/api/ARCHITECTURE.md†L5-L33】 
- Correlation IDs propagate through the `x-correlation-id` header; successful responses echo it as defined in the OpenAPI headers and feed into logs/events.【F:apps/api/openapi.yaml†L881-L938】【F:apps/api/openapi.yaml†L1661-L1693】 

## Fleet endpoints

| Endpoint | Method | Purpose | Notes |
| --- | --- | --- | --- |
| `/api/fleet/layout` | GET | Returns module metadata (audio, video, zigbee, camera) so the UI can assemble cards/routes. | Includes `updatedAt`, module IDs, and capability lists.【F:apps/api/openapi.yaml†L881-L931】 |
| `/api/fleet/state` | GET | Aggregated dashboard snapshot (device counts, playback summaries, camera stats). | Example payload documents per-module online counts and playback metadata.【F:apps/api/openapi.yaml†L939-L1028】 |

## Audio module

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/audio/devices` | GET | Lists registered audio players with status and last seen timestamps.【F:apps/api/openapi.yaml†L1029-L1083】 |
| `/api/audio/{id}` | GET | Fetches a single player’s real-time status (`playback`, `volume`, `config`).【F:apps/api/openapi.yaml†L1084-L1119】 |
| `/api/audio/{id}/play` | POST | Starts playback from stream or fallback file (body `{ source: "stream" | "file" }`).【F:apps/api/openapi.yaml†L1120-L1149】 |
| `/api/audio/{id}/stop` | POST | Halts playback and returns updated status.【F:apps/api/openapi.yaml†L1187-L1216】 |
| `/api/audio/{id}/volume` | POST | Sets software gain (`0.0–2.0`). Payload validated by `audioVolumeSchema`.【F:apps/api/openapi.yaml†L1222-L1254】【F:apps/api/src/routes/audio.ts†L66-L101】 |
| `/api/audio/{id}/config` | GET/PUT | Read or update persisted config (`stream_url`, `mode`, `source`). PUT emits an event for `/health/events/recent`.【F:apps/api/openapi.yaml†L1265-L1306】【F:apps/api/src/routes/audio.ts†L44-L78】 |
| `/api/audio/{id}/upload` | POST | Multipart upload for fallback MP3s (50 MB limit). Records an `audio.upload` event. | Uses Multer in-memory storage and forwards buffer to device via upstream proxy.【F:apps/api/src/routes/audio.ts†L101-L145】 |

## Video module

- `/api/video/tv/power`, `/api/video/tv/input`, `/api/video/tv/volume`, `/api/video/tv/mute` accept JSON payloads to drive HDMI-CEC commands and respond with updated TV status, including correlation headers and conflict handling (409 on concurrent commands).【F:apps/api/openapi.yaml†L1344-L1492】 
- Worker jobs for TV control originate from these routes and execute via the job queue described in [15-error-recovery](./15-error-recovery.md).【F:apps/api/src/workers/executor.ts†L1-L55】 
- `/api/video/devices` and `/api/video/displays` currently return registry-derived stubs marking devices `offline` until live telemetry is wired up.【F:apps/api/src/routes/video.ts†L1-L74】 

## Zigbee module

- `/api/zigbee/devices` lists coordinator-managed devices (stubbed with registry data today).【F:apps/api/openapi.yaml†L1493-L1522】【F:apps/api/src/routes/zigbee.ts†L1-L60】 
- `/api/zigbee/devices/{id}/action` is defined for toggle/scene commands but currently returns `accepted: false` while backend integrations are being built; UI should surface this as “coming soon”.【F:apps/api/openapi.yaml†L1523-L1567】【F:apps/api/src/routes/zigbee.ts†L61-L82】 

## Camera module

- `/api/camera/summary`, `/api/camera/events`, and `/api/camera/preview/{id}` provide the contract for health, event feeds, and signed preview URLs. Implementations still return placeholder data pending MediaMTX integration; responses mark devices `offline` with explanatory `reason` fields.【F:apps/api/openapi.yaml†L1568-L1659】【F:apps/api/src/routes/camera.ts†L1-L72】 
- `/api/camera/streams` mirrors registry entries so the UI can link to RTSP/HLS endpoints defined in `inventory/device-interfaces.yaml`.【F:apps/api/src/routes/camera.ts†L17-L43】【F:inventory/device-interfaces.yaml†L128-L161】 

## Health & observability

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/healthz` | GET | Container liveness (no auth).【F:apps/api/README.md†L12-L36】 |
| `/api/readyz` | GET | Readiness; loads device registry before returning success.【F:apps/api/README.md†L32-L56】 |
| `/api/health/summary` | GET | Combines audio probe results with registry data for other modules, marking unknown states for non-audio devices. UI should interpret `status` accordingly.【F:apps/api/openapi.yaml†L1661-L1685】【F:apps/api/src/routes/health.ts†L1-L42】 |
| `/api/health/events/recent` | GET | Returns recent structured events (commands, failures) from in-memory bus. Accepts optional `limit` (1–200).【F:apps/api/openapi.yaml†L1686-L1693】【F:apps/api/src/routes/health.ts†L44-L59】 |
| `/api/logs` & `/api/logs/stream` | GET | Exposes the API log ring buffer over JSON or SSE for the UI `/logs` view. Query params `level` and `limit` filter entries.【F:apps/api/src/routes/logs.ts†L1-L107】 |

## Error handling

- Validation uses Zod schemas; failures yield `422 validation_failed` responses that include field detail. 
- Upstream timeouts map to `504 upstream_timeout`, network errors to `502 upstream_unreachable`, and opened circuit breakers to `503 circuit_open`. Metrics increment `upstream_device_failures_total{deviceId,reason}` for dashboards.【F:apps/api/ARCHITECTURE.md†L17-L49】 

For UI integration details, see [05-ui-structure](./05-ui-structure.md); for device expectations, reference [09](./09-audio-operations.md) through [12](./12-zigbee-operations.md).
