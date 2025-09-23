# Device Interface Registry

`inventory/device-interfaces.yaml` is the single source of truth for the VPS:

- Which Raspberry Pi devices exist and what role they perform.
- Where the VPS should reach each device (control API base URL, health/metrics paths).
- Which Prometheus jobs/targets should be generated for monitoring.
- How the unified operations UI should render buttons, sliders, and diagnostics.

## File Structure

```yaml
devices:
  - id: pi-audio-01              # Matches inventory/devices.yaml key
    name: "Audio Player 01"      # Display name in the UI
    role: audio-player            # Role applied by the agent
    kind: audio                   # UI grouping (audio | video | camera)
    management:
      summary: "Primary feed"
      host: pi-audio-01
    api:
      base_url: http://pi-audio-01:8081
      health_path: /healthz
      status_path: /status
      metrics_path: /metrics
      auth:
        type: bearer
        token_env: AUDIO_PI_AUDIO_01_TOKEN
    endpoints:                    # Additional URLs to surface in the UI
      - label: RTSP stream
        url: rtsp://pi-audio-01:8554/camera
    monitoring:
      prometheus_targets:
        - job: audio-player
          target: pi-audio-01:8081
    operations:
      - id: health_check
        label: Run Health Check
        method: GET
        path: /healthz
        ui:
          type: button
          group: diagnostics
          result: text
      - id: volume
        label: Set Volume
        method: POST
        path: /volume
        ui:
          type: slider
          group: control
          min: 0
          max: 2
          step: 0.05
          default: 1
          body_key: volume
```

### Operations

Each operation definition is rendered by the UI and executed by the Express API proxy (`POST /api/operations/<device>/<operation>`):

- `id` – unique per device.
- `method` – HTTP verb used when contacting the device API (`GET`, `POST`, etc.). Defaults to `POST`.
- `path` – appended to `api.base_url`.
- `body` – default JSON body merged with any payload provided by the UI (useful for static parameters such as `{ source: "stream" }`).
- `ui` – hints for rendering:
  - `type: button` shows a button; `type: slider` renders a range input.
  - `group` groups controls under headers (`control`, `diagnostics`, etc.).
  - `body_key` (slider only) selects the JSON property that receives the slider value.
  - `result` (optional) indicates how the UI should display the device response (`json` or `text`).

### Auth Tokens

If a device requires bearer authentication, set `api.auth.token_env` to the environment variable name containing the token. The API proxy reads these environment variables and injects the correct `Authorization: Bearer …` header automatically.

### Monitoring Targets

`monitoring.prometheus_targets` declares the `{ job, target }` pairs that must exist inside the Prometheus file-SD JSON files. The validation script keeps `infra/vps/targets-*.json` in sync:

```bash
node scripts/validate-device-registry.mjs
```

Run the script after modifying the registry; it will exit non-zero if a job/target is missing from the Prometheus configuration or if a device is missing from `inventory/devices.yaml`.

## Adding a Device

1. Add the hostname/role to `inventory/devices.yaml` (role must remain the first property for the agent parser).
2. Append a new entry to `inventory/device-interfaces.yaml` with base URL, endpoints, Prometheus target, and operations.
3. Update any role-specific compose or README files if you introduce new services.
4. Run `node scripts/validate-device-registry.mjs` to ensure consistency.
5. Commit the updated files—Prometheus, the API, and the UI will consume the new definition automatically on deploy.
