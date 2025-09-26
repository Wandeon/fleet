# Logs Operations Runbook

Generated: $(date)
Environment: Production VPS at app.headspamartina.hr
Scope: Phase C1 - Centralized Logging and Observability

## Overview

The Logs domain provides centralized log aggregation, correlation, and analysis across the fleet:
- **Fleet API**: Primary application logging
- **Device Services**: Pi device operational logs
- **System Logs**: Infrastructure and system events

## Architecture Overview

### Log Collection Sources
```
Fleet Ecosystem Logging Architecture:

VPS Fleet API (app.headspamartina.hr)
├── fleet-api-1 container → JSON structured logs
├── fleet-worker-1 container → Background task logs
├── fleet-ui-1 container → Web server logs
├── caddy-1 container → HTTP access logs
└── System logs → Docker, systemd

Pi Device Logs (via log shipping)
├── pi-audio-01 → Audio service logs
├── pi-audio-02 → Audio service logs (if operational)
├── pi-video-01 → Video + Zigbee service logs
└── pi-camera-01 → Camera + motion detection logs

Aggregation → Loki/Grafana Stack (planned)
```

## Log Categories and Sources

### Application Logs (Fleet API)
- **Source**: `fleet-api`, `fleet-worker`
- **Format**: JSON structured logging
- **Location**: Docker container logs
- **Key Fields**:
  - `timestamp` - ISO 8601 timestamp
  - `level` - INFO, WARN, ERROR, DEBUG
  - `correlation_id` - Request tracing
  - `source` - Service name
  - `message` - Human readable message
  - `context` - Additional structured data

### Device Service Logs
- **Audio Logs**: `audio-player` service
- **Video Logs**: `hdmi-media`, `zigbee-coordinator` services
- **Camera Logs**: `camera`, `motion-detector` services
- **Format**: Mixed (systemd journal + application logs)

### System Logs
- **Docker**: Container lifecycle events
- **Systemd**: Service management events
- **Network**: Connectivity and routing
- **Security**: Authentication and authorization

## Log Access and Querying

### Docker Container Logs
```bash
# Fleet API logs
docker logs vps-fleet-api-1 --tail 100 -f

# Fleet Worker logs
docker logs vps-fleet-worker-1 --tail 100 -f

# Fleet UI logs
docker logs vps-fleet-ui-1 --tail 100 -f

# Caddy proxy logs
docker logs vps-caddy-1 --tail 100 -f
```

### Structured Log Queries
```bash
# Filter by log level
docker logs vps-fleet-api-1 2>&1 | jq 'select(.level == "ERROR")'

# Filter by correlation ID
docker logs vps-fleet-api-1 2>&1 | jq 'select(.correlation_id == "abc123")'

# Filter by timestamp range (last hour)
docker logs vps-fleet-api-1 --since="1h" 2>&1 | jq '.'

# Search for specific patterns
docker logs vps-fleet-api-1 2>&1 | grep -i "authentication"
```

### Device Log Access (when operational)
```bash
# SSH to device and check service logs
ssh pi@pi-audio-01
journalctl -u audio-player -f --since="1 hour ago"

# Check Docker container logs on device
docker logs audio-service-container --tail 50 -f

# System logs
journalctl -f --since="1 hour ago"
```

## Log Analysis Procedures

### Request Tracing
```bash
# Find all log entries for a specific request
CORRELATION_ID="req_20250926_004500_abc123"
docker logs vps-fleet-api-1 2>&1 | \
  jq --arg cid "$CORRELATION_ID" 'select(.correlation_id == $cid)'
```

### Error Investigation
```bash
# Find recent errors across all services
echo "=== Fleet API Errors ==="
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.level == "ERROR")'

echo "=== Worker Errors ==="
docker logs vps-fleet-worker-1 --since="1h" 2>&1 | \
  jq 'select(.level == "ERROR")'

# Count error frequency
docker logs vps-fleet-api-1 --since="24h" 2>&1 | \
  jq -r 'select(.level == "ERROR") | .message' | \
  sort | uniq -c | sort -rn
```

### Performance Analysis
```bash
# Find slow requests (if performance metrics are logged)
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.duration_ms != null and .duration_ms > 1000)'

# API endpoint analysis
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq -r 'select(.endpoint != null) | .endpoint' | \
  sort | uniq -c | sort -rn
```

### Device Status Correlation
```bash
# Correlate device failures with fleet API errors
echo "=== Device Communication Errors ==="
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("device")) | select(.level == "ERROR")'

# Authentication failures
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("auth")) | select(.level == "ERROR")'
```

## Monitoring and Alerting

### Key Log Metrics
- **Error Rate**: Errors per minute across services
- **Response Time**: Request duration distribution
- **Device Communication**: Success/failure rates
- **Authentication Events**: Login attempts and failures
- **Resource Usage**: Memory/CPU alerts in logs

### Critical Log Patterns
```bash
# Monitor for these patterns (for future alerting setup)
CRITICAL_PATTERNS=(
  "OutOfMemoryError"
  "Connection refused"
  "Authentication failed"
  "Device unreachable"
  "Service unavailable"
  "Database connection lost"
  "Certificate expired"
)

# Example monitoring script
for pattern in "${CRITICAL_PATTERNS[@]}"; do
  echo "=== Checking for: $pattern ==="
  docker logs vps-fleet-api-1 --since="5m" 2>&1 | \
    grep -i "$pattern" | tail -5
done
```

### Health Check Correlation
```bash
# Correlate health check failures with logs
echo "=== Health Check Failures ==="
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("health")) | select(.level == "ERROR")'

# Device health status changes
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("device_status_change"))'
```

## Troubleshooting Procedures

### Service Startup Issues
```bash
# Check service startup logs
docker logs vps-fleet-api-1 --since="10m" | head -50

# Look for common startup problems:
# - Port binding failures
# - Database connection issues
# - Configuration errors
# - Missing environment variables
```

### Database Connection Problems
```bash
# Check for database-related errors
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("database") or contains("sql"))'

# Connection pool issues
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("connection") or contains("pool"))'
```

### Memory/Resource Issues
```bash
# Check for memory warnings
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  grep -i "memory\|oom\|heap"

# CPU/performance warnings
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  grep -i "cpu\|performance\|slow\|timeout"
```

### Authentication/Authorization Issues
```bash
# Check auth-related logs
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.message | contains("auth") or contains("token") or contains("permission"))'

# Failed API calls due to authentication
docker logs vps-fleet-api-1 --since="1h" 2>&1 | \
  jq 'select(.status_code == 401 or .status_code == 403)'
```

## Log Rotation and Retention

### Docker Log Management
```bash
# Check current log sizes
docker system df
docker ps --format "table {{.Names}}\t{{.Size}}"

# Configure log rotation (in docker-compose.yml)
# logging:
#   driver: "json-file"
#   options:
#     max-size: "100m"
#     max-file: "5"
```

### System Log Cleanup
```bash
# Clean up old Docker logs
docker system prune -f
docker logs vps-fleet-api-1 > /dev/null 2>&1 # Truncate current logs

# System journal cleanup
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=1G
```

## Operational Procedures

### Daily Log Review
1. **Error Summary**: Check error counts across all services
2. **Performance Review**: Identify slow requests and bottlenecks
3. **Device Status**: Review device communication logs
4. **Security Events**: Check authentication and access logs
5. **Resource Usage**: Monitor memory/CPU warnings

### Weekly Analysis
1. **Trend Analysis**: Compare error rates week-over-week
2. **Capacity Planning**: Review resource usage trends
3. **Device Reliability**: Analyze device failure patterns
4. **Log Cleanup**: Archive/rotate old logs
5. **Configuration Review**: Update log levels if needed

### Incident Response
1. **Immediate**: Identify error patterns and correlation IDs
2. **Root Cause**: Trace through logs to find initial failure
3. **Impact Assessment**: Determine affected services/users
4. **Recovery**: Document steps taken for resolution
5. **Post-Mortem**: Analyze logs for prevention opportunities

## Integration Points

### Observability Stack (Future)
- **Loki**: Centralized log aggregation
- **Grafana**: Log visualization and dashboards
- **Prometheus**: Metrics from log analysis
- **Alert Manager**: Log-based alerting rules

### Fleet API Integration
- **Structured Logging**: JSON format with correlation IDs
- **Context Propagation**: Request tracing across services
- **Error Classification**: Categorized error types
- **Metrics Extraction**: Performance data from logs

### Device Integration
- **Log Shipping**: Forward device logs to central collection
- **Health Reporting**: Device status reflected in central logs
- **Event Correlation**: Cross-device event tracking
- **Performance Monitoring**: Device performance metrics

## Log Schema and Standards

### Standard Log Fields
```json
{
  "timestamp": "2025-09-26T00:45:00.123Z",
  "level": "INFO|WARN|ERROR|DEBUG",
  "source": "fleet-api|fleet-worker|audio-player|...",
  "correlation_id": "req_20250926_004500_abc123",
  "message": "Human readable message",
  "context": {
    "user_id": "user123",
    "device_id": "pi-audio-01",
    "endpoint": "/api/audio/play",
    "duration_ms": 150,
    "status_code": 200
  }
}
```

### Log Levels Usage
- **DEBUG**: Detailed diagnostic information
- **INFO**: General operational messages
- **WARN**: Potentially harmful situations
- **ERROR**: Error events but application continues
- **FATAL**: Very severe errors, application may abort

## Security and Compliance

### Sensitive Data Handling
- **PII Redaction**: Remove personal information from logs
- **Token Masking**: Never log full authentication tokens
- **Password Protection**: No passwords in log messages
- **Data Classification**: Mark sensitive log entries

### Audit Logging
- **Access Events**: API access and authentication
- **Configuration Changes**: System and device configuration
- **Administrative Actions**: Operator account changes
- **Data Access**: Sensitive data access patterns

### Retention Policies
- **Operational Logs**: 30 days local retention
- **Security Logs**: 90 days retention required
- **Audit Logs**: 1 year retention for compliance
- **Archive Strategy**: Compress and backup to cold storage

## Performance Optimization

### Log Volume Management
- **Dynamic Log Levels**: Adjust verbosity based on conditions
- **Sampling**: Sample high-volume debug logs
- **Filtering**: Remove unnecessary log entries
- **Batching**: Batch log writes for performance

### Storage Efficiency
- **Compression**: Compress rotated log files
- **Structured Data**: Use efficient JSON structures
- **Index Optimization**: Optimize for common query patterns
- **Cold Storage**: Archive old logs to cheaper storage