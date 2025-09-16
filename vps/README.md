# VPS Monitoring Stack

This directory contains Docker Compose files for the central monitoring stack and optional streaming services.

## Grafana Credentials

The Grafana service reads credentials from `monitoring.env`. Create this file
from the provided example and supply secure values:

```bash
cp monitoring.env.example monitoring.env
# edit monitoring.env and set GF_SECURITY_ADMIN_USER and GF_SECURITY_ADMIN_PASSWORD
```

> **Note:** Never commit `monitoring.env` to version control.

## Icecast Server

Run an Icecast server to accept audio streams from Raspberry Pi audio clients.

1) Create env file from the example and set strong passwords:

```bash
cp vps/icecast.env.example vps/icecast.env
# edit vps/icecast.env
```

2) Start Icecast on the VPS:

```bash
docker compose -f vps/compose.icecast.yml --env-file vps/icecast.env up -d
```

3) Verify:

- Visit `http://<vps-host>:8000` to see the Icecast status page.
- When a Pi connects, a mount (e.g., `/pi-audio-01.opus`) appears.

4) Verify effective config inside container (passwords match env):

```bash
docker exec icecast sh -lc "grep -o '<source-password>.*</source-password>' /etc/icecast.xml || true"
```

### Network Access

- If using a public VPS, open TCP port `8000` in your firewall (or change the published port in `vps/compose.icecast.yml`).
- If using Tailscale only, set `ICECAST_HOST` to the VPS Tailscale IP/hostname and you do not need to expose port 8000 publicly.

## Monitoring Devices

Prometheus scrapes each device class using file-based service discovery. Targets are maintained automatically from `inventory/device-interfaces.yaml`; run the validation script after editing the registry:

```bash
node scripts/validate-device-registry.mjs
docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus
```

Targets:

- Audio players: `vps/targets-audio.json`
- HDMI/Zigbee hub: `vps/targets-hdmi-media.json`
- Camera control: `vps/targets-camera.json`

Dashboards:

- Audio playback: `vps/grafana-dashboard-audio.json`
- Create additional dashboards for HDMI or camera roles using the exported metrics (`media_playing`, `camera_stream_online`, etc.).

Health checks:

- Audio players: `GET /healthz` on :8081
- HDMI media controller: `GET /healthz` on :8082
- Camera control service: `GET /healthz` on :8083 (also probes HLS and RTSP)

## Optional: API Reverse Proxy

If you prefer to access a Pi’s control API via the VPS hostname, set up an Nginx proxy (single target example):

1) Create `vps/audio-proxy.conf` from the example below and set your Pi’s Tailscale IP.

```nginx
server {
  listen 8082;
  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://100.101.102.103:8081; # Pi Tailscale IP
  }
}
```

2) Run a simple proxy container:

```bash
docker run -d --name audio-proxy --restart unless-stopped -p 8082:8082 \
  -v $(pwd)/vps/audio-proxy.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine
```

> You still need to include the bearer `Authorization` header if `AUDIO_CONTROL_TOKEN` is set.
