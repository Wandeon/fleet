# Zigbee Operations Runbook

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Scope: Phase C1 - Zigbee IoT Device Management

## Overview

The Zigbee domain manages IoT device coordination through the Zigbee coordinator on:
- **pi-video-01**: Zigbee coordinator hub (❌ SERVICE DOWN)

**Note**: Zigbee coordination is co-located with the video hub on pi-video-01 due to hardware constraints.

## Architecture Overview

### Coordinator Device
- **Host**: pi-video-01 (dual role: HDMI + Zigbee)
- **Hardware**: USB Zigbee coordinator stick
- **API Base**: http://pi-video-01:8082 (shared with video)
- **Authentication**: Bearer token via `HDMI_PI_VIDEO_01_TOKEN`
- **Status**: ❌ Service offline (impacts both video and Zigbee)

### Zigbee Network Topology
```
Fleet API
    ↓
pi-video-01 (Zigbee Coordinator)
    ↓
[Zigbee Mesh Network]
 ├── Smart Switches
 ├── Environmental Sensors
 ├── Motion Detectors
 ├── Smart Plugs
 └── Other Zigbee Devices
```

## API Reference

### Health Check
```bash
curl -H "Authorization: Bearer $HDMI_PI_VIDEO_01_TOKEN" \
  http://pi-video-01:8082/healthz
# Expected: 200 OK (shared endpoint with video)
```

### Zigbee Status
```bash
curl -H "Authorization: Bearer $HDMI_PI_VIDEO_01_TOKEN" \
  http://pi-video-01:8082/zigbee/status
# Returns: Network state, device count, coordinator info
```

### Device Management

#### List Paired Devices
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/devices
# Returns: All paired Zigbee devices with status
```

#### Device Information
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/devices/{device_id}
# Returns: Detailed device information and capabilities
```

### Pairing Operations

#### Start Pairing Mode
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 120}' \
  http://pi-video-01:8082/zigbee/pairing/start
```

#### Stop Pairing Mode
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/pairing/stop
```

#### Pairing Status
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/pairing/status
# Returns: Current pairing mode and discovered devices
```

### Device Control

#### Send Command to Device
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "toggle", "device_id": "switch_01"}' \
  http://pi-video-01:8082/zigbee/action
```

#### Quick Actions
```bash
# Turn on smart switch
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "on", "device": "living_room_switch"}' \
  http://pi-video-01:8082/zigbee/quick-action

# Read sensor values
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "read", "device": "temp_sensor_01"}' \
  http://pi-video-01:8082/zigbee/quick-action
```

## Troubleshooting Procedures

### Service Down Recovery (CRITICAL)

**Note**: Since Zigbee coordinator runs on pi-video-01, follow Video Operations runbook for basic service recovery, then address Zigbee-specific issues.

1. **Check Coordinator Hardware**
```bash
ssh pi@pi-video-01

# Check USB coordinator
lsusb | grep -i zigbee
# Should show Zigbee coordinator device

# Check device permissions
ls -la /dev/ttyUSB* /dev/ttyACM*
# Zigbee coordinator typically appears as /dev/ttyUSB0

# Check user permissions
groups $USER | grep dialout
# User should be in dialout group
```

2. **Zigbee Service Status**
```bash
# Check Zigbee coordinator service
sudo systemctl status zigbee-coordinator
journalctl -u zigbee-coordinator -f

# Check Zigbee2MQTT or Z2M (if used)
sudo systemctl status zigbee2mqtt
docker logs zigbee2mqtt-container
```

3. **Network Recovery**
```bash
# Restart Zigbee coordinator
sudo systemctl restart zigbee-coordinator

# If using containerized solution
docker restart zigbee-coordinator

# Check coordinator initialization
tail -f /var/log/zigbee/coordinator.log
```

### Device Connectivity Issues

1. **Device Offline/Unreachable**
```bash
# Check network topology
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/topology

# Ping specific device (Zigbee ping)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"device_id": "problem_device"}' \
  http://pi-video-01:8082/zigbee/ping
```

2. **Mesh Network Problems**
```bash
# Check network health
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/health

# Look for:
# - Weak signal strength (RSSI < -70dBm)
# - High packet loss
# - Route instability
```

3. **Device Re-pairing**
```bash
# Remove device from network
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/devices/{device_id}

# Start pairing mode
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"duration": 180}' \
  http://pi-video-01:8082/zigbee/pairing/start

# Follow device-specific pairing procedure
```

### Coordinator Hardware Failure

1. **USB Coordinator Issues**
```bash
# Check USB device stability
dmesg | grep -i usb | tail -20
# Look for disconnect/reconnect messages

# Test USB port
sudo udevadm monitor
# Unplug/replug coordinator, watch for events
```

2. **Firmware/Driver Problems**
```bash
# Check coordinator firmware version
# (Command varies by coordinator type)
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/coordinator/info

# Update firmware if needed (coordinate with vendor)
# Backup network configuration first
```

## Network Management

### Adding New Devices

1. **Pre-pairing Preparation**
```bash
# Ensure network is healthy
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/health

# Check available device capacity
# (Most coordinators support 100-200+ devices)
```

2. **Pairing Process**
```bash
# Start pairing mode
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"duration": 120}' \
  http://pi-video-01:8082/zigbee/pairing/start

# Put device into pairing mode per manufacturer instructions
# Monitor pairing candidates
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/pairing/candidates

# Complete pairing
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"device_id": "candidate_id", "name": "device_name"}' \
  http://pi-video-01:8082/zigbee/pairing/claim
```

### Removing Devices

```bash
# Graceful removal (preferred)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/devices/{device_id}

# Force removal (if device is offline)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/devices/{device_id}?force=true
```

### Network Optimization

1. **Route Optimization**
```bash
# Trigger network rediscovery
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/rediscover

# Check route quality
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/routes
```

2. **Signal Strength Analysis**
```bash
# Get network map with signal strengths
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/map

# Identify weak links (RSSI < -70dBm)
# Consider adding router devices to improve coverage
```

## Monitoring and Alerting

### Key Metrics (Prometheus)
- `zigbee_coordinator_status` - Coordinator online/offline status
- `zigbee_device_count` - Total paired devices
- `zigbee_device_online_count` - Currently reachable devices
- `zigbee_network_quality_percent` - Overall network health score
- `zigbee_message_success_rate` - Command success percentage
- `zigbee_coordinator_uptime_seconds` - Coordinator uptime

### Alert Thresholds
- **Critical**: Coordinator offline >5 minutes
- **Critical**: Network quality <50%
- **Warning**: Device offline count >20% of total
- **Warning**: Command success rate <90%
- **Info**: New device paired/unpaired

### Performance Monitoring
- **Response Time**: Commands should complete <2 seconds
- **Battery Devices**: Monitor battery levels
- **Signal Quality**: Track RSSI values for mesh optimization

## Operational Procedures

### Daily Checks
1. Verify coordinator is online and responsive
2. Check device online/offline status
3. Review overnight command failures
4. Monitor battery levels for battery-powered devices
5. Check network quality metrics

### Weekly Maintenance
1. Analyze network topology for optimization opportunities
2. Update device firmware if available
3. Review and clean up orphaned devices
4. Test critical automation scenarios
5. Backup network configuration

### Monthly Tasks
1. Full network health assessment
2. Coordinator firmware update check
3. Device database cleanup
4. Performance trend analysis
5. Capacity planning review

## Integration Points

### Fleet API Integration
- Zigbee status reported via video hub API
- Device control exposed through Fleet UI
- Automation triggers coordinated centrally
- Events logged for correlation

### Home Automation Integration
- **Motion Sensors**: Trigger camera recording
- **Environmental Sensors**: Climate monitoring
- **Smart Switches**: Lighting and appliance control
- **Security Devices**: Door/window sensors

### Related Runbooks
- [Video Operations](VIDEO-OPS.md) - Shared hardware platform
- [Camera Operations](CAMERA-OPS.md) - Motion detection coordination
- [Fleet Operations](FLEET-OPS.md) - Central coordination

## Security Considerations

### Network Security
- **Encryption**: All Zigbee communications encrypted
- **Authentication**: Device pairing requires physical access
- **Network Key**: Secure key management and rotation
- **Access Control**: API access restricted by bearer token

### Device Security
- **Firmware Updates**: Keep device firmware current
- **Default Credentials**: Change default device passwords
- **Physical Security**: Secure coordinator hardware
- **Network Isolation**: Consider Zigbee VLAN isolation

## Backup and Recovery

### Configuration Backup
```bash
# Export network configuration
curl -H "Authorization: Bearer $TOKEN" \
  http://pi-video-01:8082/zigbee/network/export > zigbee-backup.json

# Backup device database
# (Command varies by coordinator software)
sudo cp /opt/zigbee/devices.db /backups/zigbee-devices-$(date +%Y%m%d).db
```

### Disaster Recovery
1. **Coordinator Hardware Failure**:
   - Install replacement coordinator
   - Restore network configuration
   - Re-pair devices if needed

2. **Complete Network Loss**:
   - Rebuild network from scratch
   - Re-pair all devices systematically
   - Restore automation rules

3. **Partial Data Loss**:
   - Restore from last good backup
   - Verify device functionality
   - Update missing configurations

## Troubleshooting Reference

### Common Error Codes
- **0x00**: Success
- **0x8A**: Unsupported attribute
- **0x8B**: Invalid value
- **0x8C**: Read only
- **0x8D**: Insufficient space
- **0xC1**: Network key failure
- **0xC2**: Unknown device

### Device-Specific Issues
- **Smart Switches**: Check load compatibility
- **Sensors**: Verify battery levels and placement
- **Smart Plugs**: Ensure proper grounding
- **Motion Detectors**: Adjust sensitivity settings