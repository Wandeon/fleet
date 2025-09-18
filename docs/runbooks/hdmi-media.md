# HDMI Media + Zigbee Hub Runbook

This Pi drives the TV over HDMI (`hdmi-media` role) and simultaneously hosts the Zigbee coordinator stack (MQTT + Zigbee2MQTT). Use this guide when provisioning or troubleshooting `pi-video-01`.

## Hardware checklist

- Raspberry Pi 5 with USB Zigbee coordinator (CC2652P, Sonoff ZBDongle-E, etc.).
- HDMI cable connected to TV input. Confirm CEC is supported.
- Audio path validated (TV speakers or AVR).

## Host preparation

1. Install OS and base packages per `docs/runbooks/provisioning.md`.
2. Install Zigbee rules so the coordinator is stable across reboots:
   ```bash
   sudo tee /etc/udev/rules.d/99-zigbee.rules <<'EOF'
   SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="55d4", SYMLINK+="ttyUSB.zigbee"
   EOF
   sudo udevadm control --reload
   ```
   Adjust `idVendor/idProduct` for your dongle (use `lsusb`). Update `ZIGBEE_SERIAL_PORT` to `/dev/ttyUSB.zigbee` if you create a symlink.
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

## Troubleshooting

- If Zigbee2MQTT cannot open the serial port, check group membership: `sudo usermod -aG dialout $(whoami)` and reboot.
- Move the coordinator away from HDMI cables to avoid interference.
- For CEC issues, use `cec-client -l` to ensure the adapter is detected; review `roles/hdmi-media/systemd/cec-setup.service`.
- When media playback stutters, inspect `docker logs` for `media-control` and the host `mpv` journal via `journalctl -u mpv-hdmi@hdmi`.