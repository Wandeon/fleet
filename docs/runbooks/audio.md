# Audio Streaming Setup

This guide connects a Raspberry Pi (role `audio`) to an Icecast server running on your VPS.

## VPS: Icecast

1) On the VPS, ensure Docker is installed.
2) Create `vps/icecast.env` from `vps/icecast.env.example` and set strong passwords.
3) Start the server:
   ```bash
   docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
   ```
4) Open `http://<vps-host>:8000` and keep the Source password handy.

## Pi: Audio Client Role

1) Hardware: attach an audio interface.
   - For capturing/streaming (this role): use a USB sound card with line-in/mic or an ADC HAT (e.g., AudioInjector, HiFiBerry ADC).
   - For playback-only HATs like HiFiBerry DAC+ Zero: see the HiFiBerry note below (this HAT is output-only and cannot capture).

2) Find the ALSA device for your input:
   ```bash
   arecord -l
   # Example input device string: hw:1,0
   ```

3) Configure secrets for the role via SOPS (on your workstation):
   ```bash
   cd roles/audio
   cp .env.example .env
   # edit .env with your ALSA input device and ICECAST_* values
   # then encrypt into .env.sops.enc
   sops --encrypt --in-place --age <YOUR-AGE-PUBKEY> .env
   mv .env .ignored-local-env
   ```
   Commit only `.env.sops.enc`.

### HiFiBerry DAC+ Zero (Playback HAT)

HiFiBerry DAC+ Zero is a DAC (output-only). It works great for a listening Pi, not for recording/streaming. If you intend this Pi to capture and stream, use a USB sound card with input or an ADC-capable HAT instead.

If you’re setting up a listening Pi with DAC+ Zero:

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

3) For a playback role, the pipeline should pull from Icecast and play to ALSA (e.g., `hw:0,0`). If you’d like, I can add a dedicated `audio-player` role that runs an FFmpeg/MPV/GStreamer client targeting the HiFiBerry device.

4) If using output-only, map the device to the `audio-player` role in `inventory/devices.yaml`.

5) Ensure the convergence agent is running on the Pi (see `docs/runbooks/provisioning.md`).

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

3) Map the device’s hostname to role `audio-player` in `inventory/devices.yaml` and commit to `main`.

4) After convergence, the `audio-player` container starts and plays from the configured Icecast mount to your ALSA device.

### Fallback File and Control API

- The player automatically falls back to a local file if the stream is unavailable (auto mode). Upload a fallback file via the API as `/data/fallback.mp3`.

- API base URL: `http://<pi-host>:8081`
  - If you set `AUDIO_CONTROL_TOKEN`, include header `Authorization: Bearer <token>`.

- Endpoints:
  - `POST /upload` — multipart form-data with `file=@yourfile.mp3`
    ```bash
    curl -H 'Authorization: Bearer <token>' -F "file=@/path/to/fallback.mp3" http://<pi>:8081/upload
    ```
  - `PUT /config` — set stream URL, volume, mode, source
    ```bash
    curl -H 'Authorization: Bearer <token>' -X PUT http://<pi>:8081/config \
      -H 'Content-Type: application/json' \
      -d '{"stream_url":"http://<vps>:8000/<mount>","volume":1.0,"mode":"auto","source":"stream"}'
    ```
  - `POST /play` — switch source between stream/file
    ```bash
    curl -H 'Authorization: Bearer <token>' -X POST http://<pi>:8081/play -H 'Content-Type: application/json' -d '{"source":"file"}'
    ```
  - `POST /stop` — stop playback
  - `POST /volume` — set volume (0.0–2.0)
  - `GET /status` — current config and `fallback_exists`
  - `GET /metrics` — Prometheus-style metrics (requires same auth header if token set)

Security note: expose port 8081 only on trusted networks (e.g., via Tailscale ACLs). Use `AUDIO_CONTROL_TOKEN` to require a bearer token.

From the VPS, you can use the helper CLI:

```bash
AUDIOCTL_HOST=<pi-tailscale-ip-or-name> AUDIOCTL_TOKEN=<token> \
  ./scripts/audioctl.sh status
```

## Verify Stream

- On the VPS Icecast status page, check that your mount (e.g., `/pi-audio-01.opus`) is listed and receiving data.
- Open the stream URL in a modern player: `http://<vps-host>:8000/<mount>`.

## Notes

- The encoder is Opus-in-Ogg at 48 kHz. Adjust `AUDIO_BITRATE`, channels, etc., as needed.
- For a second Pi, copy the role secrets with a different `ICECAST_MOUNT` and `ICECAST_NAME`.
