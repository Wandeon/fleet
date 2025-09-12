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

### Network Access

- If using a public VPS, open TCP port `8000` in your firewall (or change the published port in `vps/compose.icecast.yml`).
- If using Tailscale only, set `ICECAST_HOST` to the VPS Tailscale IP/hostname and you do not need to expose port 8000 publicly.

## Monitoring Audio Players

Prometheus can scrape the audio-control `/metrics` endpoints.

1) Create `vps/targets-audio.json` from the example and list your Pi(s):

```json
[
  { "targets": ["<pi-ts-ip>:8081"], "labels": {"role": "audio-player", "instance": "pi-audio-01"} }
]
```

2) Ensure the compose mounts the file (already configured) and restart Prometheus:

```bash
docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus
```

3) Import the sample Grafana dashboard `vps/grafana-dashboard-audio.json` via Grafana UI (Dashboards → Import).

> If `AUDIO_CONTROL_TOKEN` is set, Prometheus must access without auth. Keep :8081 accessible only on your private network (e.g., Tailscale) and restrict who can reach it.

Health:
- Each player exposes `GET /healthz`; the control container also has an internal healthcheck.

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
