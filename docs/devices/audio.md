# Audio Devices: pi-audio-01 & pi-audio-02

This profile establishes the production contract for the two Raspberry Pi audio
players. It captures the current repository coverage, the target control and
observability surfaces, and the acceptance criteria enforced by CI so the audio
fleet stays aligned with the new disciplined pipeline.

## Current repo coverage (today)

- **Inventory** – Both devices are mapped to the `audio-player` role with log
  shipping enabled in the shared inventory. 【F:inventory/devices.yaml†L1-L10】
- **UI/API interface** – The device interface catalog exposes health, status,
  playback controls, volume, and now a read-only config inspector that hits the
  control API directly. 【F:inventory/device-interfaces.yaml†L1-L90】
- **Role documentation & tooling** – The role README and CLI cover the on-device
  services and day-two commands (`scripts/audioctl.sh`). 【F:roles/audio-player/README.md†L1-L74】【F:scripts/audioctl.sh†L1-L37】
- **Operations runbooks** – Detailed provisioning and recovery guides already
  exist under `docs/runbooks/` for Icecast, acceptance testing, and operator
  checklists. 【F:docs/runbooks/audio.md†L1-L125】【F:docs/runbooks/acceptance.md†L1-L120】
- **Monitoring** – Prometheus scrape targets point at the control API metrics
  endpoints for both Pis. 【F:monitoring/targets-audio.json†L1-L9】
- **Smoke tests** – CI currently boots the API mock and now exercises the full
  `/audio/devices` REST surface to ensure uploads, playback controls, and config
  writes never regress. 【F:.github/workflows/acceptance-smoke.yml†L53-L128】

> There was no dedicated device profile tying these assets together until this
> document. Everything lived in runbooks and ad-hoc notes, which made it easy to
> drift from the intended contract.

## Target state under the disciplined pipeline

### Control API contract

The control API on port `8081` must support the following endpoints for both
pi-audio-01 and pi-audio-02. All write calls require a Bearer token when
configured.

| Method | Path            | Purpose |
| ------ | --------------- | ------- |
| GET    | `/healthz`      | Liveness probe used by Prometheus and role health checks. |
| GET    | `/status`       | Current playback state, source, fallback presence, and error context. |
| GET    | `/config`       | Retrieves persisted stream URL, mode, and desired source. |
| PUT    | `/config`       | Updates stream URL, fallback mode, or desired source. |
| POST   | `/play`         | Switches playback to `stream` or `file`. |
| POST   | `/stop`         | Idles playback immediately. |
| POST   | `/volume`       | Sets software gain (0.0 – 2.0). |
| POST   | `/upload`       | Replaces `/data/fallback.mp3` atomically via multipart upload. |
| GET    | `/metrics`      | Prometheus exposition of device metrics. |

The UI operations map to these endpoints via `inventory/device-interfaces.yaml`
so the dashboard stays consistent with the backend. 【F:inventory/device-interfaces.yaml†L1-L90】

### Health checks & metrics

- `/healthz` is the canonical health probe used by the role agent, Prometheus,
  and Grafana dashboards.
- `/status` confirms fallback existence (`fallback_exists`), playback state,
  stream status, and exposes the same payload captured in upload responses.
- `/metrics` must export the gauges produced by the control service, including
  `audio_stream_up`, `audio_fallback_active`, `audio_fallback_exists`,
  `audio_volume`, and the source/mode info gauges used for alerting. 【F:roles/audio-player/docker/app/control.py†L284-L320】【F:roles/audio-player/docker/app/control.py†L670-L699】

### Monitoring & dashboards

- Prometheus scrapes come from `monitoring/targets-audio.json`. Any hostname or
  port drift must be updated there so acceptance dashboards stay accurate.
  【F:monitoring/targets-audio.json†L1-L9】
- Grafana dashboards consume these metrics; keep `grafana/dashboards/audio-player.json`
  in sync when alerting thresholds or panels change. 【F:grafana/dashboards/audio-player.json†L1-L10】

### IF → THEN operational runbook

| If… | Then… |
| --- | ------ |
| Stream probe fails or `audio_stream_up` drops to 0 | Use `scripts/audioctl.sh play stream` to force a reconnect and confirm `/status` reflects the stream source. If the stream stays down, upload the fallback file and set mode `manual`. 【F:scripts/audioctl.sh†L1-L37】【F:docs/runbooks/audio.md†L96-L140】 |
| Fallback file missing (`audio_fallback_exists` = 0) | Issue `POST /upload` with the latest fallback MP3 (use the CLI `upload` command). Verify `/status.fallback_exists` flips to true immediately after the upload. 【F:scripts/audioctl.sh†L1-L37】 |
| Breaker/open or device offline in dashboard | Run `/healthz` and `/status` via the UI button or CLI. If `healthz` fails, schedule converge/restart during the 20:00–08:00 window per the provisioning runbook. 【F:inventory/device-interfaces.yaml†L1-L90】【F:docs/runbooks/audio.md†L1-L125】 |
| Oversized upload rejected (`400` from `/upload`) | Trim the media to <50 MB, retry the upload, and watch `audio_player_state_info` for the new status message. Escalate if the metric shows repeated failures. 【F:roles/audio-player/docker/app/control.py†L697-L699】 |

### Acceptance & CI checks

The GitHub `acceptance-smoke` workflow now hard-fails any PR if:

- `/audio/devices` does not enumerate both Pi players or the endpoint returns a
  non-200 response. 【F:.github/workflows/acceptance-smoke.yml†L70-L92】
- Device-scoped playback controls (`/play`, `/stop`, `/volume`, `/config`) stop
  responding with success codes. 【F:.github/workflows/acceptance-smoke.yml†L94-L118】
- The fallback upload endpoint disappears or responds with an unexpected status
  code. 【F:.github/workflows/acceptance-smoke.yml†L120-L128】

These smoke checks run in every PR touching API/UI code so drift is caught
before merge. Pair them with the full acceptance runbook when deploying to
hardware. 【F:docs/runbooks/acceptance.md†L1-L120】

### Implementation checklist (repo alignment)

- [x] Capture the audio device blueprint in `docs/devices/audio.md` (this file).
- [x] Align the UI device interface with the control API (`/stop`, `/config`
  button). 【F:inventory/device-interfaces.yaml†L1-L90】
- [x] Expand the mock API with the `/audio/devices/{id}/upload` contract so CI
  tests run end-to-end. 【F:apps/api-mock/server.ts†L330-L368】
- [x] Strengthen the acceptance smoke to cover inventory, control, config, and
  upload flows. 【F:.github/workflows/acceptance-smoke.yml†L53-L128】

With these pieces in place, pi-audio-01 and pi-audio-02 meet the new system
standard: documented, monitored, and backed by CI-enforced acceptance tests.
