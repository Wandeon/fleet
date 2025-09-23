Audio Player Role

This role pulls an Icecast stream and plays it out the Pi’s ALSA device (e.g., HiFiBerry DAC+ Zero at `hw:0,0`). It uses FFmpeg inside a container with access to `/dev/snd`.

Key variables:

- AUDIO_OUTPUT_DEVICE: ALSA output, e.g. `hw:0,0` (DAC+ Zero)
- AUDIO_VOLUME: Linear volume multiplier, e.g. `1.0` (100%), `0.7` (70%)
- STREAM_URL: Full stream URL like `http://<host>:8000/<mount>`; or provide `ICECAST_*` parts
- AUDIO_CONTROL_TOKEN: Optional bearer token required by the control API
- AUDIO_MIXER_CARD / AUDIO_MIXER_CONTROL: Optional hardware mixer target for amixer (e.g., `0` / `Digital` or `0` / `Master`)

Notes:

- Ensure the HiFiBerry overlay is enabled (see `docs/runbooks/audio.md`).
- If you don’t hear audio, run `aplay -l` to confirm the device index, and try `speaker-test -D hw:0,0` to validate output.

Container/runtime notes:

- No fixed `container_name` is set; the agent launches a commit‑keyed compose project. Use `docker compose ls` and `docker ps | grep audio-` to discover names.
- The control container installs Flask at startup using the interpreter’s pip (`ensurepip` + `python3 -m pip`). The device must have outbound network access on first run. Consider baking a tiny image if startup time matters.
- A healthcheck probes `/healthz` inside the container. You can query it via `curl http://<pi>:8081/healthz`.
- Player and control logs persist on the shared volume: `/data/player.log` (ffmpeg events, fallback switches) and `/data/control.log` (API access + validation errors).

Controller API (audio-control on port 8081):

- `GET /status`: current config plus runtime fields (`requested_source`, `now_playing`, `fallback_active`, `stream_up`, `last_switch_timestamp`)
- `GET /config`: read config
- `PUT /config`: JSON body with any of `stream_url`, `volume` (0.0–2.0), `mode` (`auto`|`manual`), `source` (`stream`|`file`|`stop`)
- `POST /volume`: `{ "volume": 0.8 }`
- `POST /play`: `{ "source": "stream" }` or `{ "source": "file" }`, optional `mode`
- `POST /stop`: stop playback
- `POST /upload`: multipart form with `file` to set `/data/fallback.mp3`
- `GET /healthz`: liveness
- `GET /metrics`: Prometheus-style metrics (include bearer if token set) — includes gauges for `audio_stream_up`, `audio_fallback_active`, `audio_last_switch_timestamp`, and string info via `audio_player_state_info{last_error="..."}`
- `GET /hwvolume`: returns current hardware mixer volume percent (if mixer available)
- `POST /hwvolume`: set hardware mixer volume percent, body: `{ "volume_percent": 75 }`

Auth:

- If `AUDIO_CONTROL_TOKEN` is set, add header `Authorization: Bearer <token>` for all endpoints (except `/healthz`).
- If using hardware mixer, set software `volume` to 1.0 to avoid double gain, and control loudness via `/hwvolume`.
