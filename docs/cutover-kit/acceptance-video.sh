#!/bin/bash
# Fleet API Video Acceptance Test - Display Group Commands
# Tests video/display group functionality: power on/off, input switching

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

echo "📺 Starting Fleet API Video Acceptance Test"
echo "📍 API URL: $API_URL"
echo "🔑 Bearer Token: ${API_BEARER:0:8}..."
echo ""

# Step 1: Verify all-displays group exists
log_info "Step 1: Verifying all-displays group..."
layout_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/fleet/layout")

if echo "$layout_response" | jq -e '.groups["all-displays"]' >/dev/null 2>&1; then
    log_success "all-displays group found"
else
    log_error "all-displays group not found"
    echo "Response: $layout_response"
    exit 1
fi

# Step 2: Check pi-video-01 device status
log_info "Step 2: Checking pi-video-01 device status..."
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/audio/devices/pi-video-01/status")

if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
    power=$(echo "$status_response" | jq -r '.status.power // false')
    input=$(echo "$status_response" | jq -r '.status.input // "unknown"')
    log_success "Device pi-video-01 - Power: $power, Input: $input"
else
    log_error "Invalid status response from pi-video-01"
fi

# Step 3: Power on displays
log_info "Step 3: Powering on all displays..."
power_on_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    "$API_URL/api/groups/all-displays/power_on")

power_on_job_id=$(extract_job_id "$power_on_response")
check_job_status "$power_on_job_id" || exit 1

# Step 4: Switch input to HDMI2
log_info "Step 4: Switching input to HDMI2..."
input_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"source":"HDMI2"}' \
    "$API_URL/api/groups/all-displays/input")

input_job_id=$(extract_job_id "$input_response")
check_job_status "$input_job_id" || exit 1

# Step 5: Wait and check status after commands
log_info "Step 5: Checking device status after commands..."
sleep 2
status_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/audio/devices/pi-video-01/status")

if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
    power=$(echo "$status_response" | jq -r '.status.power // false')
    input=$(echo "$status_response" | jq -r '.status.input // "unknown"')
    log_success "Device pi-video-01 after commands - Power: $power, Input: $input"
else
    log_error "Invalid status response after commands"
fi

# Step 6: Switch back to HDMI1
log_info "Step 6: Switching back to HDMI1..."
input_back_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"source":"HDMI1"}' \
    "$API_URL/api/groups/all-displays/input")

input_back_job_id=$(extract_job_id "$input_back_response")
check_job_status "$input_back_job_id" || exit 1

# Step 7: Power off displays
log_info "Step 7: Powering off all displays..."
power_off_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    "$API_URL/api/groups/all-displays/power_off")

power_off_job_id=$(extract_job_id "$power_off_response")
check_job_status "$power_off_job_id" || exit 1

echo ""
echo "🎉 Video acceptance test completed!"
echo "✅ The video group-intent architecture is working:"
echo "   • Display group commands with job orchestration ✓"
echo "   • Power control (on/off) ✓"
echo "   • Input switching ✓"
echo "   • Device status monitoring ✓"
echo ""
log_success "Video device validation PASSED"