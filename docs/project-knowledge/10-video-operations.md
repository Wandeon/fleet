# Video Operations

Video playback and HDMI/CEC control run on the `hdmi-media` role hosted by `pi-video-01`. This document covers power/input control, Zigbee hub coexistence, and recording/monitoring hooks.

## Components

- `media-control` FastAPI service (port 8082, host network) drives mpv via JSON IPC and issues HDMI-CEC commands. Requires `MEDIA_CONTROL_TOKEN` for authenticated routes, `HDMI_CONNECTOR`, `HDMI_AUDIO_DEVICE`, and `CEC_DEVICE_INDEX` env variables.【F:roles/hdmi-media/40-app.yml†L1-L23】【F:roles/hdmi-media/README.md†L1-L33】 
- Optional systemd units (`mpv-hdmi@.service`, `cec-setup.service`) can auto-start playback and enforce TV power-on at boot. Ensure `/etc/default/hdmi-media` matches container env for consistent behavior.【F:roles/hdmi-media/README.md†L9-L33】 
- Zigbee hub containers (`roles/hdmi-media/50-zigbee.yml`) run Mosquitto + Zigbee2MQTT on the same host, exposing MQTT at 1883 and UI at 8084. Configure stable serial path (`ZIGBEE_SERIAL`/`ZIGBEE_SERIAL_PORT`) and credentials in `/etc/fleet/agent.env`.【F:roles/hdmi-media/README.md†L35-L78】 

## Control API surface

| Endpoint | Description | Notes |
| --- | --- | --- |
| `GET /healthz` | Returns `ok`; used by Prometheus and deploy scripts. | No auth required. |
| `GET /status` | Current mpv state, active URL, playback position. | Provide context to UI device detail. |
| `POST /play` | Body `{ "url": "...", "start": 0 }` to start playback of a given media source. | Validate URL accessibility; mpv handles streaming. |
| `POST /pause` / `/resume` / `/stop` | Standard playback controls. | Pause/stop maintain mpv session; `stop` halts playback entirely. |
| `POST /seek` | `{ "seconds": 10 }` to jump forward/backward. | Negative values supported for rewind. |
| `POST /volume` | `{ "volume": 80 }` sets absolute level. | mpv volume scale 0-100. |
| `POST /tv/power_on` / `/tv/power_off` | HDMI-CEC power toggles. | Requires valid `CEC_DEVICE_INDEX`. |
| `POST /tv/input` | Body includes desired HDMI input. | Use enumerations matching TV connectors. |

(Endpoints sourced from `roles/hdmi-media/README.md`; API is fronted by Express via `/video/tv/*` routes in the control plane.)【F:roles/hdmi-media/README.md†L79-L112】【F:apps/api/openapi.yaml†L1344-L1459】 

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
