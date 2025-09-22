# Fleet Production Operator Guide

## Prerequisites

- Docker and Docker Compose installed
- Network access to Pi devices
- Device authentication tokens from network administrator

## Step 1: Environment Configuration

```bash
# Copy environment templates
cp api.env.production.example .env
cp ui.env.production.example .env.ui

# Generate secure tokens
export API_BEARER=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 64)
export SEED_ADMIN_PASSWORD=$(openssl rand -base64 24)

# Update .env file with generated values and device tokens
```

## Step 2: Storage Setup

```bash
# Create required directories
sudo mkdir -p /var/lib/fleet/audio-library
sudo mkdir -p /var/lib/fleet/video-data
sudo mkdir -p /var/lib/fleet/camera-data
sudo mkdir -p /var/lib/fleet/zigbee-data

# Set permissions (adjust user:group as needed)
sudo chown -R 1000:1000 /var/lib/fleet/
```

## Step 3: Deploy Services

```bash
# Start services
docker compose -f docker-compose.production.yml up -d

# Check logs
docker compose -f docker-compose.production.yml logs -f
```

## Step 4: Validation

```bash
# Quick smoke test
./smoke-test.sh http://localhost:3005 $API_BEARER

# Full acceptance test
./acceptance-test.sh http://localhost:3005 $API_BEARER
```

## Step 5: First-Time Setup

After successful deployment:

1. Remove `SEED_ADMIN_PASSWORD` from `.env` file
2. Access web interface and change admin password
3. Configure device-specific settings via UI

## Troubleshooting

**API won't start**: Check device tokens and database permissions
**No audio upload**: Ensure multer dependency is installed
**Group commands fail**: Verify device network connectivity
**SSE not working**: Check firewall and proxy configuration

## Monitoring

Prometheus targets are automatically configured in `/var/lib/fleet/prometheus-targets/`