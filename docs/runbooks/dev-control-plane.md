# Dev Control Plane bring-up checklist

This guide captures the dev-only control plane plan we agreed on. Follow it when wiring up the generic operations API, worker, and UI panels while iterating locally.

## 1. Registry validation and seeding loop

1. Validate the YAML registry whenever you change `inventory/device-interfaces.yaml`:
   ```bash
   node scripts/validate-device-registry.mjs
   ```
2. Start the API locally and reseed devices when the registry changes:
   ```bash
   cd api
   cp .env.example .env
   npm install
   npm run migrate
   npm run seed:yaml
   npm run dev
   ```
3. Run the quick health checks in another terminal:
   ```bash
   curl -s http://localhost:3000/api/health | jq .
   curl -s http://localhost:3000/api/devices | jq .
   curl -s "http://localhost:3000/api/device_states?limit=3" | jq .
   curl -N http://localhost:3000/api/stream
   ```

## 2. Dev environment variables

- Set `API_BEARER` in `api/.env` so every `/api/*` route and `/stream` connection requires the bearer.
- Provide per-device tokens in `api/.env` for the worker. Examples:
  ```bash
  AUDIO_PI_AUDIO_01_TOKEN=...
  AUDIO_PI_AUDIO_02_TOKEN=...
  VIDEO_PI_VIDEO_01_TOKEN=...
  CAMERA_PI_CAMERA_01_TOKEN=...
  ```
- Switch `DATABASE_URL` to Postgres if you prefer; rerun `npm run migrate` and `npm run seed:yaml` afterward.

## 3. Generic operations endpoint

- The API now exposes `POST /api/operations/:deviceId/:operationId` (see `api/src/http/routes.ts`).
- `executeOperation` in `api/src/services/operations.ts` resolves the registry entry, builds the HTTP request, forwards it directly to the device, and records `operation.*` events.
- Requests return the downstream status code plus JSON body; failures surface the device response or error string for the UI.

## 4. Worker execution for generic jobs

Update the worker loop so queued jobs with `kind === "operation"` are executed:

1. Mark the job `running` and emit an SSE update.
2. Perform the HTTP request described by `job.request` (URL, method, headers, optional body JSON).
3. On success, mark `succeeded` and persist the response status/body; on failure, mark `failed` with the error string.
4. Emit SSE job events for the running, succeeded, and failed transitions.

## 5. UI operations grid

- Load `/api/devices` on page init and surface each device’s `capabilities.operations`.
- Render a `DeviceCard` for every device role (audio, video, camera).
- Wire buttons/sliders so they POST to `/api/operations/:deviceSlug/:operationName`.
  - Sliders should send the value under the registry-defined `body_key` if provided.
- Subscribe to SSE job events to reflect queued/running/success states in the UI.
- Display the latest snapshot from `/api/device_states` alongside `lastSeen` timestamps.
- Add quick links sourced from registry metadata (Prometheus, Grafana, or role-specific consoles).

## 6. Logs console and source chips

- Keep `/api/logs` assembling sources from `inventory/devices.yaml` and normalizing severity.
- The UI should render filter chips for “All Devices” and per-device sources, poll every ~5 s (streaming later).
- Offer a "Download visible logs" action that saves the current JSON payload.

## 7. Metrics and health widgets

- Expose `/metrics` counters/gauges for device online counts, job throughput, and SSE client totals.
- Surface a simple header summary in the UI (e.g., online vs total devices) and link out to Grafana dashboards using registry metadata.

## 8. End-to-end dev test plan

1. Run the API and worker (`npm run dev` and `npm run worker`).
2. Confirm polling writes `device_state` rows and updates `lastSeen`.
3. Subscribe to `/api/stream` and verify `state` + `job` events arrive.
4. Trigger operations per device type and watch job state transitions (queued → running → succeeded) plus device-side behavior.
5. Open the logs console, flip sources, and validate Loki queries/severity colors.
6. Visit `/metrics` and ensure device/job gauges increment.

## 9. Troubleshooting quick hits

- `operation_not_found`: registry lacks `capabilities.operations` or you forgot to reseed (`npm run seed:yaml`).
- `unauthorized`: API enforces `API_BEARER`; ensure the UI sets `PUBLIC_API_BEARER`.
- Device shows offline but responds to curl: check `base_url`/`health_path` in `inventory/device-interfaces.yaml`.
- Empty logs panel: device missing Promtail config or `LOKI_ENDPOINT` in `/etc/fleet/agent.env`.
- Stalled SSE: proxy stripped `text/event-stream` headers—fix Caddy/Nginx config so `Cache-Control: no-transform` survives.
