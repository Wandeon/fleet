#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=${ROLE_AGENT_REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}
AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/etc/fleet/age.key}"

if [[ ! -d "$REPO_DIR/roles" ]]; then
  echo "roles directory missing under $REPO_DIR" >&2
  exit 1
fi

mapfile -t ENCRYPTED_ENVS < <(find "$REPO_DIR/roles" -maxdepth 2 -type f -name '.env.sops.enc' | sort)

if (( ${#ENCRYPTED_ENVS[@]} == 0 )); then
  echo "No encrypted role env files detected."
  exit 0
fi

if ! command -v sops >/dev/null 2>&1; then
  echo "sops binary is required but not installed" >&2
  exit 1
fi

if [[ ! -f "$AGE_KEY_FILE" ]]; then
  echo "AGE key missing at $AGE_KEY_FILE" >&2
  exit 1
fi

if [[ -L "$AGE_KEY_FILE" ]]; then
  echo "AGE key must be a regular file, not a symlink: $AGE_KEY_FILE" >&2
  exit 1
fi

perms=$(stat -c %a "$AGE_KEY_FILE" 2>/dev/null || echo "")
if [[ "$perms" != "600" ]]; then
  echo "AGE key at $AGE_KEY_FILE must have permissions 0600 (found $perms)" >&2
  exit 1
fi

expected_owner=${ROLE_AGENT_ALLOWED_KEY_OWNER:-root}
owner=$(stat -c %U "$AGE_KEY_FILE" 2>/dev/null || echo "")
if [[ -n "$owner" && "$owner" != "$expected_owner" ]]; then
  echo "AGE key owned by $owner but expected $expected_owner" >&2
  exit 1
fi

echo "Found ${#ENCRYPTED_ENVS[@]} encrypted env file(s). Permissions and tooling look good."
for env in "${ENCRYPTED_ENVS[@]}"; do
  role=$(basename "$(dirname "$env")")
  echo "  role=$role -> $(basename "$env")"
  if [[ -f "${env%.sops.enc}" ]]; then
    echo "    warning: plaintext env present alongside encrypted file" >&2
  fi
done
exit 0
