# Video Operations Runbook

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Scope: Phase C1 - HDMI Media Hub Management

## Overview

The Video domain manages HDMI media display and Zigbee IoT coordination through:
- **pi-video-01**: HDMI media hub + Zigbee coordinator (❌ SERVICE DOWN)

## Device Specifications

### pi-video-01 (HDMI + ZIGBEE HUB)
- **Role**: hdmi-media
- **Hardware**: HDMI output, Zigbee coordinator
- **API Base**: http://pi-video-01:8082
- **Authentication**: Bearer token via `HDMI_PI_VIDEO_01_TOKEN`
- **Status**: ❌ API service offline (network reachable)
- **Capabilities**:
  - HDMI video output control
  - CEC device management
  - Zigbee device coordination
  - Video recording/streaming

## API Reference

### Health Check
```bash
curl -H "Authorization: Bearer $HDMI_PI_VIDEO_01_TOKEN" \
  http://pi-video-01:8082/healthz
# Expected: 200 OK when operational
```

### Status Query
```bash
curl -H "Authorization: Bearer $HDMI_PI_VIDEO_01_TOKEN" \
  http://pi-video-01:8082/status
# Returns: HDMI status, CEC devices, recording state
```

### Prometheus Metrics
```bash
curl -H "Authorization: Bearer $HDMI_PI_VIDEO_01_TOKEN" \
  http://pi-video-01:8082/metrics
# Returns: Video performance metrics
```

### Video Control Operations

#### Power Management
```bash
# Power on HDMI display
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "on"}' \
  http://pi-video-01:8082/power
```

#### Input Selection
```bash
# Switch HDMI input
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": "hdmi1"}' \
  http://pi-video-01:8082/input
```

#### Video Preview
```bash
# Start live preview stream
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quality": "720p", "duration": 30}' \
  http://pi-video-01:8082/preview
```

#### Recording Control
```bash
# Start recording
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 300, "quality": "1080p"}' \
  http://pi-video-01:8082/record/start

# Stop recording
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/record/stop
```

### CEC Device Management

#### Discover CEC Devices
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/cec/devices
# Returns: List of connected CEC-enabled devices
```

#### CEC Commands
```bash
# Send CEC power on to TV
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device": "tv", "command": "power_on"}' \
  http://pi-video-01:8082/cec/command
```

## Troubleshooting Procedures

### Service Down Recovery (CRITICAL)

1. **Immediate Assessment**
```bash
# Network connectivity
ping pi-video-01
# Port status
nc -z pi-video-01 8082
# SSH access
ssh pi@pi-video-01
```

2. **Service Status Check**
```bash
# Check video service
sudo systemctl status video-hub
sudo systemctl status zigbee-coordinator

# Check Docker containers
docker ps -a | grep video
docker logs video-hub-container
docker logs zigbee-container
```

3. **Hardware Verification**
```bash
# HDMI detection
tvservice -s
# USB devices (Zigbee coordinator)
lsusb | grep -i zigbee
# GPU memory split
vcgencmd get_mem gpu
```

4. **Service Recovery**
```bash
# Restart video services
sudo systemctl restart video-hub
sudo systemctl restart zigbee-coordinator

# Docker approach
docker-compose -f /opt/video/docker-compose.yml down
docker-compose -f /opt/video/docker-compose.yml up -d

# Full system restart if needed
sudo reboot
```

### HDMI Display Issues

1. **No Display Output**
```bash
# Check HDMI status
tvservice -s
# Force HDMI mode
tvservice -p
tvservice -o HDMI
# Edit config.txt if needed
sudo nano /boot/config.txt
# Look for: hdmi_force_hotplug=1, hdmi_drive=2
```

2. **Resolution Problems**
```bash
# Get supported modes
tvservice -m CEA
tvservice -m DMT
# Set specific resolution
tvservice -e "CEA 16"  # 1080p60
```

3. **CEC Communication Failures**
```bash
# Install CEC utilities if missing
sudo apt install cec-utils
# Scan for devices
echo 'scan' | cec-client -s -d 1
# Test CEC command
echo 'on 0' | cec-client -s -d 1
```

### Zigbee Coordinator Issues

1. **USB Device Not Found**
```bash
# Check USB devices
lsusb
dmesg | grep -i usb
# Check device permissions
ls -la /dev/tty*
# Add user to dialout group if needed
sudo usermod -a -G dialout $USER
```

2. **Zigbee Network Problems**
```bash
# Check Zigbee service logs
journalctl -u zigbee-coordinator -f
# Reset Zigbee network (CAUTION: Will unpair all devices)
# Only if specifically required by support
```

### Performance Issues

1. **High CPU/Memory Usage**
```bash
# Monitor resources
top
htop
# Check GPU usage
sudo /opt/vc/bin/vcgencmd get_mem gpu
# Check temperature
vcgencmd measure_temp
```

2. **Video Stuttering/Lag**
```bash
# Check GPU memory split
vcgencmd get_mem gpu
# Should be 128 or higher for video work
# Edit /boot/config.txt: gpu_mem=128
# Check encoding performance
vcgencmd get_config
```

## Monitoring and Alerting

### Key Metrics (Prometheus)
- `video_device_status{device="pi-video-01"}` - Device operational status
- `video_hdmi_connected` - HDMI display connection status
- `video_recording_active` - Active recording sessions
- `video_temperature_celsius` - Device temperature monitoring
- `zigbee_coordinator_status` - Zigbee network health
- `zigbee_device_count` - Number of paired Zigbee devices

### Critical Alert Thresholds
- **Critical**: Video service down >3 minutes
- **Critical**: Device temperature >80°C
- **Warning**: HDMI display disconnected
- **Warning**: Zigbee coordinator offline
- **Info**: Recording session longer than 1 hour

### Log Correlation
- **Source**: `hdmi-media`, `zigbee-coordinator`
- **Key Events**:
  - Service startup/shutdown
  - HDMI connection changes
  - Recording start/stop
  - Zigbee device pairing/unpairing
  - Temperature alerts
  - Hardware failures

## Operational Procedures

### Daily Checks
1. Verify video service is responding
2. Check HDMI display connection status
3. Validate Zigbee coordinator is active
4. Review overnight recording logs
5. Check device temperature trends

### Weekly Maintenance
1. Clean up old recording files
2. Review Zigbee network topology
3. Check HDMI display health
4. Update Zigbee device firmware if available
5. Test emergency recording procedures

### Emergency Procedures

#### Complete Video System Failure
1. **Immediate Actions**:
   - Activate backup display system
   - Notify stakeholders of video outage
   - Begin diagnostic procedures

2. **Recovery Process**:
   - Attempt service restart
   - Check hardware connections
   - Review system logs
   - Escalate to hardware replacement if needed

#### Zigbee Network Failure
1. **Assessment**:
   - Check coordinator hardware
   - Verify USB connection
   - Review network topology

2. **Recovery Options**:
   - Restart Zigbee coordinator
   - Reset USB device
   - Restore network from backup (if available)
   - Re-pair critical devices

## Integration Points

### Fleet API Integration
- Video status reported to central dashboard
- Recording controls accessible via Fleet UI
- Zigbee device management integrated
- Metrics fed to fleet-wide monitoring

### Cross-Domain Dependencies
- **Audio Sync**: Video timing coordination with audio playback
- **Camera Integration**: Recording triggered by camera events
- **Zigbee Control**: IoT automation and environmental sensors

### Related Runbooks
- [Zigbee Operations](ZIGBEE-OPS.md) - IoT device management
- [Fleet Operations](FLEET-OPS.md) - Central coordination
- [Camera Operations](CAMERA-OPS.md) - Video recording integration

## Recovery Priorities

### Service Recovery Order
1. **Critical**: Video hub service (display functionality)
2. **High**: Zigbee coordinator (IoT control)
3. **Medium**: Recording capabilities
4. **Low**: Advanced CEC features

### Hardware Replacement
1. Keep backup Raspberry Pi 4 ready
2. Maintain spare HDMI cables
3. Have backup Zigbee coordinator USB stick
4. Document MAC addresses and device IDs

## Configuration Management

### Key Configuration Files
- `/boot/config.txt` - HDMI and GPU settings
- `/etc/systemd/system/video-hub.service` - Service definition
- `/opt/zigbee/coordinator.conf` - Zigbee configuration
- `/opt/video/recording.conf` - Recording parameters

### Backup Procedures
1. Configuration files backed up daily
2. Zigbee network topology exported weekly
3. Recording archive maintained on external storage
4. System image backup monthly