# Video Operations

Video playback and HDMI/CEC control run on the `hdmi-media` role hosted by `pi-video-01`. This document covers power/input control, Zigbee hub coexistence, and recording/monitoring hooks.

## Components

- `media-control` FastAPI service (port 8082, host network) drives mpv via JSON IPC and issues HDMI-CEC commands. Requires `MEDIA_CONTROL_TOKEN` for authenticated routes, `HDMI_CONNECTOR`, `HDMI_AUDIO_DEVICE`, and `CEC_DEVICE_INDEX` env variables.【F:roles/hdmi-media/40-app.yml†L1-L23】【F:roles/hdmi-media/README.md†L1-L33】
- Optional systemd units (`mpv-hdmi@.service`, `cec-setup.service`) can auto-start playback and enforce TV power-on at boot. Ensure `/etc/default/hdmi-media` matches container env for consistent behavior.【F:roles/hdmi-media/README.md†L9-L33】
- Zigbee hub containers (`roles/hdmi-media/50-zigbee.yml`) run Mosquitto + Zigbee2MQTT on the same host, exposing MQTT at 1883 and UI at 8084. Configure stable serial path (`ZIGBEE_SERIAL`/`ZIGBEE_SERIAL_PORT`) and credentials in `/etc/fleet/agent.env`.【F:roles/hdmi-media/README.md†L35-L78】

## Control API surface

| Endpoint                              | Description                                                                    | Notes                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `GET /healthz`                        | Returns `ok`; used by Prometheus and deploy scripts.                           | No auth required.                                                |
| `GET /video/devices`                  | Fleet-scoped inventory of HDMI displays with power/mute/input/volume state.    | Backed by device registry; returns busy + job telemetry.         |
| `POST /video/devices/{id}/power`      | `{ "power": "on" \| "standby" }` queue HDMI-CEC power command.                 | Returns `jobId`; 409 when bus is already busy.                   |
| `POST /video/devices/{id}/mute`       | `{ "mute": boolean }` enqueue mute toggle.                                    | Mirrors physical amplifier mute state.                          |
| `POST /video/devices/{id}/input`      | `{ "input": "HDMI1" }` select source.                                        | Input names normalized to lowercase in state.                   |
| `POST /video/devices/{id}/volume`     | `{ "volumePercent": 0-100 }` adjust HDMI output gain.                         | Clamped and acknowledged asynchronously.                         |
| `POST /video/devices/{id}/playback`   | `{ "action": "play"|"pause"|"resume"|"stop", "url"? }` control media pipeline. | `play` requires signed URL; `stop` resets playback metadata.     |

Device-local endpoints (`/status`, `/play`, `/pause`, etc.) remain for host automation but operators must use Fleet API routes above so jobs are audited and conflicts handled centrally.【F:apps/api/openapi.yaml†L3609-L3814】

## HDMI/CEC best practices

- Verify CEC adapter index by running `cec-client -l` on the host; update `CEC_DEVICE_INDEX` accordingly in role env or inventory overrides.
- Maintain `/etc/default/hdmi-media` parity with container env so host-level systemd units and Docker containers reference the same connector and audio device.【F:roles/hdmi-media/README.md†L31-L78】
- When TVs fail to respond, inspect container logs for `power_on`/`power_off` responses and check `metrics` endpoint for command latency or failure counters.

## Zigbee hub coexistence

- Mosquitto password file lives under `/mosquitto/data/passwordfile`. Regenerate via documented `docker exec` block if credentials change, then restart both Mosquitto and Zigbee2MQTT containers. The README provides step-by-step reset script for `pi-video-01`.【F:roles/hdmi-media/README.md†L78-L148】
- UI should present Zigbee hub health on the video device detail page (since the coordinator shares hardware). Monitoring targets for Zigbee hub exist in `infra/vps/targets-hdmi-media.json`.

## Recording & playback integration

- mpv can play local files or remote streams. Store large video assets on external storage or network shares mounted on the Pi; update role env `MEDIA_LIBRARY_PATH` if introduced.
- For signage loops, use `POST /play` with playlists or call mpv via systemd to auto-start. Document loops in device detail notes.
- Capture HDMI health metrics (signal presence, last frame timestamp) via `/status`; ensure API returns these fields once telemetry is wired in (currently stubbed).【F:apps/api/src/routes/video.ts†L1-L74】

## Troubleshooting

- Check `docker logs media-control` for FastAPI errors, `journalctl -u mpv-hdmi@hdmi` for host-level playback issues, and Zigbee logs under `zigbee-mqtt`/`zigbee2mqtt` containers.
- Confirm Zigbee coordinator availability using `docker exec zigbee2mqtt ls -l /dev/ttyUSB0` and verifying `ZIGBEE_SERIAL` mapping.
- Use `/ui/video` with mock state toggles to preview error/empty states while API integration is underway. Reference UX audit findings in [17-ux-gaps-and-priorities](./17-ux-gaps-and-priorities.md) before exposing controls to operators.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L15-L55】

For alerting integrations, see [23-alerting-and-integrations](./23-alerting-and-integrations.md); for Zigbee-specific automation, refer to [12-zigbee-operations](./12-zigbee-operations.md).
