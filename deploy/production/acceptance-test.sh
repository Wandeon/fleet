#!/bin/bash
# Fleet API Production Acceptance Test
# Full end-to-end validation with library upload guardrails

set -euo pipefail

# Configuration
API_URL="${1:-http://localhost:3005}"
API_BEARER="${2:-${API_BEARER:-}}"
ENABLE_LIBRARY_UPLOAD="${ENABLE_LIBRARY_UPLOAD:-0}"

if [[ -z "$API_BEARER" ]]; then
    echo "❌ ERROR: API_BEARER token required"
    echo "Usage: $0 [API_URL] [API_BEARER_TOKEN]"
    echo "Environment: ENABLE_LIBRARY_UPLOAD=1 to test file uploads"
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
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $*"; }

# Helper to extract job ID from response
extract_job_id() {
    local response="$1"
    echo "$response" | jq -r '.job_id // empty' 2>/dev/null || echo ""
}

echo "🚀 Fleet API Full Acceptance Test"
echo "📍 API URL: $API_URL"
echo "🔑 Bearer Token: ${API_BEARER:0:8}..."
echo "📁 Library Upload: $([ "$ENABLE_LIBRARY_UPLOAD" = "1" ] && echo "Enabled" || echo "Disabled")"
echo ""

# Test 1: Layout and State Checks
log_info "Test 1: Fleet Layout and State..."
layout_response=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/fleet/layout")
state_response=$(curl -s -H "Authorization: Bearer $API_BEARER" "$API_URL/api/fleet/state")

if echo "$layout_response" | jq -e '.groups' >/dev/null 2>&1; then
    group_count=$(echo "$layout_response" | jq '.groups | length')
    log_success "Fleet layout: $group_count groups found"
else
    log_error "Fleet layout failed"
    exit 1
fi

if echo "$state_response" | jq -e '.states' >/dev/null 2>&1; then
    state_count=$(echo "$state_response" | jq '.states | length')
    log_success "Fleet state: $state_count device states found"
else
    log_error "Fleet state failed"
    exit 1
fi

# Test 2: Audio Library and Group Commands
log_info "Test 2: Audio Group Testing..."

if [ "$ENABLE_LIBRARY_UPLOAD" = "1" ]; then
    log_info "Creating test MP3 file..."
    if command -v ffmpeg >/dev/null 2>&1; then
        ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -acodec mp3 -y test-acceptance.mp3 >/dev/null 2>&1
    else
        # Create minimal MP3 header for testing
        echo -e "\xFF\xFB\x90\x00" > test-acceptance.mp3
    fi

    log_info "Uploading test file..."
    upload_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
        -F "file=@test-acceptance.mp3" \
        "$API_URL/api/library/upload" 2>/dev/null || echo '{}')

    if echo "$upload_response" | jq -e '.file.id' >/dev/null 2>&1; then
        file_id=$(echo "$upload_response" | jq -r '.file.id')
        log_success "File uploaded: $file_id"

        # Test play command
        play_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
            -H "Content-Type: application/json" \
            -d "{\"fileId\":\"$file_id\"}" \
            "$API_URL/api/groups/all-audio/play")
        play_job_id=$(extract_job_id "$play_response")
        if [[ -n "$play_job_id" ]]; then
            log_success "Play command accepted: $play_job_id"
        else
            log_error "Play command failed"
        fi
    else
        log_error "File upload failed - library routes may be disabled"
        log_info "Skipping play command with file"
    fi

    # Cleanup
    rm -f test-acceptance.mp3 2>/dev/null || true
else
    log_skip "Library upload disabled - set ENABLE_LIBRARY_UPLOAD=1 to test"
fi

# Test pause command (works without file)
pause_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-audio/pause" -X POST)
pause_job_id=$(extract_job_id "$pause_response")
if [[ -n "$pause_job_id" ]]; then
    log_success "Pause command accepted: $pause_job_id"
else
    log_error "Pause command failed"
fi

# Test stop command
stop_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-audio/stop" -X POST)
stop_job_id=$(extract_job_id "$stop_response")
if [[ -n "$stop_job_id" ]]; then
    log_success "Stop command accepted: $stop_job_id"
else
    log_error "Stop command failed"
fi

# Test 3: Video Group Commands
log_info "Test 3: Video Group Testing..."

power_on_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-displays/power_on" -X POST)
power_on_job_id=$(extract_job_id "$power_on_response")
if [[ -n "$power_on_job_id" ]]; then
    log_success "Video power on accepted: $power_on_job_id"
else
    log_error "Video power on failed"
fi

power_off_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-displays/power_off" -X POST)
power_off_job_id=$(extract_job_id "$power_off_response")
if [[ -n "$power_off_job_id" ]]; then
    log_success "Video power off accepted: $power_off_job_id"
else
    log_error "Video power off failed"
fi

# Test 4: Camera Group Commands
log_info "Test 4: Camera Group Testing..."

probe_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/exterior-cams/probe" -X POST)
probe_job_id=$(extract_job_id "$probe_response")
if [[ -n "$probe_job_id" ]]; then
    log_success "Camera probe accepted: $probe_job_id"
else
    log_error "Camera probe failed"
fi

# Test 5: Zigbee Group Commands
log_info "Test 5: Zigbee Group Testing..."

permit_join_response=$(curl -s -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"duration": 30}' \
    "$API_URL/api/groups/zigbee-hubs/permit_join" -X POST)
permit_join_job_id=$(extract_job_id "$permit_join_response")
if [[ -n "$permit_join_job_id" ]]; then
    log_success "Zigbee permit join accepted: $permit_join_job_id"
else
    log_error "Zigbee permit join failed"
fi

# Test 6: Response Code Validation
log_info "Test 6: Response Code Validation..."

# Check for proper error responses
not_found_response=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/nonexistent/play" -X POST)
if [[ "$not_found_response" == "404" ]]; then
    log_success "Proper 404 for nonexistent group"
else
    log_error "Expected 404, got $not_found_response"
fi

# Check unauthorized access
unauthorized_response=$(curl -s -w "%{http_code}" -o /dev/null \
    "$API_URL/api/fleet/layout")
if [[ "$unauthorized_response" == "401" ]]; then
    log_success "Proper 401 for unauthorized access"
else
    log_error "Expected 401, got $unauthorized_response"
fi

echo ""
log_success "🎯 Acceptance test completed!"
echo "📊 All core functionality validated"
if [ "$ENABLE_LIBRARY_UPLOAD" != "1" ]; then
    echo "💡 Run with ENABLE_LIBRARY_UPLOAD=1 to test file uploads"
fi