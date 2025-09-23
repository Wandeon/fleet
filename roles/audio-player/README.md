# Audio Player Role

This role plays an Icecast stream to the host's ALSA device (e.g., HiFiBerry
DAC+ Zero `hw:0,0`). It ships two containers:

- **audio-player** — supervises FFmpeg, maintains `/data/status.json`, and logs
  to `/data/logs/player.log`.
- **audio-control** — HTTP API on `:8081` that serves `/status`, `/metrics`, and
  write endpoints (`/play`, `/stop`, `/volume`, `/upload`).

## Key environment variables

- `AUDIO_OUTPUT_DEVICE` — ALSA output (e.g., `hw:0,0`).
- `AUDIO_VOLUME` — software gain (0.0–2.0, default `1.0`).
- `STREAM_URL` or `ICECAST_*` — Icecast stream source.
- `AUDIO_CONTROL_TOKEN` — optional Bearer token required for the API.
- `AUDIO_MIXER_CARD` / `AUDIO_MIXER_CONTROL` — optional hardware mixer target
  for `amixer` (`/hwvolume` endpoint).
- `FALLBACK_FILE` — path of the fallback MP3 (`/data/fallback.mp3` by default).

Ensure the HiFiBerry overlay is enabled before convergence; see
[`docs/runbooks/audio.md`](../../docs/runbooks/audio.md).

## Control API quick reference

- `GET /status` — config + playback state (`current_source`, `stream_up`,
  `fallback_exists`).
- `GET /config` / `PUT /config` — read/write `stream_url`, `volume`, `mode`,
  `source`.
- `POST /volume` — body `{ "volume": 0.8 }` (clamped 0.0–2.0).
- `POST /play` — body `{ "source": "stream" }` or `{ "source": "file" }`.
- `POST /stop` — stop playback.
- `POST /upload` — multipart form with `file=@fallback.mp3` (writes
  `/data/fallback.mp3`).
- `GET /healthz` — unauthenticated health probe.
- `GET /metrics` — Prometheus metrics (requires Bearer token when configured).
- `GET/POST /hwvolume` — read/set hardware mixer volume percent.

The helper CLI `scripts/audioctl.sh` wraps these endpoints, provides retry &
timeout controls, and pretty-prints JSON. Usage examples live in
[`docs/runbooks/audio.md`](../../docs/runbooks/audio.md).

## Notes

- Logs: `/data/logs/player.log` rotates manually; inspect via `docker exec` or
  mount the volume.
- Status: `/data/status.json` updates every second, and the container health
  check verifies its freshness (so deliberate `/stop` does not mark the
  container unhealthy).
- Security: when `AUDIO_CONTROL_TOKEN` is set, every endpoint except `/healthz`
  requires the `Authorization: Bearer <token>` header. Keep port `8081` on
  private networks only.
- Troubleshooting: run `aplay -l` to verify ALSA, use `scripts/acceptance.sh` to
  validate playback, and consult the Prometheus metrics (`audio_stream_up`,
  `audio_fallback_active`, `audio_status_age_seconds`, etc.).
