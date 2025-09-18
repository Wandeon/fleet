# Fleet API (Express)

Minimal API scaffold to support the unified UI.

## Endpoints

### Core
- `GET /api/health` - aggregated device health from `inventory/device-interfaces.yaml`
- `GET /api/devices` - list registry entries (UI + monitoring metadata)
- `GET /api/devices/:id` - single device definition
- `GET /api/devices/:id/status` - proxy to the device `/status` endpoint
- `POST /api/operations/:device/:operation` - execute an operation declared in the registry
- `GET /api/logs`

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Video control
- `GET /api/video/files`
- `POST /api/video/files/upload`
- `DELETE /api/video/files/{fileId}`
- `POST /api/video/play`
- `POST /api/video/stop`
- `POST /api/video/devices/:id/tv/power`
- `POST /api/video/devices/:id/tv/volume`
- `POST /api/video/devices/:id/tv/input`
- `GET /api/video/devices/:id/health`

### Zigbee control
- `POST /api/zigbee/hubs/:id/permit-join`
- `GET /api/zigbee/hubs/:id/endpoints`
- `DELETE /api/zigbee/endpoints/:endpointId`
- `GET /api/zigbee/endpoints/:endpointId/status`

### Camera control
- `GET /api/camera/devices/:id/health`
- `GET /api/camera/devices/:id/stream`
- `POST /api/camera/devices/:id/snapshot`
- `POST /api/camera/devices/:id/recording`
- `GET /api/camera/events`

Security:
- NGINX in front provides CSP nonce and HSTS. API includes nonce passthrough middleware.
- Basic rate limits on /api/health and /api/logs.
- Optional session cookies with bearer fallback for UI login.

Run locally:
```bash
cd api && npm i && npm start
curl -fsS http://127.0.0.1:3005/api/health
```

## Configuration

### Environment variables

Load the API configuration from an env file (or your secrets manager). The minimal production values are:

```bash
NODE_ENV=production
PORT=3005
DEVICES_FILE=/app/config/devices.yaml
TARGETS_FILE=/app/config/targets-audio.json
PROM_URL=http://prometheus:9090/-/healthy
BLACKBOX_URL=http://blackbox:9115

# Device bearer tokens (replace with the real secrets)
AUDIO_PI_AUDIO_01_TOKEN=change-me
AUDIO_PI_AUDIO_02_TOKEN=change-me
HDMI_PI_VIDEO_01_TOKEN=change-me
VIDEO_DATA_DIR=/app/data
CAMERA_PI_CAMERA_01_TOKEN=change-me

# UI authentication
AUTH_USERS="admin:supersecret"
# or AUTH_USERS_JSON='[{"username":"admin","password":"supersecret"}]'
AUTH_ALLOW_FALLBACK=false
AUTH_SESSION_TTL=43200
AUTH_COOKIE_NAME=session
AUTH_COOKIE_SECURE=true

# Zigbee bridge (defaults derive from inventory if unset)
ZIGBEE_MQTT_URL=mqtt://pi-video-01:1883
ZIGBEE_MQTT_USER=zigbee
ZIGBEE_MQTT_PASSWORD=change-me
ZIGBEE_MQTT_BASE_TOPIC=zigbee2mqtt
```

Point your `docker-compose.yml` service at the env file, for example:

```yaml
services:
  api:
    env_file:
      - /opt/app/.env
```

### Device registry sync

The API expects a canonical device registry at `/app/config/devices.yaml`. Copy `inventory/device-interfaces.yaml` into that path whenever the inventory changes:

```bash
cp -a /opt/app/devices.yaml /opt/app/devices.yaml.bak 2>/dev/null || true
cp -a /opt/app/devices-extended.yaml /opt/app/devices-extended.yaml.bak 2>/dev/null || true
mkdir -p /opt/app/config
cp /opt/fleet/inventory/device-interfaces.yaml /opt/app/config/devices.yaml
```

`DEVICES_FILE` accepts either the legacy map format (`inventory/devices.yaml`) or the interface registry array. Normalise the schema once, keep `/app/config/devices.yaml` as the source of truth, and mount it read-only into the container.

### Health endpoints & auth

- `/healthz` on each device API is public so Prometheus and uptime probes never require tokens.
- All other control routes (`/status`, `/play`, `/volume`, `/tv/*`, `/probe`, etc.) remain bearer-protected. The API keeps bearer support when proxying to devices and layers optional UI login sessions on top.
- The API stops attaching bearer headers when polling `/healthz`; probes and scripts such as `scripts/acceptance.sh` likewise call `/healthz` unauthenticated.

### External dependencies

- `PROM_URL` should target Prometheus inside the compose network (`http://prometheus:9090/-/healthy`). Host port remaps like `9091` are for dashboards only.
- `BLACKBOX_URL` should hit the exporter root (`http://blackbox:9115`). Treating `/metrics` as a liveness check is brittle.
- `ffmpeg` and `ffprobe` must be available in `PATH` for video thumbnail extraction.
- Prefer Tailscale DNS names for device targets; if you must pin IPs, reserve them in ACLs so they survive re-authentication.




