#!/usr/bin/env bash
set -uo pipefail

ROLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROLE_NAME="camera"
LOG_ROOT="${LOG_DIR:-/var/log/fleet-tests}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_BASENAME="${ROLE_NAME}-tests-${TIMESTAMP}.log"

if ! mkdir -p "$LOG_ROOT" 2>/dev/null; then
    LOG_ROOT="${ROLE_DIR}/logs"
    mkdir -p "$LOG_ROOT"
fi

LOG_FILE="${LOG_ROOT}/${LOG_BASENAME}"

echo "Writing camera role test log to ${LOG_FILE}"
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

log "=== Camera role validation starting ==="
log "Host: $(hostname)"
if check_command docker; then
    log "Docker containers overview:"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
fi

CAMERA_RTSP_URL="${CAMERA_RTSP_URL:-rtsp://127.0.0.1:8554/camera}"
CAMERA_HLS_URL="${CAMERA_HLS_URL:-http://127.0.0.1:8888/camera/index.m3u8}"
CAMERA_CONTROL_HEALTH="${CAMERA_CONTROL_HEALTH:-http://127.0.0.1:8083/healthz}"

log "Using RTSP URL: ${CAMERA_RTSP_URL}"
log "Using HLS URL: ${CAMERA_HLS_URL}"

# Tests

test_http_endpoint "camera-control health endpoint" "${CAMERA_CONTROL_HEALTH}"
test_http_endpoint "MediaMTX HLS playlist" "${CAMERA_HLS_URL}" --head

test_tcp_port "RTSP TCP port 8554 reachable" "127.0.0.1" "8554"

test_docker_container "camera-control container running" 'camera.*camera-control'
test_docker_container "camera-rtsp container running" 'camera.*camera-rtsp'
test_docker_container "camera-streamer container running" 'camera.*camera-streamer'

if check_command ffprobe; then
    if check_command timeout; then
        run_named_test "RTSP probe via ffprobe" timeout 12 ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${CAMERA_RTSP_URL}"
    else
        run_named_test "RTSP probe via ffprobe" ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${CAMERA_RTSP_URL}"
    fi
else
    record_skip "RTSP probe via ffprobe" "ffprobe not installed"
fi

log "=== Camera role validation complete ==="
log "Summary: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} SKIP=${SKIP_COUNT}"
log "Log file saved to ${LOG_FILE}"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
