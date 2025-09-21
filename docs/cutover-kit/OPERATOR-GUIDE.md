# Fleet API Production Cutover - Operator Quick Reference

**🎯 Objective**: Deploy group-intent architecture with real Pi audio devices

## ⚡ Quick Start Commands

### 1. Generate Secrets
```bash
# Run these commands and save outputs for .env files
export API_BEARER=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 64)
export SEED_ADMIN_PASSWORD=$(openssl rand -base64 24)

echo "API_BEARER=$API_BEARER"
echo "JWT_SECRET=$JWT_SECRET"
echo "SEED_ADMIN_PASSWORD=$SEED_ADMIN_PASSWORD"
```

### 2. Setup Environment
```bash
cd /home/admin/fleet/api
cp .env.production.example .env
# Edit .env with generated tokens above + device tokens

cd /home/admin/fleet/ui
cp .env.production.example .env
# Set PUBLIC_API_BEARER to same value as API_BEARER

sudo mkdir -p /var/lib/fleet/audio-library
sudo chown $USER:$USER /var/lib/fleet/audio-library
```

### 3. Deploy
```bash
cd /home/admin/fleet/vps
cp ../api/.env .env
docker compose -f docker-compose.production.yml up -d
```

### 4. Initialize Database
```bash
docker compose -f docker-compose.production.yml exec fleet-api npm run migrate
docker compose -f docker-compose.production.yml exec fleet-api npm run seed:yaml
```

### 5. Validate
```bash
cd /home/admin/fleet/api
./scripts/smoke-test.sh http://localhost:3005 <API_BEARER_TOKEN>
./scripts/acceptance-test.sh http://localhost:3005 <API_BEARER_TOKEN>
```

## 🔥 Essential API Tests

### Health Check
```bash
curl http://localhost:3005/metrics
```

### Auth Test
```bash
# Should return 401
curl -w "%{http_code}" http://localhost:3005/api/fleet/layout

# Should return 200 with fleet data
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  http://localhost:3005/api/fleet/layout
```

### Device Status
```bash
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  http://localhost:3005/api/audio/devices/pi-audio-01/status
```

### Group Commands
```bash
# Upload file
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  -F "file=@test.mp3" \
  http://localhost:3005/api/library/upload

# Play on all audio devices
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fileId":"<FILE_ID>"}' \
  http://localhost:3005/api/groups/all-audio/play

# Volume control
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"value":1.5}' \
  http://localhost:3005/api/groups/all-audio/volume

# Stop playback
curl -H "Authorization: Bearer <API_BEARER_TOKEN>" \
  http://localhost:3005/api/groups/all-audio/stop
```

## 🚨 Critical Requirements

- **DEVICE_ADAPTER=http** (NOT mock) in api/.env
- **Device tokens** must match Pi device configuration
- **API_BEARER** must be identical in api/.env and ui/.env
- **/var/lib/fleet/audio-library** must exist with write permissions
- **All scripts** in api/scripts/ must be executable

## ✅ Success Indicators

- [ ] All smoke tests pass (0 failures)
- [ ] Acceptance test completes end-to-end
- [ ] Real audio plays on Pi devices when using group commands
- [ ] UI loads at http://localhost:3006 with admin login
- [ ] SSE events stream properly (real-time status updates)

## 🆘 Emergency Rollback

```bash
# Stop all containers
docker compose -f docker-compose.production.yml down

# Check logs for errors
docker compose -f docker-compose.production.yml logs

# Return to mock mode for debugging
echo "DEVICE_ADAPTER=mock" >> ../api/.env
```

## 📱 UI Access

- **URL**: http://localhost:3006
- **Username**: admin
- **Password**: (value from SEED_ADMIN_PASSWORD)

## 🔧 Troubleshooting

**Container won't start**: Check .env file syntax and required tokens
**401 errors**: Verify API_BEARER token matches between API and UI
**Device unreachable**: Confirm Pi devices are online and tokens match
**File upload fails**: Check /var/lib/fleet/audio-library permissions

---
*🤖 Generated for Fleet API group-intent architecture cutover*