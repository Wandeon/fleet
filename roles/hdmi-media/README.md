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

