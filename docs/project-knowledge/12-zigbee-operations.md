# Zigbee Operations

Zigbee coordination lives on `pi-video-01` alongside the video role. This document covers pairing flows, automation rules, and troubleshooting the Mosquitto/Zigbee2MQTT stack.

## Stack overview

- `zigbee-mqtt` (Mosquitto) and `zigbee2mqtt` containers are defined in `roles/hdmi-media/50-zigbee.yml` and launched by the GitOps agent. Mosquitto listens on `mqtt://127.0.0.1:1883`; Zigbee2MQTT serves a web UI at `http://<host>:8084`.【F:roles/hdmi-media/README.md†L1-L78】
- Credentials and hardware paths come from `/etc/fleet/agent.env` (`ZIGBEE_SERIAL` or `ZIGBEE_SERIAL_PORT`, `ZIGBEE_MQTT_USER`, `ZIGBEE_MQTT_PASSWORD`, `ZIGBEE_NETWORK_KEY`, `ZIGBEE_CHANNEL`). The agent mirrors `ZIGBEE_SERIAL` to `ZIGBEE_SERIAL_PORT` when only one is set.【F:roles/hdmi-media/README.md†L35-L78】
- The API currently exposes placeholder endpoints for Zigbee control (`/zigbee/devices`, `/zigbee/devices/{id}/action`). Responses mark devices `unimplemented` until automation backend lands; plan UI accordingly.【F:apps/api/src/routes/zigbee.ts†L1-L82】

## Pairing workflow

1. Set `ZIGBEE_PERMIT_JOIN=true` (or use UI toggle once implemented). Keep permit window short (60s) to reduce risk.【F:vps/fleet.env.example†L39-L45】
2. Place sensor into pairing mode. Zigbee2MQTT UI shows join progress; backend should log event to `/zigbee/actions` when implemented.
3. After pairing, revert `ZIGBEE_PERMIT_JOIN=false`, verify device appears in inventory table, and annotate metadata in `inventory/device-interfaces.yaml` for UI operations.
4. Regenerate Prometheus targets if new Zigbee metrics endpoints are introduced.

## Automation rules (future)

- UX stories define rule builder requirements (trigger, condition, action, conflict detection). Persist rules in control plane once API endpoints exist (`/zigbee/rules`). Ensure RBAC prevents unauthorized actuator control.【F:docs/ux/operator-jobs-and-stories.md†L182-L202】
- Integrate automation outcomes with alerting pipeline so Slack notifications include rule metadata (see [23-alerting-and-integrations](./23-alerting-and-integrations.md)).

## Troubleshooting

- **Coordinator path changes** – Use the README reset script: set `/etc/fleet/agent.env`, run agent, recreate Mosquitto password file via `docker exec`, and restart containers. Confirm `ls -l /dev/serial/by-id` shows stable path.【F:roles/hdmi-media/README.md†L78-L146】
- **MQTT auth failures** – Regenerate password file with `mosquitto_passwd`, ensure `ZIGBEE_MQTT_*` env variables match, and restart both containers. Logs appear via Promtail in Loki (filter `service="zigbee2mqtt"`).
- **Device offline** – Check Zigbee2MQTT logs for LQI updates, ensure coordinator firmware is current, and verify power to sensors. If persistent, mark device offline in UI and schedule field check.

## Monitoring

- Add Zigbee hub scrape targets to `infra/vps/targets-hdmi-media.json`. Metrics will include coordinator health once exporters are integrated.【F:infra/vps/README.md†L33-L74】
- Use `/ui/zigbee` mock states to simulate empty/error views until live API data is wired up. Prioritize closing UX gaps noted in the audit before enabling production access.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】

Coordinate firmware rollouts via [22-firmware-and-updates](./22-firmware-and-updates.md) and ensure any rule execution appears in the activity log described in [13-logs-and-monitoring](./13-logs-and-monitoring.md).
