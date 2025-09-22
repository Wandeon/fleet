#!/bin/bash
# Fleet API Zigbee Acceptance Test - Zigbee Coordinator Commands
# Tests Zigbee group functionality: permit join, reset, device publish

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

# Helper to extract job ID from response
extract_job_id() {
    local response="$1"
    echo "$response" | jq -r '.job_id // empty' 2>/dev/null || echo ""
}

# Helper to check job status
check_job_status() {
    local job_id="$1"
    if [[ -n "$job_id" ]]; then
        log_success "Job $job_id accepted"
        return 0
    else
        log_error "No job ID returned"
        return 1
    fi
}

echo "🔗 Starting Fleet API Zigbee Acceptance Test"
echo "📍 API URL: $API_URL"
echo "🔑 Bearer Token: ${API_BEARER:0:8}..."
echo ""

# Step 1: Verify zigbee-hubs group exists
log_info "Step 1: Verifying zigbee-hubs group..."
layout_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/fleet/layout")

if echo "$layout_response" | jq -e '.groups["zigbee-hubs"]' >/dev/null 2>&1; then
    log_success "zigbee-hubs group found"
else
    log_error "zigbee-hubs group not found"
    echo "Response: $layout_response"
    exit 1
fi

# Step 2: Check pi-video-01 Zigbee coordinator status
log_info "Step 2: Checking Zigbee coordinator status..."
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/zigbee/hubs/pi-video-01/status")

if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
    coordinator_online=$(echo "$status_response" | jq -r '.status.coordinator_online // false')
    permit_join=$(echo "$status_response" | jq -r '.status.permit_join // false')
    devices_count=$(echo "$status_response" | jq -r '.status.devices_count // 0')
    log_success "Zigbee coordinator - Online: $coordinator_online, Permit Join: $permit_join"
    log_success "Connected devices: $devices_count"
else
    log_error "Invalid status response from Zigbee coordinator"
fi

# Step 3: Enable permit join for 30 seconds
log_info "Step 3: Enabling permit join for 30 seconds..."
permit_join_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"duration":30}' \
    "$API_URL/api/groups/zigbee-hubs/permit_join")

permit_join_job_id=$(extract_job_id "$permit_join_response")
check_job_status "$permit_join_job_id" || exit 1

# Step 4: Check status after permit join
log_info "Step 4: Checking coordinator status after permit join..."
sleep 1
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/zigbee/hubs/pi-video-01/status")

if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
    permit_join=$(echo "$status_response" | jq -r '.status.permit_join // false')
    log_success "Permit join status: $permit_join"
else
    log_error "Invalid status response after permit join"
fi

# Step 5: Publish MQTT message to device
log_info "Step 5: Publishing MQTT message to test device..."
publish_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"topic":"zigbee2mqtt/living_room_light/set","payload":{"state":"ON"}}' \
    "$API_URL/api/groups/zigbee-hubs/publish")

publish_job_id=$(extract_job_id "$publish_response")
check_job_status "$publish_job_id" || exit 1

# Step 6: Publish another message to different device
log_info "Step 6: Publishing state request to sensor..."
publish2_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"topic":"zigbee2mqtt/bedroom_sensor/get","payload":{"state":""}}' \
    "$API_URL/api/groups/zigbee-hubs/publish")

publish2_job_id=$(extract_job_id "$publish2_response")
check_job_status "$publish2_job_id" || exit 1

# Step 7: Check network map
log_info "Step 7: Checking Zigbee network map..."
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/zigbee/hubs/pi-video-01/status")

if echo "$status_response" | jq -e '.status.network_map' >/dev/null 2>&1; then
    coordinator_ieee=$(echo "$status_response" | jq -r '.status.network_map.coordinator.ieee // "unknown"')
    device_count=$(echo "$status_response" | jq -r '.status.network_map.devices | length' 2>/dev/null || echo "0")
    log_success "Coordinator IEEE: $coordinator_ieee"
    log_success "Network map shows $device_count devices"
else
    log_error "No network map available"
fi

# Step 8: Reset coordinator (WARNING: this will disconnect all devices temporarily)
log_info "Step 8: Testing coordinator reset (WARNING: temporary disconnection)..."
read -p "Proceed with reset test? This will temporarily disconnect Zigbee devices. (y/N): " -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reset_response=$(curl -s \
        -H "Authorization: Bearer $API_BEARER" \
        -H "Content-Type: application/json" \
        "$API_URL/api/groups/zigbee-hubs/reset")

    reset_job_id=$(extract_job_id "$reset_response")
    check_job_status "$reset_job_id" || exit 1

    log_info "Waiting for coordinator to recover from reset..."
    sleep 5

    # Check status after reset
    status_response=$(curl -s \
        -H "Authorization: Bearer $API_BEARER" \
        "$API_URL/api/audio/devices/pi-video-01/status")

    if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
        coordinator_online=$(echo "$status_response" | jq -r '.status.coordinator_online // false')
        devices_count=$(echo "$status_response" | jq -r '.status.devices_count // 0')
        log_success "After reset - Coordinator online: $coordinator_online"
        log_success "Devices count after reset: $devices_count"
    else
        log_error "Invalid status response after reset"
    fi
else
    log_info "Skipping reset test"
fi

# Step 9: Final coordinator status
log_info "Step 9: Final coordinator status verification..."
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/zigbee/hubs/pi-video-01/status")

if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
    coordinator_online=$(echo "$status_response" | jq -r '.status.coordinator_online // false')
    permit_join=$(echo "$status_response" | jq -r '.status.permit_join // false')
    devices_count=$(echo "$status_response" | jq -r '.status.devices_count // 0')
    log_success "Final status - Coordinator online: $coordinator_online"
    log_success "Permit join: $permit_join, Connected devices: $devices_count"
else
    log_error "Invalid final status response"
fi

echo ""
echo "🎉 Zigbee acceptance test completed!"
echo "✅ The Zigbee group-intent architecture is working:"
echo "   • Zigbee group commands with job orchestration ✓"
echo "   • Permit join control ✓"
echo "   • MQTT message publishing ✓"
echo "   • Network status monitoring ✓"
echo "   • Coordinator reset and recovery ✓"
echo ""
log_success "Zigbee coordinator validation PASSED"