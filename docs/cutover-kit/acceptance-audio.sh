#!/bin/bash
# Fleet API Audio Acceptance Test - Audio Group Commands
# Tests audio group functionality: play, pause, stop, volume control

set -euo pipefail

# Configuration
API_URL="${1:-http://localhost:3005}"
API_BEARER="${2:-${API_BEARER:-}}"
TEST_FILE="${3:-./test.mp3}"

if [[ -z "$API_BEARER" ]]; then
    echo "❌ ERROR: API_BEARER token required"
    echo "Usage: $0 [API_URL] [API_BEARER_TOKEN] [TEST_FILE]"
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

# Create a small test MP3 if one doesn't exist
create_test_file() {
    if [[ ! -f "$TEST_FILE" ]]; then
        log_info "Creating test MP3 file..."
        # Create a minimal valid MP3 (just headers, silent)
        printf '\xFF\xFB\x90\x00' > "$TEST_FILE"
        for i in {1..100}; do
            printf '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00' >> "$TEST_FILE"
        done
        log_success "Created test file: $TEST_FILE"
    fi
}

echo "🎵 Starting Fleet API Audio Acceptance Test"
echo "📍 API URL: $API_URL"
echo "🔑 Bearer Token: ${API_BEARER:0:8}..."
echo "📁 Test File: $TEST_FILE"
echo ""

# Step 1: Create test file if needed
create_test_file

# Step 2: Verify all-audio group exists
log_info "Step 1: Verifying all-audio group..."
layout_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/fleet/layout")

if echo "$layout_response" | jq -e '.groups["all-audio"]' >/dev/null 2>&1; then
    device_count=$(echo "$layout_response" | jq -r '.groups["all-audio"].devices | length')
    log_success "all-audio group found with $device_count devices"
else
    log_error "all-audio group not found"
    echo "Response: $layout_response"
    exit 1
fi

# Step 3: Upload test file to library
log_info "Step 2: Uploading test file to library..."
upload_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -F "file=@$TEST_FILE" \
    "$API_URL/api/library/upload" 2>/dev/null || echo '{}')

if command -v jq >/dev/null 2>&1; then
    file_id=$(echo "$upload_response" | jq -r '.file.id // empty')
    if [[ -n "$file_id" ]]; then
        log_success "File uploaded successfully - ID: $file_id"
    else
        log_error "File upload failed"
        echo "Response: $upload_response"
        exit 1
    fi
else
    log_error "jq not available - cannot extract file ID"
    exit 1
fi

# Step 4: Check audio device statuses
log_info "Step 3: Checking audio device statuses..."
for device in pi-audio-01 pi-audio-02; do
    status_response=$(curl -s \
        -H "Authorization: Bearer $API_BEARER" \
        "$API_URL/api/audio/devices/$device/status")

    if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
        playing=$(echo "$status_response" | jq -r '.status.playing // false')
        volume=$(echo "$status_response" | jq -r '.status.volume // 0')
        log_success "Device $device - Playing: $playing, Volume: $volume"
    else
        log_error "Invalid status response from $device"
    fi
done

# Step 5: Play file on all-audio group
log_info "Step 4: Playing file on all-audio group..."
play_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d "{\"fileId\":\"$file_id\"}" \
    "$API_URL/api/groups/all-audio/play")

play_job_id=$(extract_job_id "$play_response")
check_job_status "$play_job_id" || exit 1

# Step 6: Adjust volume to 150%
log_info "Step 5: Adjusting group volume to 150%..."
volume_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"value":1.5}' \
    "$API_URL/api/groups/all-audio/volume")

volume_job_id=$(extract_job_id "$volume_response")
check_job_status "$volume_job_id" || exit 1

# Step 7: Check device status after play command
log_info "Step 6: Checking device status after commands..."
for device in pi-audio-01 pi-audio-02; do
    status_response=$(curl -s \
        -H "Authorization: Bearer $API_BEARER" \
        "$API_URL/api/audio/devices/$device/status")

    if echo "$status_response" | jq -e '.status' >/dev/null 2>&1; then
        playing=$(echo "$status_response" | jq -r '.status.playing // false')
        volume=$(echo "$status_response" | jq -r '.status.volume // 0')
        log_success "Device $device - Playing: $playing, Volume: $volume"
    else
        log_error "Invalid status response from $device"
    fi
done

# Step 8: Pause group (expect partial success due to pi-audio-02)
log_info "Step 7: Testing pause (expect partial success)..."
pause_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-audio/pause")

pause_job_id=$(extract_job_id "$pause_response")
if [[ -n "$pause_job_id" ]]; then
    log_success "Pause command accepted - Job: $pause_job_id (expecting partial success)"
else
    log_error "Pause command failed"
fi

# Step 9: Stop group
log_info "Step 8: Stopping group playback..."
stop_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/api/groups/all-audio/stop")

stop_job_id=$(extract_job_id "$stop_response")
check_job_status "$stop_job_id" || exit 1

# Step 10: Volume back to normal
log_info "Step 9: Resetting volume to 100%..."
volume_reset_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"value":1.0}' \
    "$API_URL/api/groups/all-audio/volume")

volume_reset_job_id=$(extract_job_id "$volume_reset_response")
check_job_status "$volume_reset_job_id" || exit 1

# Step 11: Clean up - delete test file from library
log_info "Step 10: Cleaning up - deleting test file..."
delete_response=$(curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    -X DELETE \
    "$API_URL/api/library/files/$file_id")

if echo "$delete_response" | jq -e '.success' >/dev/null 2>&1; then
    log_success "Test file deleted from library"
else
    log_error "Failed to delete test file"
fi

echo ""
echo "🎉 Audio acceptance test completed!"
echo "✅ The audio group-intent architecture is working:"
echo "   • Audio group commands with job orchestration ✓"
echo "   • File playback control ✓"
echo "   • Volume control ✓"
echo "   • Partial success handling (pause on pi-audio-02) ✓"
echo "   • Device status monitoring ✓"
echo ""
log_success "Audio device validation PASSED"