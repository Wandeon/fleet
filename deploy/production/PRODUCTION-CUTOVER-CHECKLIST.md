# Fleet API Production Cutover Checklist

**Objective**: Validate complete group-intent architecture with real Pi devices

## Prerequisites

- [ ] All Pi devices are online and accessible at their configured IPs
- [ ] Device tokens are configured on each Pi device
- [ ] VPS has Docker and Docker Compose installed
- [ ] SSL certificates are configured (if using HTTPS)
- [ ] `/var/lib/fleet/audio-library` directory exists with proper permissions

## Phase 1: Environment Setup

### 1.1 Environment Configuration
- [ ] Copy and configure production environment files:
  ```bash
  cd /home/admin/fleet/api
  cp .env.production.example .env
  # Edit .env with actual tokens and secrets

  cd /home/admin/fleet/ui
  cp .env.production.example .env
  # Edit .env with API_BEARER token
  ```

- [ ] Generate secure tokens:
  ```bash
  # Generate API bearer token (32 chars)
  openssl rand -hex 32

  # Generate JWT secret (64 chars)
  openssl rand -hex 64

  # Generate admin password (24 chars)
  openssl rand -base64 24
  ```

- [ ] Configure device-specific tokens in `.env`:
  - `AUDIO_PI_AUDIO_01_TOKEN=<device-token>`
  - `AUDIO_PI_AUDIO_02_TOKEN=<device-token>`
  - `HDMI_PI_VIDEO_01_TOKEN=<device-token>`
  - `CAMERA_PI_CAMERA_01_TOKEN=<device-token>`

### 1.2 Storage Setup
- [ ] Create audio library directory:
  ```bash
  sudo mkdir -p /var/lib/fleet/audio-library
  sudo chown $USER:$USER /var/lib/fleet/audio-library
  ```

## Phase 2: Container Deployment

### 2.1 Build and Start Services
- [ ] Deploy containers:
  ```bash
  cd /home/admin/fleet/vps
  cp ../api/.env .env
  docker compose -f docker-compose.production.yml up -d
  ```

- [ ] Verify containers are running:
  ```bash
  docker compose -f docker-compose.production.yml ps
  docker compose -f docker-compose.production.yml logs fleet-api
  docker compose -f docker-compose.production.yml logs fleet-ui
  ```

### 2.2 Database Initialization
- [ ] Run database migrations:
  ```bash
  docker compose -f docker-compose.production.yml exec fleet-api npm run migrate
  ```

- [ ] Seed database with device configuration:
  ```bash
  docker compose -f docker-compose.production.yml exec fleet-api npm run seed:yaml
  ```

- [ ] Verify database seeding succeeded:
  ```bash
  docker compose -f docker-compose.production.yml exec fleet-api npm run db:studio
  # Check that devices, groups, and admin user exist
  ```

## Phase 3: API Validation

### 3.1 Smoke Tests
- [ ] Run comprehensive API smoke tests:
  ```bash
  cd /home/admin/fleet/api
  chmod +x scripts/smoke-test.sh
  ./scripts/smoke-test.sh http://localhost:3005 <API_BEARER_TOKEN>
  ```

- [ ] Verify all tests pass (0 failures expected)

### 3.2 Device Connectivity Tests
- [ ] Test individual device status endpoints:
  ```bash
  # Test pi-audio-01 connectivity
  curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
    http://localhost:3005/api/audio/devices/pi-audio-01/status

  # Test pi-audio-02 connectivity
  curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
    http://localhost:3005/api/audio/devices/pi-audio-02/status
  ```

- [ ] Verify device responses include status.playing and status.volume fields
- [ ] Confirm DEVICE_ADAPTER is set to 'http' (not 'mock')

## Phase 4: End-to-End Validation

### 4.1 Full Workflow Test
- [ ] Run complete acceptance test:
  ```bash
  cd /home/admin/fleet/api
  chmod +x scripts/acceptance-test.sh
  ./scripts/acceptance-test.sh http://localhost:3005 <API_BEARER_TOKEN>
  ```

- [ ] Verify test workflow completes:
  - ✓ File upload to library
  - ✓ Group play command to all-audio
  - ✓ Volume adjustment to 150%
  - ✓ Device status verification
  - ✓ Pause command (partial success expected)
  - ✓ Stop command
  - ✓ File cleanup
  - ✓ SSE connectivity

### 4.2 Manual Validation
- [ ] Upload test audio file via API:
  ```bash
  curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
    -F "file=@test.mp3" \
    http://localhost:3005/api/library/upload
  ```

- [ ] Verify file appears in library:
  ```bash
  curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
    http://localhost:3005/api/library/files
  ```

- [ ] Test group playback with real devices:
  ```bash
  # Play on all-audio group
  curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"fileId":"<FILE_ID>"}' \
    http://localhost:3005/api/groups/all-audio/play
  ```

- [ ] Confirm audio plays on both pi-audio-01 and pi-audio-02
- [ ] Test volume control affects both devices
- [ ] Verify pause works on pi-audio-01 but fails on pi-audio-02 (expected)
- [ ] Confirm stop command works on both devices

## Phase 5: UI Validation

### 5.1 Frontend Access
- [ ] Access UI at http://localhost:3006
- [ ] Verify login page appears
- [ ] Login with admin credentials (username: admin, password: from SEED_ADMIN_PASSWORD)
- [ ] Confirm dashboard loads with device statuses

### 5.2 UI Functionality
- [ ] Verify fleet layout shows all-audio group with 2 members
- [ ] Test file upload through UI
- [ ] Verify uploaded files appear in library
- [ ] Test group playback controls from UI
- [ ] Confirm real-time status updates via SSE
- [ ] Test individual device status monitoring

## Phase 6: Production Readiness

### 6.1 Security Validation
- [ ] Verify unauthorized requests return 401:
  ```bash
  curl -w "%{http_code}" http://localhost:3005/api/fleet/layout
  # Should return 401
  ```

- [ ] Confirm API_BEARER token is properly secured (not logged)
- [ ] Verify device tokens are working for authentication

### 6.2 Performance Check
- [ ] Monitor container resource usage:
  ```bash
  docker stats fleet-api fleet-ui
  ```

- [ ] Test concurrent group commands
- [ ] Verify SSE stream handles multiple concurrent clients
- [ ] Check audio library file upload/download performance

### 6.3 Monitoring Setup
- [ ] Verify Prometheus metrics endpoint:
  ```bash
  curl http://localhost:3005/metrics
  ```

- [ ] Confirm health checks are passing:
  ```bash
  curl http://localhost:3005/metrics  # API health
  curl http://localhost:3006          # UI health
  ```

## Phase 7: Cleanup

### 7.1 Remove Seed Configuration
- [ ] Remove SEED_ADMIN_PASSWORD from .env after successful deployment
- [ ] Restart API container to apply configuration change

### 7.2 Backup Validation
- [ ] Verify database and audio library are properly persisted
- [ ] Test container restart doesn't lose data:
  ```bash
  docker compose -f docker-compose.production.yml restart fleet-api
  # Verify data persists after restart
  ```

## Success Criteria

✅ **All systems operational** when:
- All smoke tests pass (0 failures)
- Acceptance test completes successfully
- Real audio playback works on Pi devices
- Group commands execute with expected partial success patterns
- UI displays real-time device status updates
- File uploads and library management function correctly
- SSE events stream properly to connected clients
- All endpoints require proper authentication

## Rollback Plan

If validation fails:
1. Stop containers: `docker compose -f docker-compose.production.yml down`
2. Check logs: `docker compose -f docker-compose.production.yml logs`
3. Verify environment configuration
4. Test individual device connectivity outside of Fleet API
5. Return to mock mode for debugging: `DEVICE_ADAPTER=mock`

## Post-Deployment

- [ ] Monitor logs for first 24 hours
- [ ] Set up log rotation and monitoring alerts
- [ ] Document any device-specific quirks discovered
- [ ] Update device configuration if needed
- [ ] Schedule regular acceptance test runs