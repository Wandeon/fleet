# Camera Role

Streams the Raspberry Pi camera to an RTSP endpoint using libcamera and exposes streams via MediaMTX (RTSP and HLS).

## Components

- `camera-streamer`: custom image that runs `libcamera-vid` and publishes H.264 video through FFmpeg to an RTSP server.
- `camera-rtsp`: MediaMTX providing RTSP (`rtsp://<host>:8554/camera`) and HLS (`http://<host>:8888/camera/index.m3u8`).

## Requirements

- Raspberry Pi camera module enabled in firmware (`sudo raspi-config nonint do_camera 0`).
- `/dev/video0` and `/dev/vchiq` exposed to Docker. Agent compose file already mounts these.
- Optional: allocate GPU memory to at least 256MB for smooth 1080p capture.

## Configuration

Environment variables (set via `roles/camera/.env.sops.enc`):

- `CAMERA_RTSP_URL`: defaults to `rtsp://127.0.0.1:8554/camera`. Change if you route through another server.
- `CAMERA_WIDTH` / `CAMERA_HEIGHT`: capture resolution (default 1920x1080).
- `CAMERA_FRAMERATE`: frames per second (default 20).
- `CAMERA_BITRATE`: encoder bitrate in bits per second (default 6Mbps).
- `CAMERA_AWB`: libcamera auto white balance mode (`auto`, `incandescent`, `fluorescent`, `daylight`, `cloudy`).
- `CAMERA_EXPOSURE`: libcamera exposure profile (`normal`, `short`, `long`, etc.).

Update the encrypted env file with:

```bash
sops roles/camera/.env.sops.enc  # edit or create
```

## Access

- RTSP: `rtsp://<pi-host>:8554/camera`
- HLS: `http://<pi-host>:8888/camera/index.m3u8`

Both streams are open by default; adjust MediaMTX config (`roles/camera/mediamtx.yml`) for auth if needed.

## Healthchecks

- MediaMTX: simple binary `--version` probe.
- Streamer: `pgrep libcamera-vid` ensures encoder is alive.

## Troubleshooting

- `docker logs <project>_camera-streamer_1` to inspect libcamera/ffmpeg output.
- Confirm camera detected: `libcamera-hello` on host.
- Ensure `sudo usermod -aG video <username>` before enabling Docker device passthrough.