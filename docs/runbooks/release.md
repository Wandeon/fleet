# Release Runbook

## Overview

This runbook provides step-by-step procedures for releasing Fleet updates using the automated CI/CD pipeline.

## Pre-Release Checklist

### 1. Code Readiness
- [ ] All PRs merged to main
- [ ] All CI checks passing
- [ ] Release readiness artifact shows "READY TO DEPLOY"
- [ ] No blocking issues in GitHub Issues

### 2. Environment Readiness
- [ ] VPS accessible and healthy
- [ ] Monitoring systems operational
- [ ] Backup of current deployment available

## Release Process

### Phase 1: Pre-Release Verification

1. **Check Current Status**
   ```bash
   # On VPS
   cd /opt/fleet/infra/vps
   docker compose -f compose.fleet.yml ps
   curl -I https://app.headspamartina.hr/
   ```

2. **Review Release Readiness Artifact**
   - Go to GitHub Actions → Latest main build
   - Download "release-readiness-report" artifact
   - Verify all status checks are green
   - Note any warnings or cautions

3. **Document Current State**
   ```bash
   # Record current image versions
   docker images | grep fleet | head -10

   # Record current commit
   cd /opt/fleet && git log -1 --oneline
   ```

### Phase 2: Deployment

1. **Get Latest Image Tags**
   - Go to GitHub Actions → Latest main build
   - Download "deployment-manifest" artifact
   - Extract image tags from JSON

2. **Pull New Images**
   ```bash
   # Set image tags from deployment manifest
   export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{sha}
   export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{sha}

   # Pull images
   docker pull $FLEET_API_IMAGE
   docker pull $FLEET_UI_IMAGE
   ```

3. **Deploy with Zero Downtime**
   ```bash
   cd /opt/fleet/infra/vps

   # Update compose environment
   echo "FLEET_API_IMAGE=$FLEET_API_IMAGE" > .env
   echo "FLEET_UI_IMAGE=$FLEET_UI_IMAGE" >> .env

   # Rolling restart
   docker compose -f compose.fleet.yml pull
   docker compose -f compose.fleet.yml up -d
   ```

### Phase 3: Post-Deployment Verification

1. **Health Checks**
   ```bash
   # Wait for containers to start
   sleep 30

   # Check container status
   docker compose -f compose.fleet.yml ps

   # Test application endpoints
   curl -f https://app.headspamartina.hr/ || echo "❌ UI failed"
   curl -f https://app.headspamartina.hr/api/fleet/layout || echo "❌ API failed"
   ```

2. **Functional Testing**
   - [ ] Web interface loads correctly
   - [ ] API endpoints respond
   - [ ] Authentication works
   - [ ] Database connections functional
   - [ ] Monitoring data flowing

3. **Performance Verification**
   ```bash
   # Check response times
   time curl -s https://app.headspamartina.hr/ > /dev/null

   # Check resource usage
   docker stats --no-stream
   ```

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

If critical issues are detected immediately:

1. **Quick Revert**
   ```bash
   # Use previous working images
   export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{previous_sha}
   export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{previous_sha}

   cd /opt/fleet/infra/vps
   docker compose -f compose.fleet.yml down
   docker compose -f compose.fleet.yml up -d
   ```

2. **Verify Rollback**
   ```bash
   docker compose -f compose.fleet.yml ps
   curl -I https://app.headspamartina.hr/
   ```

### Planned Rollback (Database Changes)

If database migrations are involved:

1. **Check Migration Impact**
   - Review database changes in the release
   - Determine if rollback is safe
   - Check for data compatibility

2. **Database Rollback** (if necessary)
   ```bash
   # Access API container
   docker compose -f compose.fleet.yml exec fleet-api sh

   # Inside container (CAUTION: Data loss possible)
   npx prisma migrate reset --skip-seed
   npx prisma migrate deploy
   ```

3. **Application Rollback**
   ```bash
   # Revert to previous images
   export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{previous_sha}
   export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{previous_sha}

   docker compose -f compose.fleet.yml up -d
   ```

## Monitoring and Alerts

### Key Metrics to Watch

1. **Application Health**
   - HTTP response codes
   - Response times
   - Error rates

2. **Infrastructure Health**
   - Container status
   - Memory usage
   - CPU utilization
   - Disk space

3. **Business Metrics**
   - User sessions
   - API call volume
   - Feature usage

### Alert Thresholds

- **HTTP 5xx errors** > 1% of requests
- **Response time** > 5 seconds for 95th percentile
- **Container restarts** > 3 in 10 minutes
- **Memory usage** > 90%

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check logs
docker compose -f compose.fleet.yml logs fleet-api
docker compose -f compose.fleet.yml logs fleet-ui

# Check image availability
docker images | grep fleet

# Verify environment variables
env | grep FLEET_
```

#### 2. Database Connection Issues
```bash
# Check database file
docker compose -f compose.fleet.yml exec fleet-api ls -la /data/

# Test database connectivity
docker compose -f compose.fleet.yml exec fleet-api node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.\$connect().then(() => console.log('DB OK')).catch(console.error);
"
```

#### 3. Proxy/Network Issues
```bash
# Check Caddy logs
docker compose -f compose.fleet.yml logs caddy

# Test internal connectivity
docker compose -f compose.fleet.yml exec fleet-ui curl fleet-api:3015/healthz

# Check network
docker network ls
docker network inspect vps_fleet-network
```

## Emergency Contacts

### Escalation Path
1. **First Response**: Development team
2. **Infrastructure Issues**: DevOps team
3. **Critical Outage**: On-call engineer

### Communication Channels
- **Slack**: `#fleet-releases`
- **Email**: `fleet-ops@company.com`
- **PagerDuty**: Fleet service

## Post-Release Activities

### 1. Documentation Updates
- [ ] Update CHANGELOG.md
- [ ] Document any manual steps taken
- [ ] Update runbook if process changed

### 2. Monitoring Setup
- [ ] Verify monitoring alerts are active
- [ ] Check dashboard visibility
- [ ] Confirm log aggregation working

### 3. Team Communication
- [ ] Notify stakeholders of successful deployment
- [ ] Share any issues encountered
- [ ] Update project status

## Release Validation Checklist

### Automated Checks
- [ ] All CI pipelines green
- [ ] Release readiness artifact shows ready
- [ ] Container images built and pushed
- [ ] Deployment manifest generated

### Manual Checks
- [ ] Application loads in browser
- [ ] User authentication works
- [ ] Core workflows functional
- [ ] API responses correct
- [ ] Database queries successful

### Business Validation
- [ ] Key features operational
- [ ] No user-reported issues
- [ ] Performance within acceptable range
- [ ] Monitoring shows healthy metrics

## Appendix

### Useful Commands

```bash
# Quick status check
docker compose -f compose.fleet.yml ps && curl -I https://app.headspamartina.hr/

# View recent logs
docker compose -f compose.fleet.yml logs --tail=50 fleet-api

# Resource usage
docker stats --no-stream

# Image management
docker images | grep fleet
docker image prune -f

# Database backup
docker compose -f compose.fleet.yml exec fleet-api cp /data/fleet.db /data/fleet.db.backup
```

### File Locations

- **Compose File**: `/opt/fleet/infra/vps/compose.fleet.yml`
- **Caddy Config**: `/opt/fleet/infra/vps/caddy.fleet.Caddyfile`
- **Environment**: `/opt/fleet/vps/fleet.env`
- **Database**: Container `/data/fleet.db`
- **Logs**: Docker logs (not persisted)

### Version History

| Version | Date | Changes | Rollback Tested |
|---------|------|---------|-----------------|
| v1.0 | 2025-09-27 | Initial release process | ✅ |