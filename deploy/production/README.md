# Fleet Production Deployment

This directory contains everything needed to deploy Fleet in production.

## Quick Start

1. **Configure Environment**
   ```bash
   cp api.env.production.example .env
   cp ui.env.production.example .env.ui
   # Edit .env files with actual values
   ```

2. **Deploy Services**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

3. **Validate Deployment**
   ```bash
   ./smoke-test.sh http://localhost:3005 your-api-bearer-token
   ./acceptance-test.sh http://localhost:3005 your-api-bearer-token
   ```

## Files

- `docker-compose.production.yml` - Production Docker Compose with volumes
- `api.env.production.example` - API environment template
- `ui.env.production.example` - UI environment template
- `smoke-test.sh` - Quick validation script
- `acceptance-test.sh` - Full end-to-end test suite
- `OPERATOR-GUIDE.md` - Detailed deployment guide
- `PRODUCTION-CUTOVER-CHECKLIST.md` - Pre-deployment checklist
- `prometheus/` - Monitoring target configurations

## Key Requirements

- **Device Tokens**: Must be configured for each Pi device
- **Bearer Tokens**: Generate secure values for API_BEARER and JWT_SECRET
- **Volume Mounts**: Ensure `/var/lib/fleet/audio-library` exists with proper permissions
- **Multer Dependency**: Required for library upload functionality

## Support

See `OPERATOR-GUIDE.md` for detailed instructions and troubleshooting.