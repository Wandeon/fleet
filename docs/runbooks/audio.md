# Audio Streaming Setup (Playback-Only)

This guide connects Raspberry Pi players (role `audio-player`) to an Icecast server running on your VPS.

## VPS: Icecast

1) On the VPS, ensure Docker is installed.
2) Create `vps/icecast.env` from `vps/icecast.env.example` and set strong passwords.
3) Start the server:
   ```bash
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
   ```
4) Open `http://<vps-host>:8000` and keep the Source password handy.

## Pi Hardware (HiFiBerry DAC+ Zero and similar)

### HiFiBerry DAC+ Zero (Playback HAT)

HiFiBerry DAC+ Zero is a DAC (output-only). It works great for a listening Pi.

If you're setting up a listening Pi with DAC+ Zero:

1) Enable the overlay on Raspberry Pi OS (Bookworm):
   - Edit `/boot/firmware/config.txt` and add:
     ```
     dtoverlay=hifiberry-dac
     dtparam=audio=off
     ```
   - Reboot the Pi.

2) Verify the output device:
   ```bash
   aplay -l
   # DAC+ Zero is typically card 0, device 0 -> hw:0,0
   ```

3) Map the device to the `audio-player` role in `inventory/devices.yaml` and ensure the convergence agent is running on the Pi (see `docs/runbooks/provisioning.md`).

## Pi: Audio Player Role (Output Only)

Use this when the Pi is a listener that plays audio out to an ALSA device (e.g., HiFiBerry DAC+ Zero).

1) Enable and verify the audio HAT per the steps above (HiFiBerry DAC+ Zero), then find the device:
   ```bash
   aplay -l
   # Example output device: hw:0,0
   ```

2) Configure role environment (on your workstation):
   ```bash
   cd roles/audio-player
   cp .env.example .env
   # Set AUDIO_OUTPUT_DEVICE (e.g., hw:0,0) and STREAM_URL (or ICECAST_* parts)
   # then encrypt into .env.sops.enc using your AGE key
   sops --encrypt --in-place --age <YOUR-AGE-PUBKEY> .env
   mv .env .ignored-local-env
   ```
   Commit only `.env.sops.enc`.

3) Map the device's hostname to role `audio-player` in `inventory/devices.yaml` and commit to `main`.

4) After convergence, the `audio-player` container starts and plays from the configured Icecast mount to your ALSA device.

Note: On first converge after repo updates, Compose builds the small `audio-player` and `audio-control` images on-device; this takes a bit longer only the first time.

### Control API and CLI

- The player automatically falls back to a local file if the stream is unavailable (auto mode). Upload a fallback file via the API as `/data/fallback.mp3`.
- API base URL: `http://<pi-host>:8081` — keep this on a trusted network (e.g., Tailscale). When `AUDIO_CONTROL_TOKEN` is set, every endpoint except `/healthz` requires `Authorization: Bearer <token>`.
- The status payload now includes runtime fields such as `requested_source`, `now_playing`, `fallback_active`, `stream_up`, and `last_switch_timestamp`. Logs persist on disk at `/data/player.log` (player loop) and `/data/control.log` (Flask API).

#### Endpoint reference

- `POST /upload` — multipart form upload (`file=@...`) that writes `/data/fallback.mp3`.
- `PUT /config` — update any of `stream_url`, `volume` (0.0–2.0), `mode` (`auto|manual`), or `source` (`stream|file|stop`). Values outside supported ranges are rejected.
- `POST /play` / `POST /stop` — switch sources; `/play` accepts `{"source":"stream"}` or `{"source":"file"}` and optional `{"mode":"manual"}`.
- `POST /volume` — `{ "volume": 0.8 }` to change the software gain.
- `GET /status` — merged config plus runtime state (`now_playing`, fallback flag, volume, stream health).
- `GET /metrics` — Prometheus text format (requires the Bearer token when auth is enabled).
- `GET /healthz` — unauthenticated liveness probe.

#### CLI helper (`scripts/audioctl.sh`)

| Action | Command | Notes |
| --- | --- | --- |
| Inspect state | `./scripts/audioctl.sh --host pi status` | Pretty-prints `/status`; add `--json` for raw output. |
| Check liveness | `./scripts/audioctl.sh --host pi health` | Returns the plain-text `/healthz` response. |
| Show metrics | `./scripts/audioctl.sh --host pi metrics` | Prints the first 20 lines from `/metrics`. |
| Set volume | `./scripts/audioctl.sh --host pi volume 0.80` | Validates 0.0–2.0 before calling `/volume`. |
| Play sources | `./scripts/audioctl.sh --host pi play stream` / `... play file` | Uses `POST /play`. |
| Stop playback | `./scripts/audioctl.sh --host pi stop` | Calls `POST /stop`. |
| Update stream URL | `./scripts/audioctl.sh --host pi set-url http://vps:8000/mount` | Writes through `PUT /config`. |
| Upload fallback | `./scripts/audioctl.sh --host pi upload ~/music/fallback.mp3` | Streams the file via multipart form. |
| Force mode/source | `./scripts/audioctl.sh --host pi mode manual` / `... source stop` | Sends targeted `PUT /config` updates. |

CLI flags: `--timeout` (seconds, default 5) and `--retries` (idempotent GETs) handle slow networks; `--json` disables `jq` pretty-printing. `--host`, `--port`, `--base-url`, and `--token` override the environment (`AUDIOCTL_HOST`, `AUDIOCTL_PORT`, `AUDIOCTL_BASE_URL`, `AUDIOCTL_TOKEN`).

Example session:

```bash
# Status and metrics
AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh status
AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh metrics

# Upload a fallback track and start it explicitly
./scripts/audioctl.sh --host pi-audio-01 --token <token> upload ~/Music/fallback.mp3
./scripts/audioctl.sh --host pi-audio-01 --token <token> play file

# Return to the stream at 80% volume, forcing auto mode
./scripts/audioctl.sh --host pi-audio-01 --token <token> volume 0.8
./scripts/audioctl.sh --host pi-audio-01 --token <token> mode auto
./scripts/audioctl.sh --host pi-audio-01 --token <token> play stream
```

#### Metrics and monitoring

The control API exposes Prometheus metrics at `/metrics` (token-protected when auth is enabled):

- `audio_volume` — current software gain.
- `audio_fallback_exists` — 1 when `/data/fallback.mp3` is present.
- `audio_fallback_active` — 1 while the fallback file is playing.
- `audio_stream_up` — 1 when the stream pipeline is healthy.
- `audio_last_switch_timestamp` — epoch seconds when playback last changed sources.
- `audio_source_state{source="stream|file|stop"}` — requested source flags from the config file.
- `audio_now_playing_state{state="stream|file|stop"}` — actual state reported by the player loop.
- `audio_mode_state{mode="auto|manual"}` — requested playback mode.
- `audio_player_state_info{last_error="..."}` — info gauge capturing the most recent player error string.

Point Prometheus at `vps/targets-audio.json` so each Pi is scraped on `:8081`. Grafana dashboards can graph `audio_stream_up` versus `audio_fallback_active` to confirm steady playback.

#### Troubleshooting

- `401 unauthorized` — Bearer token missing or wrong; export `AUDIOCTL_TOKEN` before running the CLI.
- Timeouts — confirm the Pi is reachable on your private network; inspect `/data/control.log` for API errors.
- Device offline — `/healthz` fails; SSH in and run `docker ps | grep audio-control` or inspect the agent logs. Review `/data/player.log` for ffmpeg failures.
- Silence while `now_playing=stream` — check `audio_player_state_info{last_error="..."}` and verify Icecast connectivity.

## Verify Stream

- On the VPS Icecast status page, check that your mount (e.g., `/pi-audio-01.opus`) is listed and receiving data from your chosen source.
- Open the stream URL in a modern player: `http://<vps-host>:8000/<mount>`.
- See `docs/acceptance-audio.md` for a scripted end-to-end check that exercises both Pis, Icecast, and the CLI in one run.

## Notes

- For multiple players, assign additional hostnames in `inventory/devices.yaml` with role `audio-player`.
