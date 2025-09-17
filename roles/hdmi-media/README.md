# HDMI Media Role

Plays video/audio to the TV over HDMI on Raspberry Pi 5 and exposes a token-protected control API on port 8082. Controls TV power/input via HDMI-CEC and now hosts the Zigbee hub stack for the fleet.

## Components

- Host-native mpv player (`mpv-hdmi@.service`) with JSON IPC socket at `/run/mpv.sock`.
- Control API (`media-control`), FastAPI over HTTP on `:8082` with bearer token, Prometheus `/metrics`, and `/healthz`.
- Zigbee hub services (`zigbee-mqtt`, `zigbee2mqtt`) expose MQTT on port 1883 and the Zigbee2MQTT web UI on port 8084.

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

`roles/hdmi-media/50-zigbee.yml` adds the Zigbee hub components. Additional environment variables:

### Environment configuration

Secrets were previously stored in an encrypted `.env.sops.enc`, but the file is now disabled as `.env.sops.enc.disabled`. Create a plain `.env` alongside the role with the required values (copy from `.env.example` as a starting point) and the agent will load it automatically. Missing `sops` binaries or decryption failures no longer abort the deployment; the agent logs a warning and continues with any plain-text env file.

- `ZIGBEE_SERIAL_PORT` (default `/dev/ttyACM0`)
- `ZIGBEE_MQTT_USER` / `ZIGBEE_MQTT_PASSWORD`
- `ZIGBEE_NETWORK_KEY`, `ZIGBEE_PAN_ID`, `ZIGBEE_EXT_PAN_ID`
- `ZIGBEE_CHANNEL` (default `11`)
- `ZIGBEE_PERMIT_JOIN` (default `false`)

## API

- `GET /healthz` -> `ok`
- `GET /metrics` (Prometheus)
- `GET /status` -> current mpv state
- `POST /play {"url":"...","start":0}`
- `POST /pause`, `POST /resume`, `POST /stop`
- `POST /seek {"seconds":10}`
- `POST /volume {"volume":80}`
- `POST /tv/power_on`, `POST /tv/power_off`
- `POST /tv/input` (marks device as active source)

Auth: set `MEDIA_CONTROL_TOKEN` and include header `Authorization: Bearer <token>` (except `/healthz`).

## Zigbee Hub Notes

- MQTT broker listens on `mqtt://<host>:1883` (loopback only unless firewall opened).
- Zigbee2MQTT UI available at `http://<host>:8084` (enable SSH tunnel or tailscale ACLs as needed).
- Initial device pairing requires `ZIGBEE_PERMIT_JOIN=true`; remember to set back to `false` afterwards.
- Persisted data lives in Docker volumes `zigbee_mosquitto_data` and `zigbee2mqtt_data`.
