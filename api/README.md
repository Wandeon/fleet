# Fleet API (Express)

Minimal API scaffold to support the unified UI.

Endpoints:
- GET /api/health
- GET/POST /api/devices
- GET /api/logs
- POST /api/operations/audio/*

Security:
- NGINX in front provides CSP nonce and HSTS. API includes nonce passthrough middleware.
- Basic rate limits on /api/health and /api/logs.

Run locally:
```bash
cd api && npm i && npm start
curl -fsS http://127.0.0.1:3005/api/health
```

