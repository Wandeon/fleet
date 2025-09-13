# HDMI Media Role

Plays video/audio to the TV over HDMI on Raspberry Pi 5 and exposes a token-protected control API on port 8082. Controls TV power/input via HDMI-CEC.

## Components

- Host-native mpv player (`mpv-hdmi@.service`) with JSON IPC socket at `/run/mpv.sock`.
- Control API (`media-control`), FastAPI over HTTP on `:8082` with bearer token, Prometheus `/metrics`, and `/healthz`.

## Install (host prerequisites)

```bash
./roles/hdmi-media/install.sh
# Enable (optional) units
sudo cp roles/hdmi-media/systemd/mpv-hdmi@.service /etc/systemd/system/
sudo cp roles/hdmi-media/systemd/cec-setup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mpv-hdmi@hdmi.service
# Optional CEC power-on at boot
sudo systemctl enable --now cec-setup.service
```

## Compose Overlay

`roles/hdmi-media/40-app.yml` defines `media-control` (host network) and expects:

- `MEDIA_CONTROL_TOKEN` (required)
- `HDMI_CONNECTOR` (default `HDMI-A-1`)
- `HDMI_AUDIO_DEVICE` (default `plughw:vc4hdmi,0`)

## API

- `GET /healthz` → `ok`
- `GET /metrics` (Prometheus)
- `GET /status` → current mpv state
- `POST /play {"url":"…","start":0}`
- `POST /pause`, `POST /resume`, `POST /stop`
- `POST /seek {"seconds":10}`
- `POST /volume {"volume":80}`
- `POST /tv/power_on`, `POST /tv/power_off`
- `POST /tv/input` (marks device as active source)

Auth: set `MEDIA_CONTROL_TOKEN` and include header `Authorization: Bearer <token>` (except `/healthz`).

