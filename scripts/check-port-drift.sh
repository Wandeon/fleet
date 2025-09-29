#!/bin/bash
set -e

echo "🔍 Checking for Caddy ↔ Compose port drift..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

COMPOSE_FILE="infra/vps/compose.fleet.yml"
CADDY_FILE="infra/vps/caddy.fleet.Caddyfile"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Compose file not found: $COMPOSE_FILE"
    exit 1
fi

if [ ! -f "$CADDY_FILE" ]; then
    echo "❌ Caddy file not found: $CADDY_FILE"
    exit 1
fi

echo "📋 Parsing container ports from $COMPOSE_FILE..."

# Extract ports from docker-compose file
API_PORT=$(grep -A 10 "fleet-api:" "$COMPOSE_FILE" | grep -E "^\s*-\s*['\"]?[0-9]+:[0-9]+['\"]?" | head -1 | sed 's/.*:\([0-9]\+\).*/\1/')
UI_PORT=$(grep -A 10 "fleet-ui:" "$COMPOSE_FILE" | grep -E "environment:" -A 20 | grep "PORT=" | sed 's/.*PORT=\([0-9]\+\).*/\1/')

if [ -z "$API_PORT" ]; then
    echo "❌ Could not determine API port from compose file"
    exit 1
fi

if [ -z "$UI_PORT" ]; then
    echo "⚠️  Could not determine UI port from compose environment, checking ports section..."
    UI_PORT=$(grep -A 10 "fleet-ui:" "$COMPOSE_FILE" | grep -E "^\s*-\s*['\"]?[0-9]+:[0-9]+['\"]?" | head -1 | sed 's/.*:\([0-9]\+\).*/\1/')
    if [ -z "$UI_PORT" ]; then
        echo "❌ Could not determine UI port from compose file"
        exit 1
    fi
fi

echo "🐳 Compose file ports:"
echo "  API: $API_PORT"
echo "  UI: $UI_PORT"

echo "📋 Parsing upstream ports from $CADDY_FILE..."

# Extract upstream ports from Caddyfile
CADDY_API_PORT=$(grep "reverse_proxy fleet-api:" "$CADDY_FILE" | head -1 | sed 's/.*fleet-api:\([0-9]\+\).*/\1/')
CADDY_UI_PORT=$(grep "reverse_proxy fleet-ui:" "$CADDY_FILE" | head -1 | sed 's/.*fleet-ui:\([0-9]\+\).*/\1/')

if [ -z "$CADDY_API_PORT" ]; then
    echo "❌ Could not determine API upstream port from Caddy file"
    exit 1
fi

if [ -z "$CADDY_UI_PORT" ]; then
    echo "❌ Could not determine UI upstream port from Caddy file"
    exit 1
fi

echo "🌐 Caddy upstream ports:"
echo "  API: $CADDY_API_PORT"
echo "  UI: $CADDY_UI_PORT"

# Check for drift
DRIFT_DETECTED=false

if [ "$API_PORT" != "$CADDY_API_PORT" ]; then
    echo ""
    echo "❌ API PORT DRIFT DETECTED!"
    echo "  Compose: fleet-api runs on port $API_PORT"
    echo "  Caddy: proxies to fleet-api:$CADDY_API_PORT"
    DRIFT_DETECTED=true
fi

if [ "$UI_PORT" != "$CADDY_UI_PORT" ]; then
    echo ""
    echo "❌ UI PORT DRIFT DETECTED!"
    echo "  Compose: fleet-ui runs on port $UI_PORT"
    echo "  Caddy: proxies to fleet-ui:$CADDY_UI_PORT"
    DRIFT_DETECTED=true
fi

if [ "$DRIFT_DETECTED" = true ]; then
    echo ""
    echo "🔧 To fix port drift:"
    echo "1. Check the expected ports in docs/02-deployment-and-networks.md"
    echo "2. Update either the compose file or Caddy configuration"
    echo "3. Ensure consistency between:"
    echo "   - Container ports in $COMPOSE_FILE"
    echo "   - Upstream targets in $CADDY_FILE"
    echo ""
    echo "Expected configuration:"
    echo "  API should run on port 3015 internally"
    echo "  UI should run on port 3000 internally"
    echo ""
    exit 1
fi

echo ""
echo "✅ No port drift detected - Caddy and Compose configurations are in sync"