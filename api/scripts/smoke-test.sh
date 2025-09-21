#!/bin/bash
# Fleet API Smoke Test - Production Cutover Validation
# Usage: ./scripts/smoke-test.sh [API_URL] [API_BEARER_TOKEN]

set -euo pipefail

# Configuration
API_URL="${1:-http://localhost:3005}"
API_BEARER="${2:-${API_BEARER:-}}"

if [[ -z "$API_BEARER" ]]; then
    echo "❌ ERROR: API_BEARER token required"
    echo "Usage: $0 [API_URL] [API_BEARER_TOKEN]"
    echo "Or set API_BEARER environment variable"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*"
    ((TESTS_FAILED++))
}

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    local data="${4:-}"
    local description="${5:-$endpoint}"

    log_info "Testing $description..."

    local curl_args=(
        -s -w "%{http_code}"
        -H "Authorization: Bearer $API_BEARER"
        -H "Content-Type: application/json"
    )

    if [[ -n "$data" ]]; then
        curl_args+=(-d "$data")
    fi

    local response
    response=$(curl "${curl_args[@]}" -X "$method" "$API_URL$endpoint")

    local status_code="${response: -3}"
    local body="${response%???}"

    if [[ "$status_code" -eq "$expected_status" ]]; then
        log_success "$description - HTTP $status_code"
        if [[ -n "$body" ]] && command -v jq >/dev/null 2>&1; then
            echo "$body" | jq -C . 2>/dev/null || echo "$body"
        fi
        return 0
    else
        log_error "$description - Expected HTTP $expected_status, got $status_code"
        echo "Response: $body"
        return 1
    fi
}

test_json_field() {
    local endpoint="$1"
    local field_path="$2"
    local description="${3:-$field_path in $endpoint}"

    log_info "Testing $description..."

    local response
    response=$(curl -s \
        -H "Authorization: Bearer $API_BEARER" \
        "$API_URL$endpoint")

    if command -v jq >/dev/null 2>&1; then
        local field_value
        field_value=$(echo "$response" | jq -r "$field_path" 2>/dev/null)

        if [[ "$field_value" != "null" && "$field_value" != "" ]]; then
            log_success "$description - Found: $field_value"
            return 0
        else
            log_error "$description - Field not found or null"
            return 1
        fi
    else
        log_error "jq not available, skipping JSON field test"
        return 1
    fi
}

# Start testing
echo "🚀 Starting Fleet API Smoke Tests"
echo "📍 API URL: $API_URL"
echo "🔑 Using Bearer Token: ${API_BEARER:0:8}..."
echo ""

# Test 1: Health/Metrics endpoint
test_endpoint "GET" "/metrics" 200 "" "Metrics endpoint"

# Test 2: Fleet Layout
test_endpoint "GET" "/api/fleet/layout" 200 "" "Fleet layout endpoint"

# Test 3: Fleet State
test_endpoint "GET" "/api/fleet/state" 200 "" "Fleet state endpoint"

# Test 4: Check if all groups exist
test_json_field "/api/fleet/layout" '.groups["all-audio"].name' "all-audio group exists"
test_json_field "/api/fleet/layout" '.groups["all-displays"].name' "all-displays group exists"
test_json_field "/api/fleet/layout" '.groups["exterior-cams"].name' "exterior-cams group exists"
test_json_field "/api/fleet/layout" '.groups["zigbee-hubs"].name' "zigbee-hubs group exists"

# Test 5: Device status endpoints
test_endpoint "GET" "/api/audio/devices/pi-audio-01/status" 200 "" "Device pi-audio-01 status"
test_endpoint "GET" "/api/audio/devices/pi-audio-02/status" 200 "" "Device pi-audio-02 status"
test_endpoint "GET" "/api/audio/devices/pi-video-01/status" 200 "" "Device pi-video-01 status"
test_endpoint "GET" "/api/audio/devices/pi-camera-01/status" 200 "" "Device pi-camera-01 status"

# Test 6: Library endpoints
test_endpoint "GET" "/api/library/files" 200 "" "Library files listing"

# Test 7: Audio group commands (these return job IDs)
test_endpoint "POST" "/api/groups/all-audio/volume" 202 '{"value":1.0}' "Audio group volume command"
test_endpoint "POST" "/api/groups/all-audio/stop" 202 "" "Audio group stop command"

# Test 8: Video group commands
test_endpoint "POST" "/api/groups/all-displays/power_on" 202 "" "Video group power on command"
test_endpoint "POST" "/api/groups/all-displays/input" 202 '{"source":"HDMI1"}' "Video group input command"

# Test 9: Camera group commands
test_endpoint "POST" "/api/groups/exterior-cams/probe" 202 "" "Camera group probe command"

# Test 10: Zigbee group commands
test_endpoint "POST" "/api/groups/zigbee-hubs/permit_join" 202 '{"duration":30}' "Zigbee permit join command"
test_endpoint "POST" "/api/groups/zigbee-hubs/publish" 202 '{"topic":"test/topic","payload":{"state":"ON"}}' "Zigbee publish command"

# Test 11: Unauthorized access (should fail)
log_info "Testing unauthorized access..."
local unauthorized_response
unauthorized_response=$(curl -s -w "%{http_code}" "$API_URL/api/fleet/layout")
local status_code="${unauthorized_response: -3}"

if [[ "$status_code" -eq 401 ]]; then
    log_success "Unauthorized access properly rejected - HTTP 401"
else
    log_error "Authorization not working - Expected HTTP 401, got $status_code"
fi

# Test 12: SSE endpoint connectivity
log_info "Testing SSE endpoint connectivity..."
timeout 5s curl -s \
    -H "Authorization: Bearer $API_BEARER" \
    "$API_URL/stream" >/dev/null 2>&1 && {
    log_success "SSE endpoint accessible"
} || {
    log_error "SSE endpoint not accessible"
}

# Summary
echo ""
echo "📊 Test Results:"
echo "✅ Passed: $TESTS_PASSED"
echo "❌ Failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 All smoke tests passed! API is ready for production.${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed. Check the API configuration.${NC}"
    exit 1
fi