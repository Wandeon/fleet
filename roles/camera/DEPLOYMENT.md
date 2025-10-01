# Camera Role Deployment

## Overview
Raspberry Pi 5 camera streaming system with RTSP and HLS support.

## Hardware
- **Device**: pi-camera-01 (Raspberry Pi 5)
- **Camera**: IMX708 Wide NoIR 12MP (4608x2592)
- **Location**: front-entry

## Architecture

### Services
1. **camera-streamer** - Captures video from camera module using rpicam-vid
2. **camera-rtsp** - MediaMTX RTSP/HLS server
3. **camera-control** - FastAPI control API with health checks and Prometheus metrics

### Stream Flow
```
Camera Module → rpicam-vid → ffmpeg → RTSP (8554) → MediaMTX → HLS (8888)
```

## Configuration

### Environment Variables
- `CAMERA_WIDTH`: 1920 (default)
- `CAMERA_HEIGHT`: 1080 (default)
- `CAMERA_FRAMERATE`: 20 (default)
- `CAMERA_BITRATE`: 6000000 (default)
- `CAMERA_AWB`: auto (default)
- `CAMERA_EXPOSURE`: normal (default)
- `CAMERA_RTSP_URL`: rtsp://127.0.0.1:8554/camera
- `CAMERA_HLS_URL`: http://127.0.0.1:8888/camera/index.m3u8

### Ports
- 8083: Camera control API
- 8554: RTSP server
- 8888: HLS server

## Key Fixes Applied

### 1. Python Build Optimization (commit 811434e, 81c8935)
- **Issue**: pip timeout downloading from PyPI on ARM64
- **Solution**: Use piwheels.org mirror with pre-compiled ARM wheels
- **Result**: Build time reduced from 10+ minutes to 2 seconds

### 2. Camera Device Access (commit d04346f, b371613)
- **Issue**: Camera devices at `/dev/video19-35` not accessible
- **Solution**:
  - Use privileged mode
  - Mount `/dev`, `/sys:ro`, `/run/udev:ro`
- **Result**: libcamera can enumerate camera devices

### 3. Raspberry Pi 5 Compatibility (commit 10801a2)
- **Issue**: `libcamera-vid` command not found
- **Solution**: Rename to `rpicam-vid` (Pi 5 uses rpicam-apps)
- **Package**: Changed from `libcamera-apps` to `rpicam-apps`

### 4. libcamera Output Format (commit 5a778ab)
- **Issue**: `ERROR: *** libav: cannot allocate output context ***`
- **Solution**: Add `--libav-format h264` flag to rpicam-vid
- **Result**: Proper H.264 stream output to stdout

### 5. Timestamp Generation (commit fdd7587)
- **Issue**: DTS > PTS errors in MediaMTX HLS conversion
- **Solution**: Add ffmpeg flags `-use_wallclock_as_timestamps 1 -fflags +genpts`
- **Result**: Proper timestamp generation for RTSP/HLS conversion

## Deployment

### Manual Deployment
```bash
cd /opt/fleet
sudo git pull
cd roles/camera
sudo docker compose -f 40-app.yml -f 50-promtail.yml --project-name camera_$(git rev-parse --short HEAD) up --build -d
```

### Verify
```bash
# Check containers
docker ps --filter name=camera

# Check camera stream
docker logs camera_*-camera-streamer-1 | tail -20

# Test RTSP
ffprobe rtsp://127.0.0.1:8554/camera

# Check control API
curl http://localhost:8083/status
curl http://localhost:8083/metrics
```

## Monitoring

### Health Checks
- **camera-streamer**: Process check for `rpicam-vid`
- **camera-control**: HTTP check on `/healthz` (returns 200 if HLS stream available)
- **camera-rtsp**: MediaMTX version check

### Metrics
- Prometheus metrics exposed on `:8083/metrics`
- Grafana Loki logs via promtail

## Troubleshooting

### Camera Not Detected
```bash
# Check camera hardware
rpicam-hello --list-cameras

# Check video devices
ls -la /dev/video*

# Verify camera enabled in boot config
grep camera /boot/firmware/config.txt
```

### Stream Issues
```bash
# Check rpicam-vid process
docker exec camera_*-camera-streamer-1 ps aux | grep rpicam

# Check RTSP server logs
docker logs camera_*-camera-rtsp-1

# Check MediaMTX paths
curl http://localhost:9997/v3/paths/list
```

### Build Issues
```bash
# Clear Docker build cache
docker builder prune -af

# Rebuild from scratch
docker compose build --no-cache camera-streamer
```

## Known Issues

1. **Timestamp Warnings**: Non-monotonous DTS warnings in logs are cosmetic and don't affect stream quality
2. **Boot Time**: Camera requires ~30 seconds after boot for device initialization
3. **First Frame Delay**: Initial connection may take 5-10 seconds for first frame

## Future Enhancements

- [ ] Motion detection using OpenCV
- [ ] Recording to disk with retention policy
- [ ] Multi-camera support
- [ ] PTZ control (if hardware supports)
- [ ] Two-way audio
