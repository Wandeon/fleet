# Camera Role Bring-Up

This guide provisions the Raspberry Pi that runs the `camera` role. It captures video with libcamera, publishes RTSP via MediaMTX, and exposes adaptive HLS for dashboards.

## Prerequisites

- Raspberry Pi Camera Module (v2/v3/Global Shutter) connected to the CSI port.
- Raspberry Pi OS Bookworm 64-bit with `libcamera` stack enabled.
- Device appears as `pi-camera-01` in `inventory/devices.yaml`.
- AGE private key installed at `/etc/fleet/age.key` to decrypt secrets (if you customize env vars).

## Host configuration

1. Enable the camera interface and reboot:
   ```bash
   sudo raspi-config nonint do_camera 0
   sudo raspi-config nonint set_config_var start_x 1 /boot/firmware/config.txt
   sudo raspi-config nonint set_config_var gpu_mem 256 /boot/firmware/config.txt
   sudo reboot
   ```
2. After the reboot, verify libcamera sees the module:
   ```bash
   libcamera-hello -n --list-cameras
   ```
3. Confirm Docker has access to the video devices:
   ```bash
   ls -l /dev/video0 /dev/vchiq
   ```
   If they are missing, re-seat the ribbon cable or re-run step 1.

## Fleet configuration

1. (Optional) Customize capture settings by editing `roles/camera/.env.sops.enc`. Typical overrides:
   - `CAMERA_WIDTH`, `CAMERA_HEIGHT`, `CAMERA_FRAMERATE`
   - `CAMERA_BITRATE`
   - `CAMERA_AWB`, `CAMERA_EXPOSURE`
   Use `sops roles/camera/.env.sops.enc` to edit.
2. Commit changes to `main`; the agent on the Pi will pull the update within ~2 minutes.
3. Check container status:
   ```bash
   docker compose ls
   docker ps --filter label=com.docker.compose.project | grep camera
   ```
4. Inspect logs if the stream does not appear:
   ```bash
   docker logs $(docker ps --filter name=camera-streamer -q)
   ```

## Consuming the stream

- RTSP: `rtsp://<pi-camera-01>:8554/camera`
- HLS: `http://<pi-camera-01>:8888/camera/index.m3u8`

Use VLC, Home Assistant, or any NVR that supports RTSP/HLS.

## Troubleshooting

- GPU throttling: lower `CAMERA_FRAMERATE` or reduce resolution.
- Network jitter: move to wired Ethernet; RTSP is unicast.
- If `libcamera-vid` exits immediately, run it manually on the host to capture the error: `libcamera-vid -t 5000 -o test.h264`.