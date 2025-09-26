# Camera Operations Runbook

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Scope: Phase C1 - Camera Security and Monitoring

## Overview

The Camera domain provides security monitoring and event recording through:
- **pi-camera-01**: Primary camera device (❌ SERVICE DOWN)

## Device Specifications

### pi-camera-01 (SECURITY CAMERA)
- **Role**: camera
- **Hardware**: Raspberry Pi Camera Module v2/v3
- **API Base**: http://pi-camera-01:8083
- **Authentication**: Bearer token via `CAMERA_PI_CAMERA_01_TOKEN`
- **Status**: ❌ API service offline (network reachable)
- **Capabilities**:
  - Live video streaming
  - Motion detection
  - Event-triggered recording
  - Snapshot capture
  - Night vision (if equipped)

## API Reference

### Health Check
```bash
curl -H "Authorization: Bearer $CAMERA_PI_CAMERA_01_TOKEN" \
  http://pi-camera-01:8083/healthz
# Expected: 200 OK when operational
```

### Status Query
```bash
curl -H "Authorization: Bearer $CAMERA_PI_CAMERA_01_TOKEN" \
  http://pi-camera-01:8083/status
# Returns: Camera state, recording status, detection settings
```

### Prometheus Metrics
```bash
curl -H "Authorization: Bearer $CAMERA_PI_CAMERA_01_TOKEN" \
  http://pi-camera-01:8083/metrics
# Returns: Camera performance and event metrics
```

### Camera Control Operations

#### Live Preview
```bash
# Start live preview stream
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quality": "720p", "duration": 60}' \
  http://pi-camera-01:8083/preview/start
```

#### Snapshot Capture
```bash
# Take immediate snapshot
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution": "1080p", "format": "jpeg"}' \
  http://pi-camera-01:8083/snapshot
```

#### Recording Control
```bash
# Start manual recording
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 300, "quality": "1080p", "reason": "manual"}' \
  http://pi-camera-01:8083/record/start

# Stop recording
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://pi-camera-01:8083/record/stop
```

### Motion Detection Management

#### Detection Settings
```bash
# Configure motion detection
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "sensitivity": 75, "zones": ["main"]}' \
  http://pi-camera-01:8083/detection/config
```

#### Event History
```bash
# Get recent detection events
curl -H "Authorization: Bearer $TOKEN" \
  "http://pi-camera-01:8083/events?limit=50&hours=24"
```

#### Clip Management
```bash
# List recorded clips
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-camera-01:8083/clips

# Download specific clip
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-camera-01:8083/clips/{clip_id}/download
```

## Troubleshooting Procedures

### Service Down Recovery (CRITICAL)

1. **Immediate Assessment**
```bash
# Network connectivity
ping pi-camera-01
# Port status
nc -z pi-camera-01 8083
# SSH access
ssh pi@pi-camera-01
```

2. **Hardware Verification**
```bash
# Check camera detection
vcgencmd get_camera
# Should return: supported=1 detected=1

# List video devices
ls -la /dev/video*
# Camera should appear as /dev/video0

# Test camera directly
raspistill -o test.jpg -t 1000
# Should capture test image
```

3. **Service Status Check**
```bash
# Check camera service
sudo systemctl status camera-server
sudo systemctl status motion-detector

# Check Docker containers
docker ps -a | grep camera
docker logs camera-server-container
docker logs motion-detector-container
```

4. **Service Recovery**
```bash
# Restart camera services
sudo systemctl restart camera-server
sudo systemctl restart motion-detector

# Docker approach
docker-compose -f /opt/camera/docker-compose.yml down
docker-compose -f /opt/camera/docker-compose.yml up -d

# GPU memory check (critical for camera)
vcgencmd get_mem gpu
# Should be at least 128MB for camera operations
```

### Camera Hardware Issues

1. **Camera Not Detected**
```bash
# Check camera connection
vcgencmd get_camera
# Enable camera if disabled
sudo raspi-config
# Navigate to Interface Options > Camera > Enable

# Check ribbon cable connection
# Power down, reseat camera ribbon cable
# Ensure contacts are clean and properly inserted
```

2. **Poor Image Quality**
```bash
# Test different resolutions
raspistill -o test_1080p.jpg -w 1920 -h 1080
raspistill -o test_720p.jpg -w 1280 -h 720

# Check focus (manual focus cameras)
# Adjust focus ring if available

# Check exposure settings
raspistill -o test_auto.jpg -ex auto
raspistill -o test_night.jpg -ex night
```

3. **Recording/Storage Issues**
```bash
# Check disk space
df -h
# Should have sufficient space for recordings

# Check storage mount
mount | grep storage
# Ensure recording directory is accessible

# Test write permissions
touch /opt/camera/recordings/test.txt
rm /opt/camera/recordings/test.txt
```

### Motion Detection Problems

1. **False Positives**
```bash
# Review detection sensitivity
# Lower sensitivity value
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"sensitivity": 50}' \
  http://pi-camera-01:8083/detection/config

# Check for environmental factors:
# - Moving shadows
# - Vegetation in wind
# - Changing lighting conditions
```

2. **Missed Events**
```bash
# Increase detection sensitivity
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"sensitivity": 85}' \
  http://pi-camera-01:8083/detection/config

# Verify motion detection zones
# Ensure zones cover areas of interest
```

3. **Detection Service Crashes**
```bash
# Check motion detector logs
journalctl -u motion-detector -f
# Look for memory issues, segmentation faults
# May need to reduce image resolution for processing
```

## Monitoring and Alerting

### Key Metrics (Prometheus)
- `camera_device_status{device="pi-camera-01"}` - Device operational status
- `camera_detection_events_total` - Motion detection count
- `camera_recording_active` - Active recording sessions
- `camera_storage_used_bytes` - Storage utilization
- `camera_temperature_celsius` - Device temperature
- `camera_response_time_seconds` - API response times

### Critical Alert Thresholds
- **Critical**: Camera service down >5 minutes
- **Critical**: Storage >90% full
- **Warning**: No motion events for >4 hours (may indicate hardware failure)
- **Warning**: Temperature >75°C
- **Info**: Recording duration >30 minutes

### Log Correlation
- **Source**: `camera`, `motion-detector`
- **Key Events**:
  - Service startup/shutdown
  - Motion detection events
  - Recording start/stop
  - Storage threshold warnings
  - Camera hardware errors
  - Authentication failures

## Operational Procedures

### Daily Checks
1. Verify camera service is responding
2. Check motion detection is active
3. Review overnight events/recordings
4. Validate storage levels
5. Test live preview functionality

### Weekly Maintenance
1. Clean camera lens (if accessible)
2. Archive old recordings to backup storage
3. Review and adjust motion detection zones
4. Check camera housing/weatherproofing
5. Test backup/restore procedures

### Emergency Procedures

#### Complete Camera System Failure
1. **Immediate Assessment**:
   - Check power supply to camera
   - Verify network connectivity
   - Test hardware components

2. **Recovery Actions**:
   - Restart services
   - Power cycle device
   - Replace camera module if hardware failure
   - Restore from backup configuration

#### Security Breach Detection
1. **Evidence Preservation**:
   - Immediately secure current recordings
   - Create system snapshot
   - Document timeline of events

2. **System Isolation**:
   - Isolate camera from network if compromised
   - Preserve logs for analysis
   - Coordinate with security team

## Integration Points

### Fleet API Integration
- Camera status reported to central dashboard
- Recording controls via Fleet UI
- Motion events fed to notification system
- Storage metrics tracked centrally

### Cross-Domain Coordination
- **Video Hub**: Triggered recording via pi-video-01
- **Audio System**: Synchronized audio recording
- **Zigbee Network**: Motion sensors and automation triggers

### External Systems
- **NAS Storage**: Long-term recording archival
- **Notification Service**: Real-time event alerts
- **Security Panel**: Integration with broader security system

### Related Runbooks
- [Video Operations](VIDEO-OPS.md) - Video recording coordination
- [Fleet Operations](FLEET-OPS.md) - Central management
- [Logs Operations](LOGS-OPS.md) - Security event correlation

## Privacy and Compliance

### Data Retention
- **Live Preview**: Temporary streams only
- **Event Recordings**: 30-day retention policy
- **Snapshots**: 90-day retention for security events
- **Logs**: 1-year retention for audit purposes

### Access Control
- **API Access**: Bearer token authentication required
- **Recording Access**: Audit logged for all downloads
- **Configuration**: Admin-level access only
- **Physical Access**: Camera locations secured

## Performance Optimization

### Resource Management
- **GPU Memory**: Minimum 128MB allocation
- **CPU Usage**: Monitor for encoding bottlenecks
- **Network Bandwidth**: Limit concurrent streams
- **Storage I/O**: Use fast storage for active recordings

### Quality vs Performance
- **Resolution**: Balance quality with storage needs
- **Frame Rate**: 15-30 FPS depending on use case
- **Compression**: H.264 for good compression ratio
- **Bitrate**: Adjust based on network capacity

## Configuration Management

### Key Configuration Files
- `/boot/config.txt` - Camera and GPU settings
- `/etc/systemd/system/camera-server.service` - Service definition
- `/opt/camera/detection.conf` - Motion detection parameters
- `/opt/camera/recording.conf` - Recording quality settings

### Backup Procedures
1. Configuration files backed up daily
2. Recent recordings backed up to NAS
3. System configuration snapshot weekly
4. Complete system image monthly

### Change Control
1. Test configuration changes on non-production system
2. Document all changes in change log
3. Maintain rollback procedures
4. Schedule changes during maintenance windows