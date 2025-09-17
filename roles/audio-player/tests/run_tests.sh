#!/usr/bin/env bash
set -uo pipefail

ROLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROLE_NAME="audio-player"
LOG_ROOT="${LOG_DIR:-/var/log/fleet-tests}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_BASENAME="${ROLE_NAME}-tests-${TIMESTAMP}.log"

if ! mkdir -p "$LOG_ROOT" 2>/dev/null; then
    LOG_ROOT="${ROLE_DIR}/logs"
    mkdir -p "$LOG_ROOT"
fi

LOG_FILE="${LOG_ROOT}/${LOG_BASENAME}"

echo "Writing audio player role test log to ${LOG_FILE}"
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

log "=== Audio player role validation starting ==="
log "Host: $(hostname)"
if check_command docker; then
    log "Docker containers overview:"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
fi

# Load optional environment (plaintext .env if present next to the role).
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

AUDIO_CONTROL_BASE_URL="${AUDIO_CONTROL_BASE_URL:-http://127.0.0.1:8081}"
AUDIO_CONTROL_TOKEN="${AUDIO_CONTROL_TOKEN:-}"
AUDIO_OUTPUT_DEVICE="${AUDIO_OUTPUT_DEVICE:-plughw:0,0}"

AUTH_HEADER=()
if [ -n "$AUDIO_CONTROL_TOKEN" ]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${AUDIO_CONTROL_TOKEN}")
else
    log "AUDIO_CONTROL_TOKEN not provided; skipping auth-only API checks"
fi

log "Using audio-control base URL: ${AUDIO_CONTROL_BASE_URL}"
log "Expected ALSA output device: ${AUDIO_OUTPUT_DEVICE}"

test_http_endpoint "audio-control health endpoint" "${AUDIO_CONTROL_BASE_URL}/healthz"

if [ ${#AUTH_HEADER[@]} -gt 0 ]; then
    test_http_endpoint "audio-control status endpoint" "${AUDIO_CONTROL_BASE_URL}/status" "${AUTH_HEADER[@]}"
    test_http_endpoint "audio-control metrics endpoint" "${AUDIO_CONTROL_BASE_URL}/metrics" "${AUTH_HEADER[@]}"
else
    record_skip "audio-control status endpoint" "missing AUDIO_CONTROL_TOKEN"
    record_skip "audio-control metrics endpoint" "missing AUDIO_CONTROL_TOKEN"
fi

test_tcp_port "audio-control TCP port 8081 reachable" "127.0.0.1" "8081"

if check_command aplay; then
    if aplay -l 2>/dev/null | grep -q '^card [0-9]'; then
        record_pass "ALSA playback devices detected"
    else
        record_fail "ALSA playback devices detected (no cards reported)"
    fi
else
    record_skip "ALSA playback devices detected" "aplay not installed"
fi

test_docker_container "audio-player container running" 'audio-player.*audio-player'
test_docker_container "audio-control container running" 'audio-player.*audio-control'

log "=== Audio player role validation complete ==="
log "Summary: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} SKIP=${SKIP_COUNT}"
log "Log file saved to ${LOG_FILE}"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
