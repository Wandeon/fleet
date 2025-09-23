#!/usr/bin/env bash
set -euo pipefail

HEALTH_FILE="${ROLE_AGENT_HEALTH_FILE:-/var/run/fleet/health.json}"
MAX_AGE_MINUTES=${ROLE_AGENT_HEALTH_MAX_MINUTES:-15}

if [[ ! -f "$HEALTH_FILE" ]]; then
  echo "health file missing: $HEALTH_FILE" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to parse $HEALTH_FILE" >&2
  exit 1
fi

status=$(jq -r '.status // ""' "$HEALTH_FILE")
if [[ -z "$status" ]]; then
  echo "status missing from $HEALTH_FILE" >&2
  exit 1
fi

mtime=$(stat -c %Y "$HEALTH_FILE" 2>/dev/null || stat -f %m "$HEALTH_FILE" 2>/dev/null || echo 0)
now=$(date +%s)
age_minutes=$(( (now - mtime) / 60 ))

if (( age_minutes > MAX_AGE_MINUTES )); then
  echo "health file stale: $age_minutes minutes old (threshold ${MAX_AGE_MINUTES}m)" >&2
  exit 2
fi

errors=$(jq -r '.errors[]?' "$HEALTH_FILE" | paste -sd '; ' - 2>/dev/null || true)

if [[ "$status" == "error" ]]; then
  echo "role agent reported error status: $errors" >&2
  exit 3
fi

if [[ "$status" == "degraded" ]]; then
  echo "role agent degraded: $errors" >&2
  exit 4
fi

echo "health OK (status=$status, age=${age_minutes}m)"
exit 0
