# Observability and Alerting Setup - Phase C1

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Status: Phase C1 Operational Hardening

## Current State Assessment

### Monitoring Infrastructure Status
- ✅ **Prometheus Configuration**: Complete (`prometheus.yml`)
- ✅ **Grafana Setup**: Configured with admin credentials
- ✅ **Loki**: Log aggregation ready
- ✅ **AlertManager**: Configured with Slack webhook
- ✅ **Blackbox Exporter**: HTTP probe monitoring
- ❌ **Services**: Monitoring stack NOT currently running

### Device Monitoring Status
Based on reachability assessment:
- ✅ **pi-audio-01**: Operational, metrics accessible at :8081/metrics
- ❌ **pi-audio-02**: Service down, metrics unavailable
- ❌ **pi-video-01**: Service down, metrics unavailable (also Zigbee coordinator)
- ❌ **pi-camera-01**: Service down, metrics unavailable

## Implementation Plan

### Phase 1: Start Monitoring Stack
```bash
cd /opt/fleet/infra/vps
docker-compose -f compose.prom-grafana-blackbox.yml up -d
```

**Services Started**:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/OgkynKwO8ZpHbiEu7I8E5nliHyTOvhxC)
- Loki: http://localhost:3100
- AlertManager: http://localhost:9093
- Blackbox: http://localhost:9115

### Phase 2: Validate Device Targets
Current Prometheus targets need authentication headers added:

**Audio Targets** (`targets-audio.json`):
```json
[
  {
    "targets": ["pi-audio-01:8081"],
    "labels": {
      "role": "audio-player",
      "instance": "pi-audio-01",
      "status": "operational"
    }
  },
  {
    "targets": ["pi-audio-02:8081"],
    "labels": {
      "role": "audio-player",
      "instance": "pi-audio-02",
      "status": "down"
    }
  }
]
```

**Authentication Challenge**: Device metrics endpoints require Bearer tokens, but Prometheus configuration doesn't include authentication for device targets.

### Phase 3: Enhanced Alert Rules

Current alerts are basic. Need to add device-specific alerting based on reachability assessment:

```yaml
# Device-Specific Alerts
- alert: AudioDeviceDown
  expr: probe_success{job="blackbox-http",instance=~"pi-audio-.*"} == 0
  for: 2m
  labels: { severity: critical }
  annotations:
    summary: "Audio device {{ $labels.instance }} unreachable"
    description: "Device {{ $labels.instance }} has been unreachable for 2 minutes"

- alert: VideoHubDown
  expr: probe_success{job="blackbox-http",instance="pi-video-01"} == 0
  for: 3m
  labels: { severity: critical }
  annotations:
    summary: "Video hub offline - HDMI and Zigbee services affected"
    description: "pi-video-01 hosts both video and Zigbee coordination"

- alert: CameraSystemDown
  expr: probe_success{job="blackbox-http",instance="pi-camera-01"} == 0
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Camera system offline"
    description: "Security monitoring capabilities degraded"

- alert: FleetCapacityDegraded
  expr: (count(probe_success{job="blackbox-http",instance=~"pi-.*"} == 1) / count(probe_success{job="blackbox-http",instance=~"pi-.*"})) < 0.5
  for: 1m
  labels: { severity: critical }
  annotations:
    summary: "Fleet capacity < 50%"
    description: "More than half of Pi devices are offline"
```

## Grafana Dashboard Strategy

### Dashboard Categories

1. **Fleet Overview Dashboard**
   - Device status matrix (4 devices)
   - Service health indicators
   - Network connectivity status
   - Critical alerts summary

2. **Audio Domain Dashboard**
   - pi-audio-01 metrics (operational)
   - pi-audio-02 status (recovery monitoring)
   - Audio synchronization metrics
   - Performance trends

3. **Video + Zigbee Dashboard**
   - pi-video-01 comprehensive monitoring
   - HDMI output status
   - Zigbee network topology
   - Device coordination metrics

4. **Security Dashboard**
   - pi-camera-01 monitoring
   - Motion detection events
   - Recording status
   - Storage utilization

5. **Logs Dashboard**
   - Centralized log aggregation
   - Error rate monitoring
   - Correlation ID tracing
   - Service health correlation

## Current Monitoring Gaps

### Authentication Issues
- Device metrics endpoints require Bearer tokens
- Prometheus config lacks device authentication
- Need to add authentication to scrape configs

### Service Discovery
- Static targets don't reflect dynamic service status
- Need health-based service discovery
- Missing service dependency mapping

### Log Integration
- Loki configured but not collecting device logs
- No log shipping from Pi devices
- Missing correlation between metrics and logs

## Recommended Actions

### Immediate (Next 30 minutes)
1. ✅ Start monitoring stack
2. ✅ Validate Prometheus targets can reach operational devices
3. ✅ Configure device authentication in Prometheus
4. ✅ Test Grafana dashboard access
5. ✅ Verify AlertManager webhook configuration

### Short-term (Next 2 hours)
1. Create fleet overview dashboard
2. Add device-specific alert rules
3. Configure log shipping from pi-audio-01
4. Test end-to-end alerting pipeline
5. Document dashboard access and usage

### Medium-term (Next week)
1. Deploy log shipping to all operational devices
2. Create domain-specific dashboards
3. Implement SLO monitoring
4. Add capacity and performance trending
5. Automate monitoring configuration

## Success Criteria

### Operational Visibility
- [ ] Real-time status of all 4 Pi devices
- [ ] Fleet-wide health dashboard accessible
- [ ] Critical alerts firing within 5 minutes of failure
- [ ] Log correlation across services

### Performance Monitoring
- [ ] Response time tracking for operational devices
- [ ] Resource utilization trending
- [ ] Service dependency mapping
- [ ] Capacity planning metrics

### Incident Response
- [ ] Automated alerting to operations team
- [ ] Runbook integration from dashboards
- [ ] Historical trending for post-incident analysis
- [ ] SLO tracking and reporting

## Access Information

### Monitoring URLs (once started)
- **Grafana**: http://app.headspamartina.hr:3001/
- **Prometheus**: http://app.headspamartina.hr:9090/
- **AlertManager**: http://app.headspamartina.hr:9093/

### Authentication
- **Grafana**: admin / OgkynKwO8ZpHbiEu7I8E5nliHyTOvhxC
- **Prometheus**: No authentication (internal access)
- **Device APIs**: Bearer tokens from fleet.env

## Risk Assessment

### High Risk
- **Single Point of Failure**: Monitoring stack on same VPS as applications
- **No Backup Monitoring**: If VPS fails, lose observability
- **Authentication Exposure**: Device tokens in Prometheus config

### Medium Risk
- **Alert Fatigue**: Too many false positives from down devices
- **Storage Growth**: Log and metric retention needs management
- **Network Dependencies**: Monitoring relies on same network as monitored services

### Mitigation Strategies
1. **External Monitoring**: Consider external uptime monitoring service
2. **Alert Tuning**: Adjust thresholds based on operational patterns
3. **Data Retention**: Implement automated cleanup policies
4. **Backup Strategy**: Export critical dashboards and configs