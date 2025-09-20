# HDMI Media + Zigbee Hub Runbook

This Pi drives the TV over HDMI (`hdmi-media` role) and simultaneously hosts the Zigbee coordinator stack (MQTT + Zigbee2MQTT). Use this guide when provisioning or troubleshooting `pi-video-01`.

## Hardware checklist

- Raspberry Pi 5 with USB Zigbee coordinator (CC2652P, Sonoff ZBDongle-E, etc.).
- HDMI cable connected to TV input. Confirm CEC is supported.
- Audio path validated (TV speakers or AVR).

## Host preparation

1. Install OS and base packages per `docs/runbooks/provisioning.md`.
2. Record the stable serial path the OS assigns to the Zigbee coordinator and persist it in `/etc/fleet/agent.env` so the role always receives the same value:
   ```bash
   ls -l /dev/serial/by-id
   sudo install -m 0755 -d /etc/fleet
   sudo tee /etc/fleet/agent.env >/dev/null <<'ENV'
   # Replace with the actual USB identifier for your coordinator
   ZIGBEE_SERIAL=/dev/serial/by-id/usb-dresden_elektronik_ConBee_III_DE03311823-if00-port0

   # Broker credentials consumed by Mosquitto + Zigbee2MQTT
   ZIGBEE_MQTT_USER=zigbee
   ZIGBEE_MQTT_PASSWORD=please-change-me
   ENV
   ```
   Update the serial path and credentials to match your hardware/secrets. The agent exports `ZIGBEE_SERIAL` as `ZIGBEE_SERIAL_PORT` for the compose file.
   (Optional) If you prefer a custom symlink name you can still drop a udev rule similar to the old instructions.
3. (Optional) Install the HDMI helper units:
   ```bash
   sudo ./roles/hdmi-media/install.sh
   ```
4. Copy `roles/hdmi-media/etc-default-hdmi-media` to `/etc/default/hdmi-media` and set `CEC_DEVICE_INDEX` to the HDMI port in use (`0` for `/dev/cec0`, `1` for `/dev/cec1`).

## Secrets / environment

Edit `roles/hdmi-media/.env.sops.enc` with `sops` and update:

- `MEDIA_CONTROL_TOKEN` for the control API.
- Zigbee MQTT credentials (`ZIGBEE_MQTT_USER`/`ZIGBEE_MQTT_PASSWORD`).
- Zigbee network identity: `ZIGBEE_NETWORK_KEY`, `ZIGBEE_PAN_ID`, `ZIGBEE_EXT_PAN_ID`.
- Set `ZIGBEE_PERMIT_JOIN=true` temporarily when onboarding devices.

Commit to `main` and wait for the agent.

## Verifying media control

- API health: `curl http://<pi-video-01>:8082/healthz`
- Status: `curl -H "Authorization: Bearer $MEDIA_CONTROL_TOKEN" http://<pi-video-01>:8082/status`
- Start playback: `curl -X POST -H "Authorization: Bearer $MEDIA_CONTROL_TOKEN" -H 'Content-Type: application/json' -d '{"url":"http://.../media.mp4"}' http://<pi-video-01>:8082/play`

## Verifying Zigbee hub

1. Confirm services:
   ```bash
   docker ps | grep zigbee
   ```
2. MQTT smoke test:
   ```bash
   mosquitto_pub -h localhost -u "$ZIGBEE_MQTT_USER" -P "$ZIGBEE_MQTT_PASSWORD" -t zigbee2mqtt/bridge/request/networkmap -n
   ```
3. Zigbee2MQTT UI: `http://<pi-video-01>:8084` (protect via Tailscale ACLs).
4. Enable pairing by editing env (or using the UI) to toggle `ZIGBEE_PERMIT_JOIN`.

### Resetting the Zigbee stack on `pi-video-01`

Re-run the agent with refreshed host env if the serial path drifts or Mosquitto restarts with `passwordfile` errors. This block applies the stable path, rebuilds the compose project, and recreates the password file:

```bash
# === pi-video-01: fix Zigbee serial + Mosquitto auth and rebuild ===
set -euo pipefail

# 1) Set/refresh host-level env used by the role (edit the creds as needed)
sudo install -m 0755 -d /etc/fleet
sudo tee /etc/fleet/agent.env >/dev/null <<'ENV'
# Stable path to the ConBee III
ZIGBEE_SERIAL=/dev/serial/by-id/usb-dresden_elektronik_ConBee_III_DE03311823-if00-port0

# Broker credentials the stack expects (choose secure values)
ZIGBEE_MQTT_USER=zigbee
ZIGBEE_MQTT_PASSWORD=please-change-me
ENV

# 2) Remove any old, manually-run zigbee2mqtt container that might collide
docker rm -f zigbee2mqtt >/dev/null 2>&1 || true

# 3) Run the agent to recreate the compose project with the new env
sudo /opt/fleet/agent/role-agent.sh

# 4) Create the Mosquitto password file inside the broker's data volume
MQTT_CONT="$(docker ps --filter name=zigbee-mqtt -q | head -n1)"
if [ -n "$MQTT_CONT" ]; then
  docker exec "$MQTT_CONT" sh -lc '
    set -e
    : "${ZIGBEE_MQTT_USER:?missing}"; : "${ZIGBEE_MQTT_PASSWORD:?missing}"
    mosquitto_passwd -b /mosquitto/data/passwordfile "$ZIGBEE_MQTT_USER" "$ZIGBEE_MQTT_PASSWORD"
    # Make sure perms are readable by mosquitto user
    chown mosquitto:mosquitto /mosquitto/data/passwordfile || true
    chmod 600 /mosquitto/data/passwordfile || true
  '
  # Bounce broker + zigbee2mqtt to pick up the password file
  docker restart "$MQTT_CONT" >/dev/null
fi

Z2M_CONT="$(docker ps --filter name=zigbee2mqtt -q | head -n1)"
[ -n "$Z2M_CONT" ] && docker restart "$Z2M_CONT" >/dev/null || true

echo "Done. Give the services ~10-20s to settle, then run the test block."
```

After ~20 seconds, confirm the fix with the quick checks:

```bash
# === pi-video-01: quick checks ===

# 1) Serial is stable and visible
ls -l /dev/serial/by-id
docker exec "$(docker ps --filter name=zigbee2mqtt -q | head -n1)" ls -l /dev/ttyUSB0 || true

# 2) Broker came up and has a password file
docker logs "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" --tail=80 | sed -n '1,120p'
docker exec "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" sh -lc 'ls -l /mosquitto/data/passwordfile && head -c 0 /mosquitto/data/passwordfile && echo " [exists]"'

# 3) Zigbee2MQTT connected to MQTT and opened the adapter
docker logs "$(docker ps --filter name=zigbee2mqtt -q | head -n1)" --tail=120 | sed -n '1,200p'

# 4) Optional: publish a test message (should not error)
docker exec "$(docker ps --filter name=zigbee-mqtt -q | head -n1)" sh -lc 'mosquitto_pub -u "$ZIGBEE_MQTT_USER" -P "$ZIGBEE_MQTT_PASSWORD" -h localhost -t test/topic -m hello && echo "MQTT pub ok"'
```

**Why this helps**

- Locks the adapter to `/dev/serial/by-id/...` so the ConBee path survives reboots.
- Regenerates `/mosquitto/data/passwordfile` with credentials shared by Mosquitto and Zigbee2MQTT.
- Removes stray, manually started containers that could collide with the compose-managed stack.

## Troubleshooting

- If Zigbee2MQTT cannot open the serial port, check group membership: `sudo usermod -aG dialout $(whoami)` and reboot.
- Move the coordinator away from HDMI cables to avoid interference.
- For CEC issues, use `cec-client -l` to ensure the adapter is detected; review `roles/hdmi-media/systemd/cec-setup.service`.
- When media playback stutters, inspect `docker logs` for `media-control` and the host `mpv` journal via `journalctl -u mpv-hdmi@hdmi`.