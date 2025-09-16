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

