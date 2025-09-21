# Fleet API Production Cutover Kit - Full Stack Edition

Complete deployment package for full-stack group-intent architecture covering audio, video, camera, and Zigbee devices.

## 📦 Kit Contents

### Documentation
- **OPERATOR-GUIDE.md** - Quick reference for essential commands
- **PRODUCTION-CUTOVER-CHECKLIST.md** - Comprehensive 7-phase validation checklist

### Configuration Templates
- **api.env.production.example** - API environment variables with device tokens for all types
- **ui.env.production.example** - UI environment variables
- **docker-compose.production.yml** - Production container configuration

### Test Scripts
- **smoke-test.sh** - Full-stack API endpoint validation (executable)
- **acceptance-test.sh** - Original end-to-end workflow testing (executable)
- **acceptance-audio.sh** - Audio group-specific testing (executable)
- **acceptance-video.sh** - Video/display group testing (executable)
- **acceptance-camera.sh** - Camera group testing (executable)
- **acceptance-zigbee.sh** - Zigbee coordinator testing (executable)

## 🚀 Quick Deploy

1. **Generate secrets**:
   ```bash
   export API_BEARER=$(openssl rand -hex 32)
   export JWT_SECRET=$(openssl rand -hex 64)
   export SEED_ADMIN_PASSWORD=$(openssl rand -base64 24)
   ```

2. **Configure environments**:
   ```bash
   cp api.env.production.example ../api/.env
   cp ui.env.production.example ../ui/.env
   # Edit both files with generated secrets + device tokens
   ```

3. **Deploy**:
   ```bash
   cd ../vps && cp ../api/.env .env
   docker compose -f docker-compose.production.yml up -d
   ```

4. **Initialize**:
   ```bash
   docker compose exec fleet-api npm run migrate
   docker compose exec fleet-api npm run seed:yaml
   ```

5. **Validate**:
   ```bash
   # Run comprehensive smoke test for all device types
   ./smoke-test.sh http://localhost:3005 <API_BEARER_TOKEN>

   # Run role-specific acceptance tests
   ./acceptance-audio.sh http://localhost:3005 <API_BEARER_TOKEN>
   ./acceptance-video.sh http://localhost:3005 <API_BEARER_TOKEN>
   ./acceptance-camera.sh http://localhost:3005 <API_BEARER_TOKEN>
   ./acceptance-zigbee.sh http://localhost:3005 <API_BEARER_TOKEN>

   # Run original end-to-end test
   ./acceptance-test.sh http://localhost:3005 <API_BEARER_TOKEN>
   ```

## 🎯 Success Criteria

✅ All smoke tests pass for all device types
✅ All role-specific acceptance tests complete successfully
✅ Audio plays on Pi devices via group commands
✅ Video displays respond to power/input commands
✅ Cameras respond to reboot/probe commands
✅ Zigbee coordinator handles permit join/publish commands
✅ UI accessible with real-time device status updates for all types

## 🆘 Support

- Check logs: `docker compose logs fleet-api`
- Rollback: `docker compose down` + set `DEVICE_ADAPTER=mock`
- Scripts assume API at localhost:3005, UI at localhost:3006

---
*🤖 Generated for Fleet API group-intent architecture*