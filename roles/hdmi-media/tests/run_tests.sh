#!/usr/bin/env bash
set -uo pipefail

ROLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROLE_NAME="hdmi-media"
LOG_ROOT="${LOG_DIR:-/var/log/fleet-tests}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_BASENAME="${ROLE_NAME}-tests-${TIMESTAMP}.log"

if ! mkdir -p "$LOG_ROOT" 2>/dev/null; then
    LOG_ROOT="${ROLE_DIR}/logs"
    mkdir -p "$LOG_ROOT"
fi

LOG_FILE="${LOG_ROOT}/${LOG_BASENAME}"

echo "Writing HDMI media role test log to ${LOG_FILE}"
exec > >(tee -a "$LOG_FILE") 2>&1

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

record_pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    log "PASS: $1"
}

record_fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log "FAIL: $1"
}

record_skip() {
    SKIP_COUNT=$((SKIP_COUNT + 1))
    if [ -n "${2:-}" ]; then
        log "SKIP: $1 - $2"
    else
        log "SKIP: $1"
    fi
}

run_named_test() {
    local name="$1"
    shift
    log "RUN: ${name}"
    if "$@"; then
        record_pass "$name"
    else
        local rc=$?
        record_fail "${name} (rc=${rc})"
    fi
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

test_http_endpoint() {
    local name="$1"
    local url="$2"
    shift 2
    if ! check_command curl; then
        record_skip "$name" "curl not installed"
        return
    fi
    run_named_test "$name" curl -fsS --max-time 5 "$@" "$url"
}

test_tcp_port() {
    local name="$1"
    local host="$2"
    local port="$3"
    if check_command nc; then
        if nc -z "$host" "$port"; then
            record_pass "$name"
        else
            record_fail "$name (nc failed)"
        fi
    elif check_command python3; then
        if python3 - "$host" "$port" <<'PYCODE'
import socket
import sys
host = sys.argv[1]
port = int(sys.argv[2])
with socket.create_connection((host, port), timeout=5):
    pass
PYCODE
        then
            record_pass "$name"
        else
            record_fail "$name (python socket test failed)"
        fi
    else
        record_skip "$name" "nc and python3 not installed"
    fi
}

test_docker_container() {
    local name="$1"
    local pattern="$2"
    if ! check_command docker; then
        record_skip "$name" "docker not installed"
        return
    fi
    if docker ps --format '{{.Names}} {{.Status}}' | grep -E "$pattern" >/dev/null 2>&1; then
        record_pass "$name"
    else
        record_fail "$name (no running container matches pattern '$pattern')"
    fi
}

log "=== HDMI media role validation starting ==="
log "Host: $(hostname)"
if check_command docker; then
    log "Docker containers overview:"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
fi

# Load environment file if present to pick up tokens and credentials.
for candidate in "${ROLE_DIR}/.env" "${ROLE_DIR}/.env.local"; do
    if [ -f "$candidate" ]; then
        log "Loading environment from ${candidate}"
        # shellcheck disable=SC1090
        set -a
        source "$candidate"
        set +a
        break
    fi
done

MEDIA_CONTROL_BASE_URL="${MEDIA_CONTROL_BASE_URL:-http://127.0.0.1:8082}"
MEDIA_CONTROL_TOKEN="${MEDIA_CONTROL_TOKEN:-}"
ZIGBEE_FRONTEND_PORT="${ZIGBEE_FRONTEND_PORT:-8084}"
MQTT_HOST="${MQTT_HOST:-127.0.0.1}"
MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_USER="${ZIGBEE_MQTT_USER:-${MOSQUITTO_USERNAME:-}}"
MQTT_PASS="${ZIGBEE_MQTT_PASSWORD:-${MOSQUITTO_PASSWORD:-}}"

AUTH_HEADER=()
if [ -n "$MEDIA_CONTROL_TOKEN" ]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${MEDIA_CONTROL_TOKEN}")
else
    log "MEDIA_CONTROL_TOKEN not provided; auth-required checks will be skipped"
fi

log "Using media-control base URL: ${MEDIA_CONTROL_BASE_URL}"

test_http_endpoint "media-control health endpoint" "${MEDIA_CONTROL_BASE_URL}/healthz"

if [ ${#AUTH_HEADER[@]} -gt 0 ]; then
    test_http_endpoint "media-control status endpoint" "${MEDIA_CONTROL_BASE_URL}/status" "${AUTH_HEADER[@]}"
    test_http_endpoint "media-control metrics endpoint" "${MEDIA_CONTROL_BASE_URL}/metrics" "${AUTH_HEADER[@]}"
else
    record_skip "media-control status endpoint" "missing MEDIA_CONTROL_TOKEN"
    record_skip "media-control metrics endpoint" "missing MEDIA_CONTROL_TOKEN"
fi

test_tcp_port "media-control TCP port 8082 reachable" "127.0.0.1" "8082"
test_http_endpoint "Zigbee2MQTT frontend" "http://127.0.0.1:${ZIGBEE_FRONTEND_PORT}" --head

test_tcp_port "MQTT TCP port 1883 reachable" "${MQTT_HOST}" "${MQTT_PORT}"

if check_command mosquitto_pub; then
    MQTT_CMD=(mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "fleet/hdmi-media/test" -m "$(hostname) $(date '+%s')" -i "hdmi-media-test-$$" -q 0)
    if [ -n "$MQTT_USER" ]; then
        MQTT_CMD+=(-u "$MQTT_USER")
        if [ -n "$MQTT_PASS" ]; then
            MQTT_CMD+=(-P "$MQTT_PASS")
        fi
    fi
    run_named_test "MQTT publish test" "${MQTT_CMD[@]}"
else
    record_skip "MQTT publish test" "mosquitto_pub not installed"
fi

test_docker_container "media-control container running" 'hdmi-media.*media-control'
test_docker_container "zigbee-mqtt container running" 'hdmi-media.*zigbee-mqtt'
test_docker_container "zigbee2mqtt container running" 'hdmi-media.*zigbee2mqtt'

log "=== HDMI media role validation complete ==="
log "Summary: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} SKIP=${SKIP_COUNT}"
log "Log file saved to ${LOG_FILE}"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
