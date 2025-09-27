# Deployment and Networks

## Overview

Fleet uses a Docker Compose-based deployment with Caddy as a reverse proxy. This document covers network topology, port assignments, and deployment procedures.

## Network Architecture

```
Internet → Caddy (80/443) → Fleet UI (3000) → Fleet API (3015)
                         → Fleet API (3015) (direct for /api/*)
```

### Port Assignments

#### Production Ports (VPS)
- **Caddy**: 80 (HTTP), 443 (HTTPS)
- **Fleet API**: 3015 (internal), 3005 (host mapping)
- **Fleet UI**: 3000 (internal), 3006 (host mapping)
- **Fleet Worker**: 3015 (internal, no host mapping)

#### Development Ports
- **Fleet API**: 3015 (matches production)
- **Fleet UI**: 3000 (matches production)
- **API Mock**: 3020

**Important**: Internal container ports must match between development and production to ensure Caddy configuration compatibility.

## Container Images

### Registry and Tagging
- **Registry**: `ghcr.io`
- **API Image**: `ghcr.io/org/fleet-api`
- **UI Image**: `ghcr.io/org/fleet-ui`

### Image Tags
- **Latest**: `latest` (tracks main branch)
- **Branch**: `main-{commit_sha}` (specific commits)
- **Development**: `dev-{branch_name}` (feature branches)

### VPS Image Management

**VPS pulls images; no local builds in normal flow.**

#### Deployment Process
1. **CI builds and pushes** images after merge to main
2. **VPS pulls** specific tagged images
3. **Compose restart** with new images

#### Manual Image Pull
```bash
# Pull specific commit images
docker pull ghcr.io/org/fleet-api:main-abc1234
docker pull ghcr.io/org/fleet-ui:main-abc1234

# Update compose environment
export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-abc1234
export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-abc1234

# Restart services
cd /opt/fleet/infra/vps
docker compose -f compose.fleet.yml pull
docker compose -f compose.fleet.yml up -d
```

## Caddy Configuration

### Reverse Proxy Rules

#### API Routes (`/api/*`)
```caddyfile
handle_path /api/* {
  reverse_proxy fleet-api:3015
}
```

#### UI Routes (everything else)
```caddyfile
handle {
  reverse_proxy fleet-ui:3000
}
```

#### Special Routes
- **SSE Streaming**: `/ui/logs/stream` → `fleet-api:3015/logs/stream`
- **Metrics**: `/metrics` → `fleet-api:3015/metrics`
- **Health**: Direct to API with auth headers

### Port Drift Prevention

The CI pipeline automatically checks for port mismatches between:
- **Docker Compose**: Container port definitions
- **Caddyfile**: Upstream target ports

**Example mismatch detection**:
```bash
# Compose says UI runs on port 3000
ports: ["3006:3000"]

# But Caddy tries to proxy to port 3005
reverse_proxy fleet-ui:3005  # ❌ DRIFT DETECTED
```

## Deployment Procedures

### Standard Deployment (CI-Driven)

1. **Merge PR to main**
   - CI automatically builds images
   - Images tagged with commit SHA
   - Deployment manifest generated

2. **VPS deployment**
   ```bash
   # Use deployment manifest from CI artifacts
   export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{sha}
   export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{sha}

   cd /opt/fleet/infra/vps
   docker compose -f compose.fleet.yml pull
   docker compose -f compose.fleet.yml up -d
   ```

3. **Verify deployment**
   ```bash
   docker compose -f compose.fleet.yml ps
   curl -I https://app.headspamartina.hr/
   ```

### Emergency Deployment

For hotfixes or urgent patches:

1. **Create hotfix branch**
2. **Fast-track review** with both API and infra teams
3. **Merge with all CI checks passing**
4. **Deploy immediately** using CI-generated artifacts

### Rollback Procedure

```bash
# Find previous working images
docker images | grep fleet

# Update to previous tags
export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{previous_sha}
export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{previous_sha}

# Restart with previous images
cd /opt/fleet/infra/vps
docker compose -f compose.fleet.yml down
docker compose -f compose.fleet.yml up -d
```

## Network Security

### Internal Communication
- **Fleet Network**: Isolated Docker network `br-fleet`
- **Service Discovery**: Container names (fleet-api, fleet-ui)
- **No external access** to internal ports except through Caddy

### External Access
- **HTTPS only** in production via Caddy TLS
- **Bearer token authentication** for API endpoints
- **Rate limiting** on API routes

### Monitoring Integration
- **Prometheus targets** defined in inventory files
- **Automatic target generation** from device registry
- **Health checks** via blackbox exporter

## Storage and Persistence

### Volume Mounts
- **Fleet Data**: Persistent database and uploads
- **Caddy Data**: TLS certificates and cache
- **Caddy Config**: Runtime configuration

### Database
- **SQLite** for development and production
- **File location**: `/data/fleet.db` in container
- **Migrations**: Applied automatically on startup

## Environment Variables

### Production Environment
```bash
# Container images
FLEET_API_IMAGE=ghcr.io/org/fleet-api:latest
FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:latest

# Network configuration
ORIGIN=https://app.headspamartina.hr
API_BASE_URL=http://fleet-api:3015

# Feature flags
VITE_USE_MOCKS=0
PLACEHOLDER_MODE=false
```

### Development Environment
```bash
# Local development
API_BASE_URL=http://localhost:3015
VITE_USE_MOCKS=1
PLACEHOLDER_MODE=true
```

## Troubleshooting

### Common Network Issues

#### 1. Port Drift
**Symptoms**: 502 Bad Gateway, connection refused
**Diagnosis**: Check Caddy logs for upstream connection errors
**Solution**: Align ports between Caddy and Compose configs

#### 2. Container Communication
**Symptoms**: API calls fail, services can't reach each other
**Diagnosis**: Check Docker network and service names
**Solution**: Ensure containers are on same network (`fleet-network`)

#### 3. TLS/HTTPS Issues
**Symptoms**: Certificate errors, HTTPS redirect loops
**Diagnosis**: Check Caddy TLS configuration
**Solution**: Verify domain configuration and certificate issuance

#### 4. Image Pull Failures
**Symptoms**: Container startup failures, image not found
**Diagnosis**: Check registry authentication and network access
**Solution**: Verify GHCR access and image tags

### Diagnostic Commands

```bash
# Check container status
docker compose -f compose.fleet.yml ps

# View container logs
docker compose -f compose.fleet.yml logs fleet-api
docker compose -f compose.fleet.yml logs caddy

# Test internal connectivity
docker compose -f compose.fleet.yml exec fleet-ui curl fleet-api:3015/healthz

# Check network configuration
docker network inspect vps_fleet-network

# Test external connectivity
curl -I https://app.headspamartina.hr/
curl -H "Authorization: Bearer $TOKEN" https://app.headspamartina.hr/api/fleet/layout
```

## Migration from Local Builds

### Previous Process (Deprecated)
```bash
# ❌ OLD: Local builds on VPS
docker compose build --no-cache
docker compose up -d
```

### Current Process (Recommended)
```bash
# ✅ NEW: Pull from registry
export FLEET_API_IMAGE=ghcr.io/org/fleet-api:main-{sha}
export FLEET_UI_IMAGE=ghcr.io/org/fleet-ui:main-{sha}
docker compose pull
docker compose up -d
```

### Benefits of Registry-Based Deployment
- **Consistency**: Same images across environments
- **Speed**: No compilation time on VPS
- **Reliability**: Pre-tested images from CI
- **Rollback**: Easy revert to previous versions
- **Audit**: Clear tracking of deployed versions