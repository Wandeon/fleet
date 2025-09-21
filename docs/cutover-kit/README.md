# Fleet API Production Cutover Kit

Complete deployment package for transitioning from mock to real Pi device control.

## 📦 Kit Contents

### Documentation
- **OPERATOR-GUIDE.md** - Quick reference for essential commands
- **PRODUCTION-CUTOVER-CHECKLIST.md** - Comprehensive 7-phase validation checklist

### Configuration Templates
- **api.env.production.example** - API environment variables with detailed comments
- **ui.env.production.example** - UI environment variables
- **docker-compose.production.yml** - Production container configuration

### Test Scripts
- **smoke-test.sh** - API endpoint validation (executable)
- **acceptance-test.sh** - End-to-end workflow testing (executable)

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
   ./smoke-test.sh http://localhost:3005 <API_BEARER_TOKEN>
   ./acceptance-test.sh http://localhost:3005 <API_BEARER_TOKEN>
   ```

## 🎯 Success Criteria

✅ All smoke tests pass
✅ Acceptance test completes end-to-end
✅ Real audio plays on Pi devices via group commands
✅ UI accessible with real-time device status updates

## 🆘 Support

- Check logs: `docker compose logs fleet-api`
- Rollback: `docker compose down` + set `DEVICE_ADAPTER=mock`
- Scripts assume API at localhost:3005, UI at localhost:3006

---
*🤖 Generated for Fleet API group-intent architecture*