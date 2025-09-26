# Audio Operations

Audio playback is delivered by the `audio-player` role and coordinated through the control API on port 8081. This guide captures upload/playback flows, fallback handling, and sync considerations.

## Service components

- `audio-player` container supervises FFmpeg playback, maintains `/data/status.json`, and exposes Prometheus metrics (`audio_stream_up`, `audio_fallback_active`). Health check ensures the status file updates every 60s.【F:roles/audio-player/40-app.yml†L1-L54】
- `audio-control` container serves HTTP API endpoints (`/status`, `/config`, `/play`, `/stop`, `/volume`, `/upload`, `/metrics`, `/healthz`) and enforces bearer auth when `AUDIO_CONTROL_TOKEN` is set. Helper CLI `scripts/audioctl.sh` wraps these endpoints with retries.【F:roles/audio-player/40-app.yml†L56-L86】【F:roles/audio-player/README.md†L1-L40】
- Each Pi mounts `audio_data` volume for fallback MP3 storage and playback logs. Uploads overwrite `/data/fallback.mp3` atomically.【F:roles/audio-player/40-app.yml†L48-L86】

## Control API reference

| Endpoint                      | Description                                                                                   | Typical use                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `GET /healthz`                | Liveness probe (no auth).                                                                     | Prometheus/Blackbox and deploy health checks.【F:roles/audio-player/README.md†L20-L32】          |
| `GET /status`                 | Returns playback state, config, fallback presence, timestamps.                                | UI dashboard, `audioctl status` command.                                                         |
| `GET /config` / `PUT /config` | Read/write `stream_url`, `mode` (`auto`/`manual`), `source` (`stream`/`file`/`stop`), volume. | Persist stream overrides or manual fallback selection.【F:roles/audio-player/README.md†L24-L36】 |
| `POST /play`                  | Body `{ "source": "stream"                                                                    | "file" }`. Switches playback source immediately.                                                 | Manual takeover or fallback testing.【F:apps/api/src/routes/audio.ts†L1120-L1171】 |
| `POST /stop`                  | Stops playback, keeping status file updated for healthcheck.                                  | Pause streams before maintenance.                                                                |
| `POST /volume`                | Body `{ "volume": <0.0-2.0> }`. Returns updated config.                                       | UI slider, `audioctl volume 0.8`.                                                                |
| `POST /upload`                | Multipart upload (`file=@fallback.mp3`). Writes fallback file and emits API event.            | Rotate safety track or pre-roll message.【F:apps/api/src/routes/audio.ts†L101-L145】             |
| `GET/POST /hwvolume`          | Optional hardware mixer (ALSA) integration.                                                   | Only when `AUDIO_MIXER_*` configured.                                                            |

## Upload & library workflow

1. Prepare fallback asset locally (≤50 MB). `audioctl upload fallback.mp3` handles multipart upload and token injection.
2. API stores the file under `/data/fallback.mp3` and returns success with metadata; status now reports `fallback_exists: true`.
3. To confirm playback, `POST /play {"source":"file"}` and monitor `/status` for `current_source: file`. After verification, return to stream via `POST /play {"source":"stream"}` or allow auto mode to resume when the upstream stream recovers.【F:roles/audio-player/README.md†L18-L40】

## Playback & sync scenarios

- **Automatic fallback** – When `mode=auto`, the player loops the fallback file if stream probes fail. Operators should reset to `stream` once Icecast recovers, or rely on `mode=auto` to switch back automatically.【F:README.md†L68-L96】
- **Manual sync check** – Use `scripts/acceptance.sh --play-both pi-audio-01 pi-audio-02` after deploys to validate both Pis reach Icecast with minimal drift. The script logs to `.deploy/last-acceptance.log`.【F:README.md†L130-L154】【F:scripts/vps-deploy.sh†L1-L200】
- **Volume alignment** – For multi-zone playback, pair `POST /volume` adjustments with hardware mixer commands where applicable (e.g., `AUDIO_MIXER_CARD`). Document levels in [18-device-detail-pages](./18-device-detail-pages.md).

## Failure handling

- **Stream down** – `audio-player` logs `Stream fallback engaged` with `errorCode=STREAM_DOWN`; Prometheus `audio_stream_up` transitions to `0`. Investigate Icecast or network and use `/status` to confirm fallback state.【F:docs/runbooks/logging.md†L54-L87】
- **Agent converge issues** – Review `journalctl -u role-agent.service` for Git or compose errors. Health file at `/var/run/fleet/health.json` captures exit status; metrics exported for Prometheus via textfile collector.【F:agent/role-agent.sh†L1-L180】
- **Upload errors** – API returns `400 bad_request` when file missing or >50 MB, `502/504` when device unreachable. Check device connectivity and ensure bearer token matches the env variable specified in `inventory/device-interfaces.yaml`.【F:apps/api/src/routes/audio.ts†L118-L145】【F:inventory/device-interfaces.yaml†L1-L92】

## Operational checklist

- Confirm HiFiBerry overlay on Pis via `/boot/firmware/config.txt` (`dtoverlay=hifiberry-dac`).【F:docs/runbooks/audio.md†L31-L75】
- Keep Icecast credentials secure in `infra/vps/icecast.env`; restart stack after changes (`docker compose -f infra/vps/compose.icecast.yml up -d`).【F:docs/runbooks/audio.md†L9-L45】
- After env updates, re-run the agent manually (`sudo /opt/fleet/agent/role-agent.sh`) or wait for timer tick.
- Update `vps/targets-audio.json` whenever new players are added so Prometheus scrapes the new endpoints.【F:docs/runbooks/audio.md†L45-L63】

Cross-reference [21-file-and-asset-management](./21-file-and-asset-management.md) for library retention policies and [15-error-recovery](./15-error-recovery.md) for retry strategies.
