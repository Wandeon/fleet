# Fleet Platform – UI & Control Plane Onboarding Guide

This briefing walks a new frontend or full-stack developer through the moving parts of the fleet platform so they can confidently ship UI and API changes without breaking device orchestration.

## 1. How the fleet is managed
- **GitOps source of truth.** Every Raspberry Pi runs the `agent/role-agent.sh` convergence script on a systemd timer. It pulls `main`, merges the `baseline/` stack with the role declared in `inventory/devices.yaml`, applies host env overrides from `/etc/fleet/agent.env`, and keeps role services running.【F:README.md†L1-L139】【F:agent/role-agent.sh†L4-L200】
- **Device registry.** `inventory/device-interfaces.yaml` provides display names, control endpoints, Prometheus targets, and UI-friendly operation metadata. The API seeds Prisma’s `Device` table from this file so the UI sees a consistent schema.【F:README.md†L7-L160】【F:api/src/scripts/seed-from-yaml.ts†L6-L126】
- **Baseline services everywhere.** Netdata and Promtail are composed on every host, exporting metrics and logs centrally; configure `LOKI_ENDPOINT`, `LOG_SOURCE_HOST`, and related labels in `/etc/fleet/agent.env` before convergence.【F:baseline/docker-compose.yml†L1-L59】【F:docs/runbooks/logging.md†L5-L82】

## 2. Device catalog & capabilities
- **Inventory overview.** Four devices are currently declared: two audio players, one HDMI/Zigbee controller, and one camera. `logs: true` with `loki_source` enables centralized log discovery for each host.【F:inventory/devices.yaml†L1-L20】
- **Audio players (`pi-audio-01`, `pi-audio-02`).** Control API on `:8081` with bearer tokens (`AUDIO_PI_AUDIO_0*_TOKEN`). Operations include health/status probes, play (stream/file/stop), and a 0–2 volume slider. Prometheus scrapes `/metrics` on the same port.【F:inventory/device-interfaces.yaml†L2-L165】【F:docs/runbooks/audio.md†L66-L100】
- **HDMI media & Zigbee hub (`pi-video-01`).** FastAPI control service on `:8082` with `/healthz`, `/status`, `/metrics`, playback controls, and TV CEC operations; Zigbee2MQTT UI lives on `:8084`. Bearer token comes from `HDMI_PI_VIDEO_01_TOKEN`. Prometheus job name `media-control` scrapes this host.【F:inventory/device-interfaces.yaml†L166-L245】【F:roles/hdmi-media/README.md†L1-L90】
- **Camera controller (`pi-camera-01`).** FastAPI control on `:8083` with `/healthz`, `/status`, `/probe`, `/metrics` plus RTSP/HLS stream URLs. Token provided by `CAMERA_PI_CAMERA_01_TOKEN`. Prometheus job `camera-control` targets `:8083`.【F:inventory/device-interfaces.yaml†L246-L300】【F:roles/camera/README.md†L1-L53】
- **UI metadata.** Operation definitions include `ui.group`, button/slider types, and slider `body_key` so the frontend can render without hand-coded layouts. Keep registry IDs stable; `scripts/validate-device-registry.mjs` flags duplicates or missing Prometheus targets.【F:inventory/device-interfaces.yaml†L28-L165】【F:scripts/validate-device-registry.mjs†L18-L102】

## 3. Express API & worker
### 3.1 Bootstrapping & configuration
- Install dependencies, then run `npm run migrate`, `npm run generate`, and `npm run seed:yaml` to sync Prisma with the YAML registry. The dev server runs on port 3005 (`npm run dev`). Production compose services run the same sequence before `npm run start` / `npm run worker` and set `API_BEARER` for auth.【F:api/package.json†L9-L17】【F:vps/compose.fleet.yml†L1-L37】
- `DEVICE_YAML` defaults to the repository inventory; override via env if you need a staged config. Tokens referenced by `token_env` must exist in the API container environment so proxy requests can be authenticated.【F:api/src/scripts/seed-from-yaml.ts†L52-L125】

### 3.2 HTTP surface today
- `/api/devices`, `/api/device_states`, `/api/devices/:id/state`, `/api/device_events`, `/api/jobs/:id`, and `/api/logs` provide the REST data the UI consumes. All `/api/*` routes require the bearer token when `API_BEARER` is set.【F:api/src/http/routes.ts†L9-L110】
- Only three command endpoints exist: `/api/video/devices/:id/tv/power_on`, `/power_off`, and `/input`, each enqueuing a `tv.*` job. There are no audio or camera operation proxies yet; callers must add new routes before wiring UI controls.【F:api/src/http/routes.ts†L93-L106】
- `/stream` (root-level) exposes Server-Sent Events; `/metrics` exports Prometheus gauges and counters. When `API_BEARER` is configured, both the `/api` router and `/stream` enforce it (query param for SSE clients).【F:api/src/index.ts†L1-L24】【F:api/src/http/util-auth.ts†L1-L12】【F:api/src/lib/metrics.ts†L1-L33】

### 3.3 Job queue & worker loop
- `enqueueJob` persists a pending row, emits `command.accepted` events, and pushes an SSE `job` event so the UI can show optimistic feedback.【F:api/src/services/jobs.ts†L1-L25】
- The worker polls pending jobs, resolves device base URLs and bearer tokens, and currently supports only `tv.power_on`, `tv.power_off`, and `tv.input`; anything else throws `unsupported command`. Add branches here when you introduce new operations (audio volume, camera probe, etc.).【F:api/src/workers/executor.ts†L7-L54】
- `updateJob` records status transitions, appends device events, and emits SSE job updates; metrics counters track success/failure and durations.【F:api/src/services/jobs.ts†L27-L78】【F:api/src/lib/metrics.ts†L7-L33】

### 3.4 Device polling & persistence
- `pollOnce` iterates managed devices (`managed: true` from the seed), resolves `/healthz` (with `/health` fallback) and `/status`, merges snapshots, and writes a new `DeviceState` row with `poller` metadata. Successful polls refresh `lastSeen` and raise `fleet_device_online` gauges.【F:api/src/workers/poller.ts†L103-L148】【F:api/src/lib/device-address.ts†L11-L82】【F:api/src/services/devices.ts†L1-L36】【F:api/src/lib/metrics.ts†L15-L20】
- Prisma schema captures `Device`, `DeviceState`, `DeviceEvent`, and `Job` tables, providing append-only history for debugging and audit trails.【F:api/prisma/schema.prisma†L10-L64】

### 3.5 Logs facade
- The API reads `inventory/devices.yaml` to build Loki source descriptors (`All Devices`, individual hosts, optional VPS entry) and constructs label selectors for `host` plus any custom labels. Results are normalized for severity, include optional Loki stats, and stream back to the UI.【F:api/src/lib/inventory.ts†L1-L139】【F:api/src/services/logs.ts†L1-L200】【F:api/src/services/logs.ts†L200-L320】

## 4. Logging, monitoring, and reverse proxy
- **Device shipping.** Promtail runs on every Pi with configurable Loki endpoint, host/environment/site labels, and journal/Docker scrapes. Use the logging runbook to ensure `/etc/fleet/agent.env` has the right sink before convergence.【F:baseline/docker-compose.yml†L27-L54】【F:docs/runbooks/logging.md†L12-L82】
- **Central stack.** `vps/compose.prom-grafana-blackbox.yml` + `vps/compose.promtail.yml` start Prometheus, Grafana, Loki, Alertmanager, and a promtail collector. Targets are generated from the device registry; re-run `scripts/validate-device-registry.mjs` and redeploy when inventory changes.【F:vps/README.md†L50-L113】【F:scripts/validate-device-registry.mjs†L18-L102】
- **Reverse proxy.** The `fleet-ui` and `fleet-api` containers are published through Caddy at `log.beautyheadspabymartina.hr`, forwarding `/api`, `/metrics`, and `/stream` to port 3005 and everything else to the SvelteKit Node adapter on port 3000.【F:vps/compose.fleet.yml†L1-L48】【F:vps/caddy.fleet.Caddyfile†L1-L19】

## 5. SvelteKit UI overview
- **Global SSE connection.** `+layout.svelte` opens an `EventSource` to `/stream` on mount, updating the `deviceStates` and `jobs` stores in `lib/stores/deviceStates.ts`. The helper in `lib/api.ts` injects `PUBLIC_API_BASE`/`PUBLIC_API_BEARER` and attaches the bearer token to the SSE query string when required.【F:ui/src/routes/+layout.svelte†L1-L39】【F:ui/src/lib/stores/deviceStates.ts†L1-L18】【F:ui/src/lib/api.ts†L1-L56】
- **Operations page status.** `/operations` currently filters for `kind === 'video'` devices and drives only the TV power/input endpoints, persisting selection and last source in `localStorage`. Audio and camera operations from the registry are ignored until new API routes exist.【F:ui/src/routes/operations/+page.svelte†L1-L232】
- **Logs console.** `LogConsole.svelte` polls `/api/logs` every 5 seconds by default, renders source chips, severity badges, pause/clear/download controls, and supports multiline expansion; no extra polishing is required—the component is already feature-complete.【F:ui/src/lib/components/LogConsole.svelte†L1-L323】

## 6. Development workflow
- **API:**
  1. `cd api && npm install`
  2. `npm run migrate` → `npm run generate` → `npm run seed:yaml`
  3. `npm run dev` (embedded poller + worker). For a separate worker process run `npm run build` then `npm run worker` in another shell.【F:api/package.json†L9-L17】
- **UI:** `cd ui && npm install && npm run dev -- --host` serves on port 3006; Vite is configured to use that port so Caddy/Nginx configs remain valid.【F:ui/vite.config.ts†L1-L3】 Set `PUBLIC_API_BASE`/`PUBLIC_API_BEARER` in `.env` to match your API.
- **Registry checks:** After editing `inventory/device-interfaces.yaml` or Prometheus target files, run `node scripts/validate-device-registry.mjs` and re-run the API seed script.【F:scripts/validate-device-registry.mjs†L18-L102】【F:api/src/scripts/seed-from-yaml.ts†L6-L126】
- **Device smoke test:** Use `scripts/acceptance.sh` with `SSH_USER`, `AUDIOCTL_TOKEN`, and optional `ICECAST_URL` to verify `/healthz`, `/status`, ALSA devices, and stream reachability for audio Pis.【F:scripts/acceptance.sh†L1-L77】

## 7. Hardware & role runbooks
- Audio hardware prep, fallback uploads, and control API usage live in `docs/runbooks/audio.md`. Follow these steps when adding playback hosts or debugging output issues.【F:docs/runbooks/audio.md†L1-L109】
- HDMI/Zigbee details—including environment variables, Zigbee recovery workflow, and API reference—are documented in `roles/hdmi-media/README.md`. Use it when wiring Zigbee dashboards or TV controls.【F:roles/hdmi-media/README.md†L1-L198】
- Camera streaming requirements, control endpoints, and troubleshooting steps are documented in `roles/camera/README.md` for RTSP/HLS ingest debugging.【F:roles/camera/README.md†L1-L53】

## 8. Current gaps & priorities for UI/API work
1. **Audio & camera command proxies.** The Express router exposes only video TV endpoints; create `/api/audio/...` and `/api/camera/...` routes (plus worker branches) that honor the operation definitions in the registry.【F:api/src/http/routes.ts†L93-L106】【F:api/src/workers/executor.ts†L7-L54】
2. **Operations grid generalization.** `/operations` ignores non-video devices. Adapt it to render audio sliders/buttons and camera probes using the seeded `capabilities.operations` data once the backend exposes matching endpoints.【F:ui/src/routes/operations/+page.svelte†L41-L188】
3. **API README refresh.** Documentation still references `npm run seed:devices` and endpoints that are not implemented; update it after adding real routes so new contributors do not rely on stale instructions.【F:api/README.md†L5-L98】【F:api/package.json†L9-L17】
4. **Token management.** Ensure the deployment environment provides all bearer tokens referenced by `token_env` keys (`AUDIO_*`, `HDMI_*`, `CAMERA_*`) before enabling new proxies; without them, poller and job requests will fail.【F:inventory/device-interfaces.yaml†L14-L260】【F:api/src/scripts/seed-from-yaml.ts†L52-L125】

Keep this guide handy while you expand the SvelteKit UI or backend proxies—it links every moving part back to the definitive source file so you can make changes confidently.

## Appendix A – Operator reconnaissance (September 2025)

The operations team supplied the following notes after reviewing the live SvelteKit UI. Treat these as ground truth for the deployed build and validate new work against them when refactoring.

### Authentication & session management

- Login is hardcoded to accept the `admin`/`admin` credential pair in `src/routes/auth/login/+page.server.js`. Successful logins persist a `session=authenticated` cookie for one week and tag the user as an `administrator` role.
- `src/routes/+layout.server.js` guards protected routes. Unauthenticated users are redirected to `/auth/login`, while authenticated operators are redirected away from `/auth/login` to the dashboard.
- `/auth/logout` clears the session cookie to force a logout. There is currently no multi-user or multi-role support.

### Navigation & feature toggles

- The primary navigation links (Audio, Video, Cameras, Smart Home, Devices, Logs, Status, Settings) are statically declared in `src/routes/+layout.svelte`; there is no role-aware filtering.
- All navigation targets have matching route directories, though some are still thin scaffolds. The Logs page only renders when `VITE_ENABLE_LOGS=true` is set in the environment.

### Health monitoring

- `src/routes/+layout.svelte` mounts a 30-second polling loop that calls `/api/health`. The UI maps the API response to three states: `healthy` → green “UP”, anything else → yellow “DEGRADED”, and request failures/timeouts → red “DOWN”.
- The shared API wrapper enforces a 10-second fetch timeout and logs errors to the console when the health endpoint is unreachable.

### Dashboard metrics

- The home dashboard tallies “Active Devices” by fetching `/api/devices` and counting entries whose `status` is `online`. Each device is also polled periodically through `/api/devices/${device.id}/status` to keep the tally fresh.
- When `/api/devices` fails, the UI logs the error and leaves the list empty, causing the tile to show `0/0` until data can be fetched again.
- Quick-action cards on the home page are static links that cannot be reconfigured through settings or the backend today.

### Device control surfaces

- Audio, video, camera, and Zigbee device panels call their respective proxy endpoints (for example, `/api/audio/{device}/status`, `/api/video/devices/{id}/tv/power_on`). Rate limiting is not implemented client-side; backend session cookies are the primary protection.
- Operators should confirm proxy coverage before surfacing new controls—the UI already contains helper functions for audio control (`getAudioDeviceStatus`, `controlAudioDevice`, `syncedAudioOperation`) that expect the backend to forward requests.

### Logs & streaming console

- The logs view streams up to 5,000 entries at a time via `$lib/logs/client.js`, supports pausing/resuming, filtering by host, and exposes an error state if the stream dies. Automatic reconnection uses exponential backoff and stops after ten failed attempts.
- Operators can click a Refresh action to trigger a manual reconnect when the automatic retries are exhausted.

### Telemetry & client logging

- `$lib/telemetry.js` tracks lifecycle events (`app_open`, `app_close`), unhandled errors, and promise rejections. For each incident it buffers recent console output, stack traces, route information, and the active component.
- Events are POSTed to `/api/client-log`. When the network is unavailable, telemetry queues events in `localStorage` and flushes them once connectivity returns.
- Beta invite flows rely on `invite_token` and `invite_id` URL parameters that the telemetry module captures for operator attribution; tokens should be rotated or revoked server-side when necessary.

### Environment & configuration notes

- `.env` in the `ui/` directory is empty by default; the only documented toggle is `VITE_ENABLE_LOGS=true` to expose the log streaming console. Reverse proxies must continue to forward `/api/*` to the backend to reuse the hardcoded relative fetch paths.
- No environment-specific hacks are present—deployments rely on consistent reverse-proxy behavior for CORS and cookie handling.

### Error handling & operator feedback

- Logout and other major user actions raise toast notifications, while deeper diagnostics (failed fetches, telemetry issues) are logged to the console and forwarded to `/api/client-log` for aggregation on the backend.
- Operators investigating telemetry alerts should consult the backend storage pipeline; the frontend does not expose workflows beyond the toast notifications.

### Future enhancements flagged by operations

- Routes such as Smart Home hint at planned features but are not fully implemented. Collecting operator feedback should focus on multi-user access, customizable quick actions, and additional device proxies that align with the existing telemetry plumbing.

## Appendix B – Operator interview prompts

Use the following checklist when interviewing site operators or staging administrators to confirm the UI is configured correctly:

1. **Authentication flow** – Are credentials beyond `admin/admin` in rotation? How are forced logouts handled, and is multi-user access on the roadmap?
2. **Navigation coverage** – Which sections are actively used today, and do any rely on feature flags or backend configuration to show/hide links?
3. **Health monitoring** – What polling interval is appropriate in production, what statuses does `/api/health` emit, and how should unreachable endpoints be surfaced to operators?
4. **Dashboard metrics** – Which backend signals define “Active Devices”, and what contingencies exist when the device API is offline? Should quick actions be customizable?
5. **Device controls** – Which device endpoints are exercised daily, and are there known gaps between UI expectations and backend behavior (latency, stale states)?
6. **Logs viewer** – What log volume should the UI handle, how should operators recover from stream pauses, and which filters are most valuable?
7. **Telemetry** – Who monitors `/api/client-log`, what is the retention policy, and how are invite tokens governed?
8. **Environment configuration** – Which `.env` values are required for each environment, and are there quirks for proxies, CORS, or air-gapped deployments?
9. **Error handling** – What workflow should operators follow when telemetry alerts fire, and when should the UI surface toast notifications versus silent logging?
10. **Future enhancements** – Which upcoming UI features should be documented now, and what user feedback is shaping the next iteration?
