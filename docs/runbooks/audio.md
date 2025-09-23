# Audio Streaming Setup (Playback-Only)

This guide connects Raspberry Pi audio players (role `audio-player`) to an
Icecast stream and explains how to operate the control API, CLI tooling, and
monitoring. After preparing the infrastructure, follow
[`docs/acceptance-audio.md`](../acceptance-audio.md) to prove end-to-end playback
on every device.

## VPS: Icecast & Monitoring

1. Install Docker on the VPS and fetch the Fleet repository.
2. Create the Icecast environment file and provide strong credentials:
   ```bash
   cp vps/icecast.env.example vps/icecast.env
   # edit vps/icecast.env
   ```
3. Start Icecast:
   ```bash
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
   ```
4. Browse to `http://<vps-host>:8000` to confirm the server is up. The acceptance
   script performs a `HEAD` request against the mount; keep the mount URL handy.
5. Ensure Prometheus scrapes every player via `vps/targets-audio.json`. One
   entry per host (ideally the Tailscale DNS name) is sufficient:
   ```json
   [
     { "targets": ["pi-audio-01:8081"], "labels": {"role": "audio-player", "instance": "pi-audio-01"} },
     { "targets": ["pi-audio-02:8081"], "labels": {"role": "audio-player", "instance": "pi-audio-02"} }
   ]
   ```
   Restart the monitoring stack after editing the targets file so Prometheus
   picks up the changes.

> :lock: **Security** — expose port `8081` only on trusted networks (e.g.,
> Tailscale) and set `AUDIO_CONTROL_TOKEN` so every control/API call requires a
> Bearer token.

## Pi Hardware (HiFiBerry DAC+ Zero and similar)

1. Enable the HiFiBerry overlay (`dtoverlay=hifiberry-dac` and
   `dtparam=audio=off`) in `/boot/firmware/config.txt`, then reboot.
2. Verify the output card:
   ```bash
   aplay -l
   # DAC+ Zero is typically card 0, device 0 -> hw:0,0
   ```
3. Provision the host following [`docs/runbooks/provisioning.md`](./provisioning.md)
   so the role agent can converge the audio-player overlay.

## Role Configuration

1. Configure secrets/environment for the role:
   ```bash
   cd roles/audio-player
   cp .env.example .env
   # Set AUDIO_OUTPUT_DEVICE (e.g. hw:0,0), STREAM_URL (or ICECAST_* parts),
   # optional AUDIO_CONTROL_TOKEN, and mixer overrides if used.
   sops --encrypt --in-place --age <YOUR-AGE-PUBKEY> .env
   mv .env .ignored-local-env
   ```
2. Map each Pi to role `audio-player` in `inventory/devices.yaml` and push to
   `main`. The agent will decrypt `.env.sops.enc`, export the `AUDIO_*`
   variables, and run the Compose overlay.
3. A fallback file lives at `/data/fallback.mp3`. The player automatically loops
   it when the stream fails (auto mode). Upload a new fallback via the control
   API (see below).

## Control API & CLI

The control API listens on `:8081` and exposes:

- `GET /healthz` — unauthenticated liveness probe.
- `GET /status` — current config, playback state, fallback existence.
- `GET /config` / `PUT /config` — read/write config fields (`stream_url`,
  `volume`, `mode`, `source`).
- `POST /play`, `POST /stop`, `POST /volume`, `POST /upload` — operational
  controls and fallback upload.
- `GET /metrics` — Prometheus metrics (requires Bearer token when configured).

Use `scripts/audioctl.sh` for consistent, authenticated access:

| Command | Description |
| --- | --- |
| `status` | Pretty-print `/status` |
| `config` | Pretty-print `/config` |
| `health` | Check `/healthz` |
| `metrics` | Show the first 20 lines of `/metrics` |
| `volume 0.8` | Set software volume (0.0–2.0) |
| `play stream` / `play file` | Switch playback source |
| `stop` | Stop playback |
| `set-url http://vps:8000/mount` | Update `stream_url` via `PUT /config` |
| `mode auto` / `mode manual` | Toggle automatic fallback mode |
| `source stream|file|stop` | Persist desired source via `PUT /config` |
| `upload /path/to/fallback.mp3` | Upload a new fallback file |

Flags:

- `--host`, `--token` — override `AUDIOCTL_HOST` / `AUDIOCTL_TOKEN` env vars.
- `--timeout <seconds>` — adjust curl timeout (default 5s).
- `--retries <n>` — retry idempotent GETs (status/metrics/health) on failure.
- `--json` — print raw JSON (skips pretty-print via `jq`).

Example session:

```bash
AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=secret ./scripts/audioctl.sh status
./scripts/audioctl.sh --host pi-audio-01 --token secret volume 0.80
./scripts/audioctl.sh --host pi-audio-01 --token secret upload ~/music/fallback.mp3
./scripts/audioctl.sh --host pi-audio-01 --token secret metrics
```

## Metrics & Monitoring

`GET /metrics` exports Prometheus gauges that describe playback state:

- `audio_stream_up` — `1` when the stream pipeline is active.
- `audio_fallback_active` — `1` when the fallback file is playing.
- `audio_fallback_exists` — `1` when `/data/fallback.mp3` exists.
- `audio_volume` — current software volume (0.0–2.0).
- `audio_last_switch_timestamp` — Unix timestamp of the last source change.
- `audio_status_age_seconds` — freshness of `status.json` updates.
- `audio_stream_probe_last_success` / `_last_failure` — stream probe timestamps.
- `audio_config_mode{mode="auto|manual"}` — desired fallback mode.
- `audio_current_source{state="stream|file|stop"}` — currently playing source.
- `audio_target_state{...}` & `audio_desired_source{...}` — target/desire states
  from config/status.
- `audio_hw_mixer_percent` — hardware mixer volume (when mixer is configured).

Dashboards in `vps/grafana-dashboard-audio.json` consume these metrics. Pair them
with `vps/targets-audio.json` so Prometheus scrapes each player directly.

## Troubleshooting

- **401 Unauthorized** — ensure `AUDIO_CONTROL_TOKEN` matches `--token` or
  `AUDIOCTL_TOKEN`. The API rejects all calls except `/healthz` when a token is
  configured.
- **Timeouts** — add `--timeout`/`--retries` to `audioctl.sh` for slow links.
  Confirm `/healthz` responds and that the host is reachable on Tailscale.
- **Device offline** — run the acceptance workflow
  (`docs/acceptance-audio.md`). It checks `/healthz`, `/status`, ALSA devices,
  optional Icecast reachability, and can trigger stream playback on both Pis.
- **No audio** — verify `aplay -l` shows the expected card, upload a fallback
  file, and inspect `/data/logs/player.log` via SSH (`docker exec` if needed).
- **Metrics stale** — confirm Prometheus scrapes `:8081/metrics` with the Bearer
  token and that `audio_status_age_seconds` stays low (<60s).

## Next Steps

Follow [`docs/acceptance-audio.md`](../acceptance-audio.md) to run the automated
acceptance script and document the playback proof for both devices.
