# Device Inventory

This inventory lists every production host managed by the GitOps agent along with control-plane metadata. Maintain this file in lockstep with `inventory/devices.yaml` and `inventory/device-interfaces.yaml`.

## Current devices

| Device ID      | Role           | Control API                                                                    | Monitoring Labels                         | Notes                                               |
| -------------- | -------------- | ------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| `pi-audio-01`  | `audio-player` | `http://pi-audio-01:8081` (requires `AUDIO_PI_AUDIO_01_TOKEN` when configured) | `logs: true`, `loki_source: pi-audio-01`  | Primary HiFiBerry playback endpoint.                |
| `pi-audio-02`  | `audio-player` | `http://pi-audio-02:8081`                                                      | `logs: true`, `loki_source: pi-audio-02`  | Redundant playback path.                            |
| `pi-video-01`  | `hdmi-media`   | `http://pi-video-01:8082` (`media-control`), Zigbee UI at `:8084`              | `logs: true`, `loki_source: pi-video-01`  | Hosts HDMI signage controller and Zigbee hub stack. |
| `pi-camera-01` | `camera`       | `http://pi-camera-01:8083` (control), RTSP `rtsp://pi-camera-01:8554/camera`   | `logs: true`, `loki_source: pi-camera-01` | Primary MediaMTX camera feed.                       |

Source: `inventory/devices.yaml` and per-device interface definitions.【F:inventory/devices.yaml†L1-L18】【F:inventory/device-interfaces.yaml†L1-L162】

## Interface registry highlights

- Each device entry defines health/status endpoints, Prometheus scrape targets, and UI operations (e.g., `play_stream`, `tv_power_on`, `probe_stream`). The API uses this registry to proxy upstream requests and emit module actions.【F:inventory/device-interfaces.yaml†L1-L162】
- Bearer token environment variables (`AUDIO_PI_AUDIO_01_TOKEN`, `HDMI_PI_VIDEO_01_TOKEN`, `CAMERA_PI_CAMERA_01_TOKEN`) must be populated in `vps/fleet.env` so the API can authenticate to downstream devices during proxy calls.【F:vps/fleet.env.example†L15-L33】
- Monitoring targets are exported to `infra/vps/targets-*.json`; regenerate them after modifying the registry and restart the Prometheus stack per [02-deployment-and-networks](./02-deployment-and-networks.md).【F:infra/vps/README.md†L33-L74】

## Inventory updates

1. Add the device and role to `inventory/devices.yaml`. Include `logs: true` and `loki_source` if logs should ship to Loki.
2. Extend `inventory/device-interfaces.yaml` with the new device’s management summary, API base URL, operations, and metrics targets.
3. If the device introduces new role overlays or env values, update the corresponding `roles/<role>/README.md` and `.env.example`.
4. Re-run `scripts/validate-device-registry.mjs` (see infra README) to generate updated Prometheus target files.
5. Commit the changes; the agent will converge the next time it runs on the device.

For detailed capabilities per device type, see [07-device-capabilities.md](./07-device-capabilities.md).
