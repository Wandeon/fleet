# Audio Operations Runbook

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Scope: Phase C1 - Audio Player Management

## Overview

The Audio domain manages synchronized audio playback across 2 Raspberry Pi devices:
- **pi-audio-01**: Primary audio player (✅ OPERATIONAL)
- **pi-audio-02**: Secondary audio player (❌ SERVICE DOWN)

## Device Specifications

### pi-audio-01 (PRIMARY)
- **Role**: audio-player
- **Hardware**: HiFiBerry audio HAT
- **API Base**: http://pi-audio-01:8081
- **Authentication**: Bearer token via `AUDIO_PI_AUDIO_01_TOKEN`
- **Status**: ✅ Fully operational (sub-5ms response times)

### pi-audio-02 (SECONDARY)
- **Role**: audio-player
- **Hardware**: HiFiBerry audio HAT
- **API Base**: http://pi-audio-02:8081
- **Authentication**: Bearer token via `AUDIO_PI_AUDIO_02_TOKEN`
- **Status**: ❌ API service offline (network reachable)

## API Reference

### Health Check
```bash
curl -H "Authorization: Bearer $TOKEN" http://pi-audio-01:8081/healthz
# Expected: 200 OK
```

### Status Query
```bash
curl -H "Authorization: Bearer $TOKEN" http://pi-audio-01:8081/status
# Returns: Current playback state, volume, session info
```

### Prometheus Metrics
```bash
curl -H "Authorization: Bearer $TOKEN" http://pi-audio-01:8081/metrics
# Returns: Performance metrics in Prometheus format
```

### Control Operations

#### Play Stream
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "stream"}' \
  http://pi-audio-01:8081/play
```

#### Volume Control
```bash
# Master volume
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"volume": 75}' \
  http://pi-audio-01:8081/volume/master

# Device volume
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"volume": 80}' \
  http://pi-audio-01:8081/volume
```

#### Seek Control
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"position": 120}' \
  http://pi-audio-01:8081/seek
```

## Troubleshooting Procedures

### Service Down Recovery (pi-audio-02)

1. **Check Network Connectivity**
```bash
ping pi-audio-02
# Should respond successfully
```

2. **Check Port Status**
```bash
nc -z pi-audio-02 8081
# Should connect if service is running
```

3. **SSH Access and Service Status**
```bash
ssh pi@pi-audio-02
sudo systemctl status audio-player
# OR for Docker:
docker ps | grep audio
docker logs audio-player-container
```

4. **Service Restart**
```bash
# SystemD approach:
sudo systemctl restart audio-player
sudo systemctl enable audio-player

# Docker approach:
docker restart audio-player-container
# OR
docker-compose -f /opt/audio/docker-compose.yml up -d
```

5. **Configuration Verification**
```bash
# Check environment variables
env | grep AUDIO
# Check audio hardware
aplay -l
# Check HiFiBerry status
dmesg | grep -i hifiberry
```

### Performance Issues

1. **High Latency (>50ms)**
- Check CPU usage: `top`, `htop`
- Check memory usage: `free -h`
- Check disk I/O: `iostat -x 1`
- Network latency: `ping -c 10 pi-audio-01`

2. **Audio Dropouts/Stuttering**
- Check buffer settings in audio config
- Verify network stability
- Check for competing processes
- Review system logs: `journalctl -u audio-player -f`

3. **Synchronization Issues**
- Verify NTP sync: `timedatectl status`
- Check audio sync mode configuration
- Review correlation IDs in logs
- Test cross-device timing

### Authentication Failures

1. **401 Unauthorized**
```bash
# Verify token is set
echo $AUDIO_PI_AUDIO_01_TOKEN
# Test token directly
curl -H "Authorization: Bearer $AUDIO_PI_AUDIO_01_TOKEN" \
  http://pi-audio-01:8081/healthz
```

2. **Token Refresh** (if applicable)
- Check token expiration
- Regenerate tokens if needed
- Update environment variables
- Restart services after token update

## Monitoring and Alerting

### Key Metrics (Prometheus)
- `audio_device_status{device="pi-audio-01"}` - Device operational status
- `audio_response_time_seconds` - API response times
- `audio_buffer_underruns_total` - Audio quality indicator
- `audio_volume_level` - Current volume settings
- `audio_session_duration_seconds` - Active session time

### Alert Thresholds
- **Critical**: Device unreachable for >2 minutes
- **Warning**: Response time >100ms for 5 consecutive checks
- **Info**: Volume level changes >20% delta

### Log Correlation
- **Source**: `audio-player`
- **Correlation ID**: Track requests across audio domain
- **Key Events**:
  - Service startup/shutdown
  - Playback state changes
  - Volume adjustments
  - Authentication failures
  - Hardware errors

## Operational Procedures

### Daily Checks
1. Verify both devices are responding to health checks
2. Check audio synchronization across devices
3. Review overnight logs for errors
4. Validate volume levels are appropriate
5. Test playback functionality

### Weekly Maintenance
1. Review Prometheus metrics and trends
2. Check system resource usage
3. Verify backup/config sync status
4. Update audio library if needed
5. Test failover scenarios

### Emergency Recovery
1. **Single Device Failure**: Route traffic to operational device
2. **Complete Audio Failure**:
   - Activate backup audio system
   - Notify operations team
   - Begin device recovery procedures
3. **Data Loss**: Restore from last known good configuration

## Integration Points

### Fleet API Integration
- Audio domain status reported to Fleet API
- Control operations exposed through Fleet UI
- Authentication managed centrally
- Metrics aggregated in fleet-wide monitoring

### Related Runbooks
- [Fleet Operations](FLEET-OPS.md) - Central fleet management
- [Logs Operations](LOGS-OPS.md) - Log aggregation and analysis
- [Video Operations](VIDEO-OPS.md) - Cross-domain synchronization

## Change Management

### Configuration Changes
1. Test on pi-audio-01 first (primary device)
2. Validate functionality and performance
3. Apply to pi-audio-02 after successful testing
4. Document changes in fleet configuration

### Service Updates
1. Update secondary device first
2. Test functionality while primary handles traffic
3. Update primary device during maintenance window
4. Verify synchronization after both updates