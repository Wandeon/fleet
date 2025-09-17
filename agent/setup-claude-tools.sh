#!/usr/bin/env bash
set -euo pipefail

umask 022

log() {
  printf '[setup-claude-tools] %s\n' "$1"
}

NODE_MIN_MAJOR=18
NODE_INSTALL_MAJOR=20
STATE_DIR="/var/lib/claude-code"
CONFIG_DIR="/etc/claude-code"
PLAYWRIGHT_CACHE_DIR="${STATE_DIR}/playwright"
LAST_UPDATE_FILE="${STATE_DIR}/last-update"
CHECK_INTERVAL_SECONDS=$((24 * 60 * 60))
PLAYWRIGHT_VERSION="1.48.0"
PACKAGES=(
  "@anthropic-ai/claude-code"
  "@modelcontextprotocol/server-slack"
  "@automatalabs/mcp-server-playwright"
)

ensure_prereqs() {
  if ! command -v curl >/dev/null 2>&1; then
    log "curl is required but not installed"
    return 1
  fi
  return 0
}

install_nodesource_repo() {
  local setup_script
  setup_script=$(mktemp)
  if ! curl -fsSL "https://deb.nodesource.com/setup_${NODE_INSTALL_MAJOR}.x" -o "$setup_script"; then
    log "ERROR: failed to download NodeSource setup script"
    rm -f "$setup_script"
    return 1
  fi
  if ! bash "$setup_script" >/dev/null; then
    log "ERROR: NodeSource setup script failed"
    rm -f "$setup_script"
    return 1
  fi
  rm -f "$setup_script"
  return 0
}

ensure_node() {
  local have_node=0
  if command -v node >/dev/null 2>&1; then
    have_node=1
    local major
    major=$(node -p 'parseInt(process.versions.node.split(".")[0], 10)')
    if (( major >= NODE_MIN_MAJOR )); then
      return 0
    fi
    log "Updating Node.js (current $(node -v), need >= ${NODE_MIN_MAJOR})"
  else
    log "Installing Node.js >= ${NODE_MIN_MAJOR}"
  fi

  if ! install_nodesource_repo; then
    return 1
  fi

  export DEBIAN_FRONTEND=noninteractive
  if ! apt-get update >/dev/null; then
    log "ERROR: apt-get update failed while preparing Node.js"
    return 1
  fi
  if ! apt-get install -y nodejs >/dev/null; then
    log "ERROR: failed to install Node.js ${NODE_INSTALL_MAJOR}.x"
    return 1
  fi
  if (( have_node )); then
    hash -r
  fi
  return 0
}

should_refresh_packages() {
  local now
  now=$(date +%s)
  if [[ ! -f "${LAST_UPDATE_FILE}" ]]; then
    return 0
  fi
  local last
  last=$(<"${LAST_UPDATE_FILE}")
  if ! [[ "$last" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  if (( now - last >= CHECK_INTERVAL_SECONDS )); then
    return 0
  fi
  for pkg in "${PACKAGES[@]}"; do
    if ! npm ls -g "$pkg" --depth=0 >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

refresh_packages() {
  local update_failed=0
  for pkg in "${PACKAGES[@]}"; do
    log "Installing ${pkg}@latest"
    if ! npm install -g --no-audit --no-fund "${pkg}@latest"; then
      log "WARNING: npm install failed for ${pkg}"
      update_failed=1
    fi
  done
  local now
  now=$(date +%s)
  if (( update_failed == 0 )); then
    echo "$now" > "${LAST_UPDATE_FILE}"
  fi
  return $update_failed
}

ensure_playwright_assets() {
  mkdir -p "${PLAYWRIGHT_CACHE_DIR}/browsers"
  chmod -R 755 "${PLAYWRIGHT_CACHE_DIR}"
  if ! npm ls -g '@automatalabs/mcp-server-playwright' --depth=0 >/dev/null 2>&1; then
    return 0
  fi
  local deps_marker="${STATE_DIR}/playwright-deps-installed"
  local browsers_marker="${STATE_DIR}/playwright-browsers-installed"
  if [[ ! -f "$deps_marker" ]]; then
    log "Installing Playwright system dependencies"
    if DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_CACHE_DIR}/browsers" npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps; then
      touch "$deps_marker"
    else
      log "WARNING: Playwright dependency installation failed"
    fi
  fi
  if [[ ! -f "$browsers_marker" ]]; then
    log "Downloading Playwright Chromium browser"
    if PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_CACHE_DIR}/browsers" npx -y "playwright@${PLAYWRIGHT_VERSION}" install chromium; then
      touch "$browsers_marker"
    else
      log "WARNING: Playwright browser download failed"
    fi
  fi
}

write_env_loader() {
  local loader="/etc/profile.d/claude-code.sh"
  local tmp
  tmp=$(mktemp)
  cat <<'SH' > "$tmp"
# Managed by fleet GitOps. Loads Claude Code credentials for CLI + MCP servers.
if [ -f /etc/claude-code/secrets.env ]; then
  set -a
  . /etc/claude-code/secrets.env
  set +a
fi
SH
  if [[ ! -f "$loader" ]] || ! cmp -s "$tmp" "$loader"; then
    install -o root -g root -m 0644 "$tmp" "$loader"
    log "Updated ${loader}"
  fi
  rm -f "$tmp"
}

write_managed_config() {
  mkdir -p "$CONFIG_DIR"
  chmod 755 "$CONFIG_DIR"
  local tmp
  tmp=$(mktemp)
  cat <<'JSON' > "$tmp"
{
  "mcpServers": {
    "slack": {
      "type": "stdio",
      "command": "mcp-server-slack",
      "env": {
        "SLACK_BOT_TOKEN": "${CLAUDE_SLACK_BOT_TOKEN:-}",
        "SLACK_TEAM_ID": "${CLAUDE_SLACK_TEAM_ID:-}",
        "SLACK_CHANNEL_IDS": "${CLAUDE_SLACK_CHANNEL_IDS:-}"
      }
    },
    "playwright": {
      "type": "stdio",
      "command": "mcp-server-playwright",
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "/var/lib/claude-code/playwright/browsers"
      }
    }
  }
}
JSON
  local dest="${CONFIG_DIR}/managed-mcp.json"
  if [[ ! -f "$dest" ]] || ! cmp -s "$tmp" "$dest"; then
    install -o root -g root -m 0644 "$tmp" "$dest"
    log "Updated ${dest}"
  fi
  rm -f "$tmp"
}

main() {
  mkdir -p "$STATE_DIR"
  chmod 755 "$STATE_DIR"

  ensure_prereqs || return 1
  ensure_node || return 1

  if should_refresh_packages; then
    if ! refresh_packages; then
      log "Package refresh encountered errors"
    fi
  fi

  ensure_playwright_assets
  write_env_loader
  write_managed_config
}

main "$@"
