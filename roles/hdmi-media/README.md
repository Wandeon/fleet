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
sudo install -m 0644 roles/hdmi-media/etc-default-hdmi-media /etc/default/hdmi-media
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
- `CEC_DEVICE_INDEX` (default `0`; select `/dev/cec0` or `/dev/cec1`)

`roles/hdmi-media/50-zigbee.yml` adds the Zigbee hub components. Additional environment variables:

### Environment configuration

Secrets were previously stored in an encrypted `.env.sops.enc`, but the file is now disabled as `.env.sops.enc.disabled`. Create a plain `.env` alongside the role with the required values (copy from `.env.example` as a starting point) and the agent will load it automatically. Missing `sops` binaries or decryption failures no longer abort the deployment; the agent logs a warning and continues with any plain-text env file.

The agent also sources `/etc/fleet/agent.env` on the host before composing. Populate this file with Zigbee settings so restarts (or manual runs) keep the same serial port and credentials. Example snippet for `pi-video-01`:

```bash
sudo install -m 0755 -d /etc/fleet
sudo tee /etc/fleet/agent.env >/dev/null <<'ENV'
# Stable path to the ConBee (adjust to your adapter)
ZIGBEE_SERIAL=/dev/serial/by-id/usb-dresden_elektronik_ConBee_III_DE03311823-if00-port0
# Broker credentials consumed by Mosquitto + Zigbee2MQTT
ZIGBEE_MQTT_USER=zigbee
ZIGBEE_MQTT_PASSWORD=please-change-me
ENV
```

The agent mirrors `ZIGBEE_SERIAL` into `ZIGBEE_SERIAL_PORT` automatically when only the former is defined, so the compose files receive the stable path.

- `CEC_DEVICE_INDEX` (default `0`; select `/dev/cec0` or `/dev/cec1`)
- `CEC_OSD_NAME` (default `%H`; used when registering the playback device name)
- `ZIGBEE_SERIAL_PORT` (set this to the stable `/dev/serial/by-id/...` path for your coordinator; falls back to `/dev/ttyACM0` if unset)
- `ZIGBEE_MQTT_USER` / `ZIGBEE_MQTT_PASSWORD` (must exist so the agent can generate `/mosquitto/data/passwordfile`)
- `ZIGBEE_NETWORK_KEY`, `ZIGBEE_PAN_ID`, `ZIGBEE_EXT_PAN_ID`
- `ZIGBEE_CHANNEL` (default `11`)
- Copy `roles/hdmi-media/etc-default-hdmi-media` to `/etc/default/hdmi-media` so systemd units and containers share the same defaults.
- Override `CEC_DEVICE_INDEX` per host to match the active HDMI connector. Example inventory stanza:

```ini
[pi_video]
pi-video-01 CEC_DEVICE_INDEX=0
pi-video-02 CEC_DEVICE_INDEX=1
```

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

### Resetting the Zigbee stack on `pi-video-01`

If the coordinator path changes or Mosquitto loops with `passwordfile` errors, reapply the host env and rebuild the role with this block. It sets a stable serial path, regenerates the password file, and restarts the containers:

```bash
# === pi-video-01: fix Zigbee serial + Mosquitto auth and rebuild ===
set -euo pipefail

# 1) Set/refresh host-level env used by the role (edit the creds as needed)
sudo install -m 0755 -d /etc/fleet
sudo tee /etc/fleet/agent.env >/dev/null <<'ENV'
# Stable path to the ConBee III
ZIGBEE_SERIAL=/dev/serial/by-id/usb-dresden_elektronik_ConBee_III_DE03311823-if00-port0

# Broker credentials the stack expects (choose secure values)
ZIGBEE_MQTT_USER=zigbee
ZIGBEE_MQTT_PASSWORD=please-change-me
ENV

# 2) Remove any old, manually-run zigbee2mqtt container that might collide
docker rm -f zigbee2mqtt >/dev/null 2>&1 || true

# 3) Run the agent to recreate the compose project with the new env
sudo /opt/fleet/agent/role-agent.sh

# 4) Create the Mosquitto password file inside the broker's data volume
MQTT_CONT="$(docker ps --filter name=zigbee-mqtt -q | head -n1)"
if [ -n "$MQTT_CONT" ]; then
  docker exec "$MQTT_CONT" sh -lc '
    set -e
    : "${ZIGBEE_MQTT_USER:?missing}"; : "${ZIGBEE_MQTT_PASSWORD:?missing}"
    mosquitto_passwd -b /mosquitto/data/passwordfile "$ZIGBEE_MQTT_USER" "$ZIGBEE_MQTT_PASSWORD"
    # Make sure perms are readable by mosquitto user
    chown mosquitto:mosquitto /mosquitto/data/passwordfile || true
    chmod 600 /mosquitto/data/passwordfile || true
  '
  # Bounce broker + zigbee2mqtt to pick up the password file
  docker restart "$MQTT_CONT" >/dev/null
fi

Z2M_CONT="$(docker ps --filter name=zigbee2mqtt -q | head -n1)"
[ -n "$Z2M_CONT" ] && docker restart "$Z2M_CONT" >/dev/null || true

echo "Done. Give the services ~10-20s to settle, then run the test block."
```

After ~20 seconds run the quick checks to confirm serial + auth are healthy:

```bash
# === pi-video-01: quick checks ===

# 1) Serial is stable and visible
ls -l /dev/serial/by-id
docker exec "$(docker ps --filter name=zigbee2mqtt -q | head -n1)" ls -l /dev/ttyUSB0 || true

# 2) Broker came up and has a password file
docker logs "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" --tail=80 | sed -n '1,120p'
docker exec "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" sh -lc 'ls -l /mosquitto/data/passwordfile && head -c 0 /mosquitto/data/passwordfile && echo " [exists]"'

# 3) Zigbee2MQTT connected to MQTT and opened the adapter
docker logs "$(docker ps --filter name=zigbee2mqtt -q | head -n1)" --tail=120 | sed -n '1,200p'

# 4) Optional: publish a test message (should not error)
docker exec "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" \
  sh -lc 'mosquitto_pub -u "$ZIGBEE_MQTT_USER" -P "$ZIGBEE_MQTT_PASSWORD" -h localhost -t test/topic -m hello && echo "MQTT pub ok"'
```

**Why it works**

- Uses the `/dev/serial/by-id/...` symlink so the ConBee path stays consistent across reboots.
- Ensures Mosquitto's `/mosquitto/data/passwordfile` exists with credentials that match Zigbee2MQTT.
- Removes stray containers so only the compose-managed services own the ports.

## Validation Checklist
1. Pick the correct adapter: `sudo cec-ctl --list-devices` and update `/etc/default/hdmi-media` so `CEC_DEVICE_INDEX` matches `/dev/cec*`.
2. Reload units and restart: `sudo systemctl daemon-reload`, then `sudo systemctl enable --now cec-setup.service`; restart your media-control stack so it inherits the env (e.g. `docker compose restart media-control`).
3. Confirm a logical address is claimed: `sudo cec-ctl -d$CEC_DEVICE_INDEX -L` should show Playback Device 1.
4. Exercise the API locally: `curl -X POST http://127.0.0.1:8082/tv/power_on` and `curl -X POST http://127.0.0.1:8082/tv/power_off`.
5. Trace traffic if needed: `sudo cec-ctl -d$CEC_DEVICE_INDEX --monitor --trace` and trigger `/tv/power_on` to watch for ACKs.

## UI Integration Reference

### Device Information
- Device type: hdmi-media (Raspberry Pi 5)
- Base URL: http://pi-video-01:8082
- Authentication: Bearer token required (`changeme-token`)
- Zigbee hub UI: http://pi-video-01:8084
- MQTT broker: mqtt://pi-video-01:1883

### Media Player Controls

**Status / monitoring**
- `GET /healthz` -> "ok"
- `GET /status` (returns JSON status payload)
- `GET /metrics` (Prometheus)

Example `GET /status` response:
```json
{
  "pause": false,
  "time_pos": 12.0,
  "duration": 3600.0,
  "volume": 80,
  "path": "http://example.com/video.mp4"
}
```

**Playback**
- `POST /play` with body `{ "url": "http://example.com/video.mp4", "start": 0 }`
- `POST /pause`
- `POST /resume`
- `POST /stop`

**Navigation**
- `POST /seek` with body `{ "seconds": 10 }` (negative values seek backward)

**Audio**
- `POST /volume` with body `{ "volume": 80 }` (0-100)

### TV / Display Controls (HDMI-CEC)
- `POST /tv/power_on`
- `POST /tv/power_off`
- `POST /tv/input`

### Zigbee Hub Controls
- MQTT endpoint: mqtt://pi-video-01:1883 (username `zigbee`, password `zigbee-password`)
- Topics follow Zigbee2MQTT convention: `zigbee2mqtt/...`
- Web interface: http://pi-video-01:8084
- Pairing requires `ZIGBEE_PERMIT_JOIN=true`

### Device Configuration Defaults
- HDMI connector: `HDMI-A-1`
- Audio device: `plughw:vc4hdmi,0`
- CEC device index: `0` (set `CEC_DEVICE_INDEX=1` for `/dev/cec1`)
- Zigbee serial port: `/dev/ttyACM0`
- Zigbee channel: `11`
- Zigbee PAN ID: `0x1A62`

### Authentication Header
All media control endpoints (except `/healthz`) require:
```
Authorization: Bearer changeme-token
```

### Integration Examples

**Remote playback control**
```javascript
// Play video
fetch('http://pi-video-01:8082/play', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer changeme-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com/video.mp4',
    start: 30
  })
});

// Get current status
fetch('http://pi-video-01:8082/status', {
  headers: { 'Authorization': 'Bearer changeme-token' }
});
```

**Zigbee device control via MQTT**
```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://pi-video-01:1883', {
  username: 'zigbee',
  password: 'zigbee-password'
});

client.publish('zigbee2mqtt/device_name/set', JSON.stringify({ state: 'ON' }));
```

This device provides full media playback control, HDMI-CEC power and input management, and doubles as the Zigbee hub for smart home integration.

