# Audio Streaming Setup (Playback-Only)

This guide connects Raspberry Pi players (role `audio-player`) to an Icecast server running on your VPS.

## VPS: Icecast

1) On the VPS, ensure Docker is installed.
2) Create `infra/vps/icecast.env` from `infra/vps/icecast.env.example` and set strong passwords.
3) Start the server:
   ```bash
   docker compose -f infra/vps/compose.icecast.yml --env-file infra/vps/icecast.env up -d
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

### Fallback File and Control API

- The player automatically falls back to a local file if the stream is unavailable (auto mode). Upload a fallback file via the API as `/data/fallback.mp3`.

- API base URL: `http://<pi-host>:8081`
  - If you set `AUDIO_CONTROL_TOKEN`, include header `Authorization: Bearer <token>`.

- Endpoints:
  - `POST /upload` - multipart form-data with `file=@yourfile.mp3`
    ```bash
    curl -H 'Authorization: Bearer <token>' -F "file=@/path/to/fallback.mp3" http://<pi>:8081/upload
    ```
  - `PUT /config` - set stream URL, volume, mode, source
    ```bash
    curl -H 'Authorization: Bearer <token>' -X PUT http://<pi>:8081/config \
      -H 'Content-Type: application/json' \
      -d '{"stream_url":"http://<vps>:8000/<mount>","volume":1.0,"mode":"auto","source":"stream"}'
    ```
  - `POST /play` - switch source between stream/file
    ```bash
    curl -H 'Authorization: Bearer <token>' -X POST http://<pi>:8081/play -H 'Content-Type: application/json' -d '{"source":"file"}'
    ```
  - `POST /stop` - stop playback
  - `POST /volume` - set volume (0.0-2.0)
  - `GET /status` - current config and `fallback_exists`
  - `GET /metrics` - Prometheus-style metrics (requires same auth header if token set)

Security note: expose port 8081 only on trusted networks (e.g., via Tailscale ACLs). Use `AUDIO_CONTROL_TOKEN` to require a bearer token.

From the VPS, you can use the helper CLI:

```bash
AUDIOCTL_HOST=<pi-tailscale-ip-or-name> AUDIOCTL_TOKEN=<token> \
  ./scripts/audioctl.sh status
```

## Verify Stream

- On the VPS Icecast status page, check that your mount (e.g., `/pi-audio-01.opus`) is listed and receiving data from your chosen source.
- Open the stream URL in a modern player: `http://<vps-host>:8000/<mount>`.

## Notes

- For multiple players, assign additional hostnames in `inventory/devices.yaml` with role `audio-player`.
