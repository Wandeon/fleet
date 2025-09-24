# Security & Authentication

Fleet relies on bearer tokens, private networking, and structured logging for access control. This document outlines credentials, token handling, and upcoming RBAC considerations.

## API & UI authentication

- **Control-plane bearer** – All API routes except `/healthz` and `/readyz` require `Authorization: Bearer <API_BEARER>`. Validation occurs in `apps/api/src/auth/bearer.ts`, returning `401` with `WWW-Authenticate` headers on failure. Configure `API_BEARER` in `vps/fleet.env` and ensure the UI SSR proxy (`FLEET_API_BASE`) injects it for `/ui/*` requests.【F:apps/api/src/auth/bearer.ts†L1-L34】【F:vps/fleet.env.example†L1-L49】【F:apps/ui/src/lib/server/proxy.ts†L1-L87】
- **UI runtime** – Production UI reads `API_BEARER`, `FLEET_API_BASE`, `ORIGIN`, and `VITE_USE_MOCKS=0` from `vps/fleet.env`. Client-side fetches rely on `configureApiClient` to attach browser-stored bearer tokens when necessary.【F:apps/ui/README.md†L39-L76】【F:apps/ui/src/lib/api/client.ts†L1-L80】
- **Operator sessions** – `vps/fleet.env.example` includes `AUTH_USERS`, `AUTH_SESSION_TTL`, and `SESSION_SECRET` placeholders for UI login. Ensure these are set with strong secrets and TLS-terminating Caddy handles cookies securely.【F:vps/fleet.env.example†L1-L33】

## Device tokens & network access

- Device control APIs require per-device bearer tokens. `inventory/device-interfaces.yaml` declares `token_env` (e.g., `AUDIO_PI_AUDIO_01_TOKEN`, `HDMI_PI_VIDEO_01_TOKEN`, `CAMERA_PI_CAMERA_01_TOKEN`). Populate them in `vps/fleet.env` so the API can authenticate upstream requests.【F:inventory/device-interfaces.yaml†L1-L162】【F:vps/fleet.env.example†L15-L33】
- Expose device control ports (8081–8084) only on private networks (Tailscale). README emphasises keeping control APIs behind Tailscale and using strong tokens; `/healthz` is intentionally unauthenticated for probes.【F:README.md†L96-L124】
- When proxies are used (e.g., Nginx on VPS), forward `Authorization` headers and restrict access via firewall/ACLs. Caddy already passes Authorization through for `/stream` and `/metrics`.【F:infra/vps/caddy.fleet.Caddyfile†L1-L20】

## Logging & auditing

- All services emit structured logs with `correlationId`, enabling traceability across API, worker, and device logs. Use `X-Correlation-Id` header in external scripts to tie actions together.【F:docs/runbooks/logging.md†L1-L74】
- API `/logs` endpoint provides a JSON/SSE feed for recent events; integrate with `/health/events/recent` to surface security-relevant incidents (failed auth, circuit breaker opens).【F:apps/api/src/routes/logs.ts†L1-L107】【F:apps/api/src/routes/health.ts†L1-L59】
- Keep audit data for library operations, Zigbee automation, and firmware updates per UX stories; implement event capture when building those features.【F:docs/ux/operator-jobs-and-stories.md†L98-L118】【F:docs/ux/operator-jobs-and-stories.md†L182-L202】

## Secrets management

- Device role secrets (tokens, MQTT creds) live in `.env.sops.enc` or plain `.env` (for hdmi-media after sops deprecation). Agents decrypt using `SOPS_AGE_KEY_FILE=/etc/fleet/age.key`. Ensure hosts maintain `/etc/fleet/agent.env` with shared values (Loki endpoint, Zigbee credentials).【F:roles/hdmi-media/README.md†L35-L78】【F:agent/role-agent.sh†L1-L120】
- VPS secrets include GHCR PAT, SSH key, and deploy parameters stored in GitHub Actions secrets (`GHCR_PAT`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `ACCEPTANCE_*`). Review regularly and rotate as needed.【F:README.md†L106-L151】

## Roadmap & RBAC

- Current auth is single bearer token. UX stories call for RBAC (zone-level control, playlist permissions, incident acknowledgement). Capture requirements in [17-ux-gaps-and-priorities](./17-ux-gaps-and-priorities.md) and plan API changes to support scoped tokens or user roles.
- When implementing user accounts, ensure audit trail persists operator identity in device events (`deviceEvent.origin`) and logs.

Refer to [23-alerting-and-integrations](./23-alerting-and-integrations.md) for external notification security and [21-file-and-asset-management](./21-file-and-asset-management.md) for handling sensitive uploads.
