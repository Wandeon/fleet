# Audio API

The audio control endpoints expose daily-use operations for managing the shared media library, device playback, and synchronization flows. All endpoints require a bearer token and emit an `x-correlation-id` header for traceability.

## Endpoint overview

| Method   | Path                               | Description                                                                                              |
| -------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET`    | `/audio/overview`                  | Aggregated audio state including devices, library, playlists, sessions, and master volume.               |
| `POST`   | `/audio/library`                   | Upload a track into the shared library with metadata tags.                                               |
| `POST`   | `/audio/playlists`                 | Create a playlist with ordered tracks and sync mode.                                                     |
| `PUT`    | `/audio/playlists/{playlistId}`    | Update playlist metadata and track ordering.                                                             |
| `DELETE` | `/audio/playlists/{playlistId}`    | Remove a playlist and associated assignments.                                                            |
| `POST`   | `/audio/playback`                  | Start playback for one or more devices using a playlist, track, or explicit assignments.                 |
| `GET`    | `/audio/devices/{deviceId}`        | Retrieve the current snapshot for a device including playback state, drift metrics, and timeline events. |
| `POST`   | `/audio/devices/{deviceId}/pause`  | Pause playback on a device.                                                                              |
| `POST`   | `/audio/devices/{deviceId}/resume` | Resume playback on a device.                                                                             |
| `POST`   | `/audio/devices/{deviceId}/stop`   | Stop playback and reset state.                                                                           |
| `POST`   | `/audio/devices/{deviceId}/seek`   | Seek to a position (seconds) in the current track.                                                       |
| `POST`   | `/audio/devices/{deviceId}/volume` | Set the per-device volume (0-100%).                                                                      |
| `POST`   | `/audio/master-volume`             | Set the master volume applied to all sessions.                                                           |

## Request and response examples

### Overview snapshot

```
GET /audio/overview
Authorization: Bearer <token>
```

```json
{
  "masterVolume": 60,
  "devices": [
    {
      "id": "pi-audio-test",
      "name": "Test Audio Device",
      "status": "online",
      "volumePercent": 35,
      "capabilities": ["playback", "seek", "sync", "upload", "volume"],
      "playback": {
        "state": "playing",
        "trackId": "trk_123",
        "playlistId": "pl_456",
        "positionSeconds": 42,
        "durationSeconds": 180,
        "startedAt": "2024-11-06T18:12:00.000Z",
        "syncGroup": "sess_789",
        "driftSeconds": 0
      },
      "lastUpdated": "2024-11-06T18:12:03.000Z",
      "lastError": null
    }
  ],
  "library": [
    {
      "id": "trk_123",
      "title": "Lobby Ambiance",
      "artist": "Fleet",
      "durationSeconds": 180,
      "format": "audio/mp3",
      "tags": ["ambient", "welcome"],
      "uploadedAt": "2024-11-06T18:10:01.000Z"
    }
  ],
  "playlists": [
    {
      "id": "pl_456",
      "name": "Daily Rotation",
      "loop": true,
      "syncMode": "synced",
      "createdAt": "2024-11-06T18:11:00.000Z",
      "updatedAt": "2024-11-06T18:11:00.000Z",
      "tracks": [{ "trackId": "trk_123", "order": 0 }]
    }
  ],
  "sessions": [
    {
      "id": "sess_789",
      "deviceIds": ["pi-audio-test"],
      "syncMode": "synced",
      "state": "playing",
      "startedAt": "2024-11-06T18:12:00.000Z",
      "drift": { "maxDriftSeconds": 0, "perDevice": { "pi-audio-test": 0 } }
    }
  ]
}
```

### Library upload

```
POST /audio/library
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form fields:

- `file` – binary MP3/FLAC/etc (required)
- `title` – display title (required)
- `artist` – optional performer/creator
- `tags` – comma-separated labels
- `durationSeconds` – decimal seconds (optional)

Success response (`201 Created`):

```json
{
  "id": "trk_abc",
  "title": "Morning Brief",
  "artist": "Fleet",
  "durationSeconds": 95,
  "format": "audio/mp3",
  "tags": ["briefing"],
  "uploadedAt": "2024-11-06T19:00:00.000Z"
}
```

### Playback request

```json
POST /audio/playback
Authorization: Bearer <token>
Content-Type: application/json

{
  "deviceIds": ["pi-audio-test", "pi-audio-lounge"],
  "playlistId": "pl_456",
  "syncMode": "synced"
}
```

Returns `202 Accepted` with `{ "accepted": true }` once the session is recorded.

### Error codes

The audio API uses standard error envelopes from the shared backend:

| Code              | HTTP | Description                                              |
| ----------------- | ---- | -------------------------------------------------------- |
| `bad_request`     | 400  | Validation failure for payload or multipart form fields. |
| `unauthorized`    | 401  | Missing or invalid bearer token.                         |
| `forbidden`       | 403  | Authenticated caller lacks audio permissions.            |
| `not_found`       | 404  | Requested device, playlist, or track is unknown.         |
| `rate_limited`    | 429  | Rate-limit guard triggered.                              |
| `not_implemented` | 501  | Operation is not yet wired to downstream audio workers.  |
| `internal_error`  | 500  | Unexpected failure logged in application traces.         |
