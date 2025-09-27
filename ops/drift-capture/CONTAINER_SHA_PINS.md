# Container SHA Pinning for Rollback Safety
**Date:** 2025-09-27
**Purpose:** Document current production container SHAs for safe rollback

## Current Production Container State

### Fleet API Service
- **Container:** vps-fleet-api-1
- **Image:** ghcr.io/org/fleet-api:latest
- **SHA:** sha256:35423d66b9797d55f5dd17903bc7825376ac1b13e16c45dae004935c2983ae58
- **Status:** Up 57 minutes (healthy)

### Fleet UI Service
- **Container:** vps-fleet-ui-1
- **Image:** ghcr.io/org/fleet-ui:latest
- **SHA:** sha256:4ffd142ec45d520e2675af6903bfcfeb9222744ea9a4776eb7a57f5f1b5b6b12
- **Status:** Up 57 minutes

### Fleet Worker Service
- **Container:** vps-fleet-worker-1
- **Image:** ghcr.io/org/fleet-api:latest
- **SHA:** sha256:35423d66b9797d55f5dd17903bc7825376ac1b13e16c45dae004935c2983ae58
- **Status:** Up 57 minutes

### Caddy Proxy
- **Container:** vps-caddy-1
- **Image:** caddy:2
- **SHA:** sha256:87aa104ed6c658991e1b0672be271206b7cd9fec452d1bf3ed9ad6f8ab7a2348
- **Status:** Up 57 minutes

## Rollback Commands (Emergency Use)

If deployment from repository fails, these commands will restore current working state:

```bash
# Restore fleet-api
docker pull ghcr.io/org/fleet-api@sha256:35423d66b9797d55f5dd17903bc7825376ac1b13e16c45dae004935c2983ae58

# Restore fleet-ui
docker pull ghcr.io/org/fleet-ui@sha256:4ffd142ec45d520e2675af6903bfcfeb9222744ea9a4776eb7a57f5f1b5b6b12

# Restore caddy
docker pull caddy@sha256:87aa104ed6c658991e1b0672be271206b7cd9fec452d1bf3ed9ad6f8ab7a2348

# Redeploy with current images
cd /opt/fleet/baseline && docker compose up -d
```

## Production Verification Status

- ✅ Fleet API endpoints responding (camera/overview, camera/active)
- ✅ Fleet UI loading correctly with defensive coding fixes
- ✅ All containers healthy
- ✅ No 5XX errors observed

## Safety Net Confirmed

Current production state is stable and verified working. Safe to proceed with repository-based redeploy knowing we can rollback to these exact SHAs if needed.