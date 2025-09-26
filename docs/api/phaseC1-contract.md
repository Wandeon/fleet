# Phase C1 – Backend Contract Baseline

This document captures the contract updates introduced in Phase C1 to match the refreshed operator UX. The summary below reflects the generated OpenAPI `0.2.0` baseline and the UI calls observed under `apps/ui/src/lib/modules`.

## Endpoint coverage by module

### Fleet

| Endpoint                                            | Purpose                                                                                  | Status                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /fleet/overview`                               | Provide counts, module roll-ups, and latest device summaries for the fleet landing page. | Already implemented in control plane.              |
| `GET /fleet/devices/{deviceId}`                     | Retrieve the detailed device pane, including metrics, alerts, logs, and actions.         | Already implemented in control plane.              |
| `POST /fleet/devices/{deviceId}/actions/{actionId}` | Trigger a queued quick action from the device detail view.                               | Stub – UI expects 202 but backend handler pending. |

### Audio

| Endpoint                                | Purpose                                                                            | Status                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /audio/overview`                   | Consolidated audio state used to render devices, playlists, sessions, and library. | Existing aggregation (fallbacks to legacy client when unavailable).  |
| `POST /audio/library`                   | Upload new media into the shared audio library.                                    | Stub – surfaced as `501 Not Implemented` until upload service lands. |
| `POST /audio/playlists`                 | Create a saved playlist.                                                           | Stub – UI shows optimistic result; backend pending.                  |
| `PUT /audio/playlists/{playlistId}`     | Update playlist metadata or tracks.                                                | Stub – UI patches locally; backend pending.                          |
| `DELETE /audio/playlists/{playlistId}`  | Remove a playlist.                                                                 | Stub – backend deletion pending.                                     |
| `POST /audio/playback`                  | Multi-device playback orchestration API.                                           | Stub – UI falls back to device-level client today.                   |
| `GET /audio/devices/{deviceId}`         | Fetch latest state for a specific audio device.                                    | Existing via device control plane.                                   |
| `POST /audio/devices/{deviceId}/pause`  | Pause playback on a device.                                                        | Stub – currently proxied by legacy client.                           |
| `POST /audio/devices/{deviceId}/resume` | Resume playback on a device.                                                       | Stub – currently proxied by legacy client.                           |
| `POST /audio/devices/{deviceId}/stop`   | Stop playback on a device.                                                         | Stub – currently proxied by legacy client.                           |
| `POST /audio/devices/{deviceId}/seek`   | Seek within the active track.                                                      | Stub – backend work pending.                                         |
| `POST /audio/devices/{deviceId}/volume` | Set device volume using normalized gain.                                           | Stub – UI uses Audio API fallback.                                   |
| `POST /audio/master-volume`             | Set the fleet-wide master volume.                                                  | Stub – pending server handler.                                       |

### Video

| Endpoint                | Purpose                                       | Status                                                       |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `GET /video/overview`   | Aggregated TV/CEC state for the video module. | Stub – UI falls back to `VideoApi` when unavailable.         |
| `GET /video/recordings` | Supply recording timeline segments.           | Stub – UI falls back to overview payload today.              |
| `POST /video/preview`   | Issue a signed preview URL for live playback. | Stub – UI shows placeholder until backend emits signed URLs. |

### Zigbee

| Endpoint                                 | Purpose                                               | Status                                  |
| ---------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| `GET /zigbee/overview`                   | Hub, devices, quick actions, and pairing banner data. | Stub – UI falls back to Zigbee SDK.     |
| `POST /zigbee/devices/{deviceId}/action` | Execute a quick action against a device.              | Stub – backend action handler pending.  |
| `POST /zigbee/pairing`                   | Start pairing window.                                 | Stub – backend pairing service pending. |
| `DELETE /zigbee/pairing`                 | Stop pairing window.                                  | Stub – backend pairing service pending. |
| `GET /zigbee/pairing/discovered`         | Poll newly discovered devices.                        | Stub – backend discovery feed pending.  |
| `POST /zigbee/pairing/{deviceId}`        | Confirm pairing of a discovered device.               | Stub – backend confirmation pending.    |

### Camera

| Endpoint                             | Purpose                                                  | Status                                                |
| ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- |
| `GET /camera/overview`               | Fetch devices, events, clips, and current preview state. | Existing aggregator (falls back to legacy `/camera`). |
| `PUT /camera/active`                 | Set active camera for preview requests.                  | Stub – UI no-ops if backend absent.                   |
| `POST /camera/events/{eventId}/ack`  | Mark events acknowledged.                                | Stub – handler pending.                               |
| `POST /camera/events/{eventId}/clip` | Request or generate clip URL for an event.               | Stub – UI uses mock fallback.                         |
| `POST /camera/{cameraId}/refresh`    | Refresh preview still/stream.                            | Stub – UI retries overview when unavailable.          |

### Logs

| Endpoint           | Purpose                                      | Status                                                 |
| ------------------ | -------------------------------------------- | ------------------------------------------------------ |
| `GET /logs`        | Paginated log snapshot powering Logs module. | Already implemented (existing control-plane endpoint). |
| `GET /logs/stream` | Server-sent event stream for live tailing.   | Already implemented.                                   |

### Settings

| Endpoint                                     | Purpose                                              | Status               |
| -------------------------------------------- | ---------------------------------------------------- | -------------------- |
| `GET /settings`                              | Retrieve API, proxy, pairing, and operator settings. | Already implemented. |
| `PATCH /settings/proxy`                      | Update proxy configuration.                          | Already implemented. |
| `POST /settings/api-token`                   | Rotate API bearer token.                             | Already implemented. |
| `PUT /settings/allowed-origins`              | Manage allowed CORS origins.                         | Already implemented. |
| `POST /settings/pairing/start`               | Begin device onboarding flow.                        | Already implemented. |
| `POST /settings/pairing/cancel`              | Cancel device onboarding flow.                       | Already implemented. |
| `POST /settings/pairing/{candidateId}/claim` | Record pairing outcome for discovered device.        | Already implemented. |
| `POST /settings/operators`                   | Invite a new operator.                               | Already implemented. |
| `DELETE /settings/operators/{operatorId}`    | Remove or disable an operator.                       | Already implemented. |

## Notes

- Audio, video, zigbee, and camera control-plane endpoints are defined even when backend handlers are pending; each operation surfaces a `501 Not Implemented` response to make contract gaps explicit while allowing UI stubs.
- Schemas for device snapshots, playlists, pairing, and logs mirror the structures defined in `apps/ui/src/lib/types.ts` and remain consistent with the live capabilities matrix (`docs/ux/device-capabilities-matrix.md`).
- Running `npm run openapi:generate` refreshes the TypeScript client under `apps/ui/src/lib/api/gen`. Re-running the generator produces no additional diffs, keeping the CI drift check clean.
