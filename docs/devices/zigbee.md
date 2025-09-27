# pi-video-01 — Zigbee Coordinator

## Role Summary
- **Coordinator Host:** `pi-video-01`
- **Service Stack:** Mosquitto + Zigbee2MQTT containers bound to the HDMI host.
- **API Surface:** Fleet API exposes Zigbee functions under `/zigbee/*` alongside the video endpoints.

## Fleet API Contract
| Endpoint | Method | Description |
| --- | --- | --- |
| `/zigbee/overview` | `GET` | Aggregated hub state, pairing window metadata, device list, and automation rules. |
| `/zigbee/devices` | `GET` | Lists paired Zigbee devices with status. |
| `/zigbee/devices/{deviceId}/status` | `GET` | Returns pairing status for a specific endpoint. |
| `/zigbee/pairing` | `POST` | Opens a pairing window (`durationSeconds` 30–900). Automatically closes when the window expires. |
| `/zigbee/pairing` | `DELETE` | Manually close the current pairing window. |
| `/zigbee/pairing/discovered` | `GET` | Poll discovered candidates. Auto-closes window when expired. |
| `/zigbee/pairing/{deviceId}` | `POST` | Confirm a candidate and move it into the paired set. |
| `/zigbee/actions` | `POST` | Queue quick actions for paired devices. |

**Auto-close guard:** starting a pairing window schedules an automatic shutdown at the requested expiry time. Any subsequent status call refreshes the window state, and stale windows are closed before responding.

## Monitoring
- Prometheus job `zigbee-coordinator` scrapes `http://pi-video-01:8082/metrics`.
- Alerting should fire if pairing remains active longer than configured maintenance window or if MQTT auth failures spike.
- Dashboard tiles must show hub online/offline status, open pairing windows, and discovered candidate counts.

## Operational Runbook
- **IF Zigbee pairing opened** → window auto-closes when `expiresAt` passes. Operators may manually close early via `DELETE /zigbee/pairing`.
- **IF coordinator serial path changes** → document in repo (`docs/devices/zigbee.md`) and follow reset procedure in `roles/hdmi-media/README.md` to rebuild containers.
- **IF MQTT auth fails** → regenerate credentials in git (do not hot-patch), commit, and redeploy Mosquitto + Zigbee2MQTT.
- **IF Zigbee hub offline** → check `pi-video-01` service health, ensure video service running, then restart Zigbee containers during maintenance window (20:00–08:00).

## Maintenance Checklist
1. Confirm `/zigbee/pairing` returns active window payload in CI smoke tests.
2. Ensure Prometheus scrape jobs include `zigbee-coordinator` label for `pi-video-01`.
3. Update `inventory/device-interfaces.yaml` whenever pairing defaults or ports change.
4. Back up Zigbee network map after each onboarding cycle.
