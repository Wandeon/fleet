#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--host HOSTNAME]

Validates inventory/devices.yaml ensuring each device maps to a role.
EOF
}

HOST_FILTER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST_FILTER="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=${ROLE_AGENT_REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}
INVENTORY="$REPO_DIR/inventory/devices.yaml"
PARSER="$SCRIPT_DIR/lib/inventory_to_json.py"

if [[ ! -f "$INVENTORY" ]]; then
  echo "inventory file not found: $INVENTORY" >&2
  exit 1
fi

if [[ ! -x "$PARSER" ]]; then
  echo "inventory parser missing: $PARSER" >&2
  exit 1
fi

INVENTORY_JSON=$(python3 "$PARSER" "$INVENTORY")
if [[ -z "$INVENTORY_JSON" ]]; then
  echo "failed to parse inventory" >&2
  exit 1
fi

if [[ -n "$HOST_FILTER" ]]; then
  role=$(printf '%s' "$INVENTORY_JSON" | jq -r --arg host "$HOST_FILTER" '.[$host].role // empty')
  if [[ -z "$role" ]]; then
    cat >&2 <<EOF
Host '$HOST_FILTER' missing or lacks role in inventory.
Add it like:
  devices:
    $HOST_FILTER:
      role: <role-name>
EOF
    exit 1
  fi
  echo "Host $HOST_FILTER has role: $role"
  exit 0
fi

missing=$(printf '%s' "$INVENTORY_JSON" | jq -r 'to_entries[] | select((.value.role // "") == "") | .key')
if [[ -n "$missing" ]]; then
  echo "The following hosts are missing roles:" >&2
  while IFS= read -r host; do
    printf '  %s\n' "$host" >&2
  done <<<"$missing"
  exit 1
fi

count=$(printf '%s' "$INVENTORY_JSON" | jq 'length')
echo "Inventory OK. Hosts with roles: $count"
exit 0
