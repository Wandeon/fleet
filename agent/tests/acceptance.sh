#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
AGENT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(cd "$AGENT_DIR/.." && pwd)
PARSER="$AGENT_DIR/lib/inventory_to_json.py"
TMP_RUN=$(mktemp -d)
TMP_BIN=$(mktemp -d)
AGE_KEY_FILE="$TMP_RUN/age.key"
HEALTH_FILE="$TMP_RUN/health.json"
OVERLAY_FILE=""

cleanup() {
  rm -rf "$TMP_RUN" "$TMP_BIN"
  if [[ -n "$OVERLAY_FILE" && -f "$OVERLAY_FILE" ]]; then
    rm -f "$OVERLAY_FILE"
  fi
}
trap cleanup EXIT

echo "[acceptance] using repo: $REPO_DIR"

if [[ ! -x "$PARSER" ]]; then
  echo "inventory parser missing: $PARSER" >&2
  exit 1
fi

inventory_json=$(python3 "$PARSER" "$REPO_DIR/inventory/devices.yaml")
if [[ -z "$inventory_json" ]]; then
  echo "failed to parse inventory" >&2
  exit 1
fi

ROLE_FILTER="${ROLE_AGENT_TEST_ROLE:-}"
HOST_FILTER="${ROLE_AGENT_TEST_HOST:-}"

if [[ -n "$ROLE_FILTER" ]]; then
  HOSTNAME=$(printf '%s' "$inventory_json" | jq -r --arg role "$ROLE_FILTER" 'to_entries[] | select(.value.role==$role) | .key' | head -n1)
  ROLE="$ROLE_FILTER"
else
  HOSTNAME=$(printf '%s' "$inventory_json" | jq -r 'to_entries[0].key')
  ROLE=$(printf '%s' "$inventory_json" | jq -r 'to_entries[0].value.role')
fi

if [[ -n "$HOST_FILTER" ]]; then
  HOSTNAME="$HOST_FILTER"
  ROLE=$(printf '%s' "$inventory_json" | jq -r --arg host "$HOSTNAME" '.[$host].role // empty')
fi

if [[ -z "$HOSTNAME" || -z "$ROLE" ]]; then
  echo "unable to determine host/role for acceptance" >&2
  exit 1
fi

echo "[acceptance] host=$HOSTNAME role=$ROLE"

printf 'dummy-age-key' > "$AGE_KEY_FILE"
chmod 600 "$AGE_KEY_FILE"

if ! command -v sops >/dev/null 2>&1; then
  cat <<'EOS' >"$TMP_BIN/sops"
#!/usr/bin/env bash
cat "$@"
EOS
  chmod +x "$TMP_BIN/sops"
fi

PATH="$TMP_BIN:$PATH"

export ROLE_AGENT_REPO_DIR="$REPO_DIR"
export ROLE_AGENT_RUN_DIR="$TMP_RUN"
export ROLE_AGENT_TEXTFILE_DIR="$TMP_RUN"
export ROLE_AGENT_HOSTNAME="$HOSTNAME"
export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"

pushd "$REPO_DIR" >/dev/null

set -x
"$AGENT_DIR/validate-inventory.sh" --host "$HOSTNAME"
"$AGENT_DIR/plan.sh" --role "$ROLE"
set +x

if ! command -v docker >/dev/null 2>&1; then
  echo "[acceptance] docker not available; skipping converge steps"
  exit 0
fi

set -x
"$AGENT_DIR/role-agent.sh" --dry-run --log-json
set +x

dry_status=$(jq -r '.dryRun // false' "$HEALTH_FILE")
if [[ "$dry_status" != "true" ]]; then
  echo "dry-run did not set dryRun flag" >&2
  exit 1
fi

echo "[acceptance] dry-run health.json verified"

set -x
"$AGENT_DIR/role-agent.sh"
set +x

ok_status=$(jq -r '.status' "$HEALTH_FILE")
if [[ "$ok_status" != "ok" ]]; then
  echo "expected status ok after converge" >&2
  exit 1
fi

OVERLAY_FILE="$REPO_DIR/roles/$ROLE/zz-99-acceptance.yml"
cat <<'YAML' > "$OVERLAY_FILE"
services:
  acceptance-broken-build:
    build:
      context: /nonexistent/context
YAML

set +e
"$AGENT_DIR/role-agent.sh"
rc=$?
set -e

echo "[acceptance] converge with broken overlay exit code=$rc"
if (( rc != 20 && rc != 21 )); then
  echo "expected exit code 20 or 21 when converge fails" >&2
  exit 1
fi

status_after_fail=$(jq -r '.status' "$HEALTH_FILE" 2>/dev/null || echo "")
if [[ "$status_after_fail" != "error" && "$status_after_fail" != "degraded" ]]; then
  echo "expected health status error or degraded after failure" >&2
  exit 1
fi

rm -f "$OVERLAY_FILE"

set -x
"$AGENT_DIR/role-agent.sh"
set +x

echo "[acceptance] final converge status $(jq -r '.status' "$HEALTH_FILE")"

popd >/dev/null
