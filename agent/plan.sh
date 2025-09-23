#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--host HOSTNAME] [--role ROLE]

Prints the compose files that would be applied for the selected role.
EOF
}

HOSTNAME=$(hostname -f 2>/dev/null || hostname)
ROLE_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOSTNAME="$2"
      shift 2
      ;;
    --role)
      ROLE_OVERRIDE="$2"
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
BASE_COMPOSE="$REPO_DIR/baseline/docker-compose.yml"

if [[ ! -f "$BASE_COMPOSE" ]]; then
  echo "baseline compose file missing: $BASE_COMPOSE" >&2
  exit 1
fi

role=""
if [[ -n "$ROLE_OVERRIDE" ]]; then
  role="$ROLE_OVERRIDE"
else
  parser="$SCRIPT_DIR/lib/inventory_to_json.py"
  inventory="$REPO_DIR/inventory/devices.yaml"
  if [[ ! -x "$parser" ]]; then
    echo "inventory parser missing: $parser" >&2
    exit 1
  fi
  inventory_json=$(python3 "$parser" "$inventory" 2>/dev/null || true)
  if [[ -z "$inventory_json" ]]; then
    echo "failed to parse inventory at $inventory" >&2
    exit 1
  fi
  role=$(printf '%s' "$inventory_json" | jq -r --arg host "$HOSTNAME" '.[$host].role // empty')
  if [[ -z "$role" ]]; then
    cat >&2 <<EOF
Host '$HOSTNAME' not found in inventory.
Add it like:
  devices:
    $HOSTNAME:
      role: <role-name>
EOF
    exit 1
  fi
fi

ROLE_DIR="$REPO_DIR/roles/$role"
if [[ ! -d "$ROLE_DIR" ]]; then
  echo "role directory missing: $ROLE_DIR" >&2
  exit 1
fi

readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '[0-9][0-9]-*.yml' | sort)

printf 'Compose plan for role %s (host %s):\n' "$role" "$HOSTNAME"
printf '  %s\n' "$BASE_COMPOSE"
for file in "${ROLE_OVERRIDES[@]}"; do
  printf '  %s\n' "$file"
 done

cat <<EOF
Suggested docker compose command:
  docker compose -p ${role}_<commit> -f $BASE_COMPOSE \
$(for file in "${ROLE_OVERRIDES[@]}"; do printf '    -f %s \\\n' "$file"; done)    up -d --build --remove-orphans
EOF
exit 0
