#!/usr/bin/env bash
set -euo pipefail

ROLE=""
REPO_DIR="/opt/fleet"
AGE_KEY_FILE="/etc/fleet/age.key"

# Ensure required commands exist
for cmd in git docker sops jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found"
    exit 1
  fi
done

# Determine role from inventory/devices.yaml by hostname
HOSTNAME_ACTUAL=$(hostname)
ROLE=$(awk -v h="$HOSTNAME_ACTUAL" '
  $1=="devices:" {in_devices=1}
  in_devices && $1==h":" {getline; print $2}
' "$REPO_DIR/inventory/devices.yaml" | tr -d '[:space:]')

if [[ -z "${ROLE}" ]]; then
  echo "ERROR: Role not found for hostname ${HOSTNAME_ACTUAL} in inventory/devices.yaml"
  exit 1
fi

# Update repo
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch --depth 1 origin main
  git -C "$REPO_DIR" reset --hard origin/main
else
  echo "ERROR: Repo not found at $REPO_DIR"
  exit 1
fi

# Decrypt role env if present
ENC_ENV="$REPO_DIR/roles/$ROLE/.env.sops.enc"
if [[ -f "$ENC_ENV" ]]; then
  if [[ ! -f "$AGE_KEY_FILE" ]]; then
    echo "ERROR: AGE key not found at $AGE_KEY_FILE"
    exit 1
  fi
  export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"
  TMP_ENV="/run/${ROLE}.env"
  sops --decrypt "$ENC_ENV" > "$TMP_ENV"
  set -a
  # shellcheck source=/dev/null
  source "$TMP_ENV"
  set +a
  rm -f "$TMP_ENV"
fi

# Compose files (baseline + role, with lexical mix-ins if present)
BASE="$REPO_DIR/baseline/docker-compose.yml"
ROLE_DIR="$REPO_DIR/roles/$ROLE"
readarray -t ROLE_OVERRIDES < <(find "$ROLE_DIR" -maxdepth 1 -type f -name '*.yml' | sort)

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
PROJECT="${ROLE}_${COMMIT}"

COMPOSE_FILES=("-f" "$BASE")
for f in "${ROLE_OVERRIDES[@]}"; do
  COMPOSE_FILES+=("-f" "$f")
done

docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d --remove-orphans

# Cleanup old projects for same role
old_projects=$(docker compose ls --format json | jq -r '.[] | .Name' | grep "^${ROLE}_" | grep -v "$PROJECT" || true)
for OLD in $old_projects; do
  docker compose -p "$OLD" down --volumes || true
done

echo "Converged role=$ROLE project=$PROJECT"
