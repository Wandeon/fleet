# Fleet API (Express)

Minimal API scaffold to support the unified UI.

Endpoints:
- `GET /api/health` – aggregated device health from `inventory/device-interfaces.yaml`
- `GET /api/devices` – list registry entries (UI + monitoring metadata)
- `GET /api/devices/:id` – single device definition
- `GET /api/devices/:id/status` – proxy to the device’s `/status` endpoint
- `POST /api/operations/:device/:operation` – execute an operation declared in the registry
- `GET /api/logs`

Security:
- NGINX in front provides CSP nonce and HSTS. API includes nonce passthrough middleware.
- Basic rate limits on /api/health and /api/logs.

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
CAMERA_PI_CAMERA_01_TOKEN=change-me
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
- All other control routes (`/status`, `/play`, `/volume`, `/tv/*`, `/probe`, etc.) remain bearer-protected.
- The API stops attaching bearer headers when polling `/healthz`; probes and scripts such as `scripts/acceptance.sh` likewise call `/healthz` unauthenticated.

### External dependencies

- `PROM_URL` should target Prometheus inside the compose network (`http://prometheus:9090/-/healthy`). Host port remaps like `9091` are for dashboards only.
- `BLACKBOX_URL` should hit the exporter root (`http://blackbox:9115`). Treating `/metrics` as a liveness check is brittle.
- Prefer Tailscale DNS names for device targets; if you must pin IPs, reserve them in ACLs so they survive re-authentication.

