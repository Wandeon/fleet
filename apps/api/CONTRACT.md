# Fleet Web API Contract

This document summarises the HTTP contract exposed to the Fleet web UI. The
formal source of truth is the OpenAPI specification at
`apps/api/openapi.yaml`.

## Base information

- **Base URL:** `/api`
- **Version:** `0.1.0`
- **Authentication:** HTTP Bearer tokens (`Authorization: Bearer <token>`)
- **Correlation:**
  - Clients may send `x-correlation-id`. The server always echoes a value back.
  - Downstream logs use the same identifier to make end-to-end tracing easy.
- **Pagination:** list endpoints accept `limit` (default 50, max 200) and
  `cursor` (opaque string returned by the previous call).
- **Rate limiting:** 429 responses include `x-ratelimit-limit`,
  `x-ratelimit-remaining`, and `retry-after` headers.

## Error model

All non-2xx responses return the `Error` object:

```json
{
  "code": "AUDIO_DEVICE_TIMEOUT",
  "message": "Audio device pi-audio-01 timed out.",
  "hint": "Ensure the device is powered on and reachable.",
  "correlationId": "11111111-2222-3333-4444-555555555555",
  "details": {
    "deviceId": "pi-audio-01"
  }
}
```

Error codes of note:

| HTTP | Code                                | When it occurs                                                 |
| ---- | ----------------------------------- | -------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`                     | Missing or malformed bearer token.                             |
| 403  | `AUTH_FORBIDDEN`                    | Token lacks required scope (e.g. attempting write with `:ro`). |
| 404  | `RESOURCE_NOT_FOUND`                | Unknown device / route.                                        |
| 409  | `RESOURCE_BUSY` / domain specific   | Device is busy (e.g. switching source) or conflicting command. |
| 422  | `VALIDATION_FAILED`                 | Input body or query parameter fails validation.                |
| 429  | `RATE_LIMIT_EXCEEDED`               | Rate limit triggered; retry after the specified delay.         |
| 502  | `UPSTREAM_UNAVAILABLE`              | Device proxy unreachable or returned a bad response.           |
| 504  | `AUDIO_DEVICE_TIMEOUT` (or similar) | Device did not respond before timeout (default 4s).            |
| 500  | `INTERNAL_ERROR`                    | Unexpected backend failure.                                    |

## Resources

### Fleet overview

- `GET /fleet/layout`: metadata describing which modules the UI should render
  and their capabilities.
- `GET /fleet/state`: snapshot summarising audio devices, TV status, Zigbee
  device counts, and camera counters.

### Audio control

All operations proxy to the audio-player role running on each Pi.

- `GET /audio/devices`: list of devices with status and capabilities.
- `GET /audio/{id}`: detailed status (playback, volume, config).
- `POST /audio/{id}/play`: start playback (`source` = `stream` or `file`).
- `POST /audio/{id}/stop`: halt playback; returns current playback state.
- `POST /audio/{id}/volume`: set absolute volume (0.0 – 2.0).
- `PUT /audio/{id}/config`: update stream URL, fallback mode, or default source.

Timeouts and upstream faults map to 504/502 respectively. Devices marked
`online=false` should surface as degraded in the UI.

### Video / TV control

- `GET /video/devices`: list HDMI endpoints with power, mute, input, volume, playback, and busy state metadata.
- `POST /video/devices/{id}/power`: `{ "power": "on" | "standby" }` enqueues HDMI-CEC power commands and returns a `jobId`; conflicts surface as 409.
- `POST /video/devices/{id}/mute`: `{ "mute": boolean }` toggles mute via the job queue.
- `POST /video/devices/{id}/input`: `{ "input": "HDMI1" }` selects input; identifiers are normalised to lowercase server-side.
- `POST /video/devices/{id}/volume`: `{ "volumePercent": 0-100 }` adjusts HDMI output gain.
- `POST /video/devices/{id}/playback`: `{ "action": "play"|"pause"|"resume"|"stop", "url"? }` manages media playback sessions.

### Zigbee devices

- `GET /zigbee/devices`: list switches, sensors, and bulbs with latest state.
- `POST /zigbee/devices/{id}/action`: supports `toggle`, `on`, `off`, or
  `scene` (requires `scene` string).

### Camera observability

- `GET /camera/summary`: camera health and storage utilisation.
- `GET /camera/events`: paginated events; supports `limit`, `cursor`, and `since` (ISO timestamp).
- `GET /camera/preview/{id}`: generates short-lived HLS preview links when
  available.

### Health & events

- `GET /health/summary`: aggregated module health (audio/video/zigbee/camera)
  with reasons for degradation.
- `GET /events/recent`: rolling feed combining device alerts across modules.

## Timeouts and upstream mapping

- The API waits up to four seconds for downstream device APIs. If they do not
  respond, the UI receives a 504 with a code specific to the failing module
  (e.g. `AUDIO_DEVICE_TIMEOUT`).
- Immediate connectivity failures (connection refused, DNS) surface as 502
  `UPSTREAM_UNAVAILABLE`.
- Device state conflicts return 409. Clients should retry when appropriate.

## Mock server behaviour highlights

- Default artificial delay: 120 ms (override with `MOCK_DELAY_MS`).
- Optional flaky mode: set `MOCK_UNSTABLE=1` to randomly return 504s for
  device-oriented endpoints (~10% of calls).
- `x-mock-simulate` request header allows forcing specific failures for testing
  (`timeout`, `bad-gateway`, `conflict`, `rate-limit`).

Refer to `apps/api-mock/README.md` for mock-specific instructions.
