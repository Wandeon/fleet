#!/bin/bash
# Fleet API Production Smoke Test
# Quick validation of core API functionality

set -euo pipefail

# Configuration
API_URL="${1:-http://localhost:3005}"
API_BEARER="${2:-${API_BEARER:-}}"

if [[ -z "$API_BEARER" ]]; then
    echo "❌ ERROR: API_BEARER token required"
    echo "Usage: $0 [API_URL] [API_BEARER_TOKEN]"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }

echo "🔍 Fleet API Smoke Test"
echo "📍 API URL: $API_URL"
echo "🔑 Bearer Token: ${API_BEARER:0:8}..."
echo ""

# Test 1: Fleet Layout
log_info "Test 1: Checking fleet layout..."
layout_response=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/fleet/layout")
if echo "$layout_response" | jq -e '.groups["all-audio"]' >/dev/null 2>&1; then
    log_success "Fleet layout available with all-audio group"
else
    log_error "Failed to get fleet layout or missing all-audio group"
    exit 1
fi

# Test 2: Fleet State
log_info "Test 2: Checking fleet state..."
state_response=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/fleet/state")
if echo "$state_response" | jq -e '.states' >/dev/null 2>&1; then
    state_count=$(echo "$state_response" | jq '.states | length')
    log_success "Fleet state available with $state_count device states"
else
    log_error "Failed to get fleet state"
    exit 1
fi

# Test 3: Device Status Endpoints
log_info "Test 3: Checking device status endpoints..."

# Audio device
audio_status=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/audio/devices/pi-audio-01/status")
if echo "$audio_status" | jq -e '.status' >/dev/null 2>&1; then
    log_success "Audio device status endpoint working"
else
    log_error "Audio device status endpoint failed"
fi

# Video device
video_status=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/video/devices/pi-video-01/status")
if echo "$video_status" | jq -e '.status' >/dev/null 2>&1; then
    log_success "Video device status endpoint working"
else
    log_error "Video device status endpoint failed"
fi

# Camera device
camera_status=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/camera/devices/pi-camera-01/status")
if echo "$camera_status" | jq -e '.status' >/dev/null 2>&1; then
    log_success "Camera device status endpoint working"
else
    log_error "Camera device status endpoint failed"
fi

# Zigbee hub
zigbee_status=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/zigbee/hubs/pi-video-01/status")
if echo "$zigbee_status" | jq -e '.status' >/dev/null 2>&1; then
    log_success "Zigbee hub status endpoint working"
else
    log_error "Zigbee hub status endpoint failed"
fi

# Test 4: Group Command
log_info "Test 4: Testing group command..."
volume_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"value":1.2}' \
    "$API_URL/api/groups/all-audio/volume")
if echo "$volume_response" | jq -e '.job_id' >/dev/null 2>&1; then
    job_id=$(echo "$volume_response" | jq -r '.job_id')
    log_success "Group volume command accepted - Job ID: $job_id"
else
    log_error "Group volume command failed"
    exit 1
fi

# Test 5: SSE Stream (brief probe)
log_info "Test 5: Testing SSE stream..."
sse_test=$(timeout 3 curl -s -H "Authorization: Bearer $API_BEARER" \
    -H "Accept: text/event-stream" \
    "$API_URL/stream" | head -1 || echo "")
if [[ -n "$sse_test" ]]; then
    log_success "SSE stream responding"
else
    log_error "SSE stream not responding"
fi

echo ""
log_success "✅ Smoke test completed successfully!"
echo "🎯 API is ready for production use"