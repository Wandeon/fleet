#!/usr/bin/env bash
set -euo pipefail

# Acceptance script to sanity-check player Pis and the stream.
# Usage:
#   SSH_USER=admin AUDIOCTL_TOKEN=token ICECAST_URL=http://vps:8000/mount \
#     scripts/acceptance.sh pi-audio-01 pi-audio-02

SSH_USER=${SSH_USER:-admin}
TOKEN=${AUDIOCTL_TOKEN:-}
ICECAST_URL=${ICECAST_URL:-}

hdr=( )
if [[ -n "$TOKEN" ]]; then
  hdr=( -H "Authorization: Bearer ${TOKEN}" )
fi

ok()  { printf "\033[32mOK\033[0m %s\n"   "$*"; }
warn(){ printf "\033[33mWARN\033[0m %s\n" "$*"; }
err() { printf "\033[31mERR\033[0m %s\n"  "$*"; }

if [[ $# -lt 1 ]]; then
  echo "usage: [SSH_USER=admin] [AUDIOCTL_TOKEN=token] [ICECAST_URL=http://...] $0 <pi-host> [<pi-host> ...]" >&2
  exit 2
fi

for host in "$@"; do
  echo "== ${host} =="
  # Control API health
  if curl -fsS "${hdr[@]}" "http://${host}:8081/healthz" >/dev/null 2>&1; then
    ok "control API healthy (:8081/healthz)"
  else
    err "control API not responding"
    # Show last few container logs if accessible via SSH
    if ssh -o ConnectTimeout=5 "${SSH_USER}@${host}" 'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 50' >/dev/null 2>&1; then
      ssh -o ConnectTimeout=5 "${SSH_USER}@${host}" 'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 50' || true
    fi
  fi

  # Status JSON (best-effort)
  if curl -fsS "${hdr[@]}" "http://${host}:8081/status" >/dev/null 2>&1; then
    curl -fsS "${hdr[@]}" "http://${host}:8081/status" || true
    echo
  else
    warn "cannot fetch /status"
  fi

  # ALSA presence via SSH (best-effort)
  if ssh -o ConnectTimeout=5 "${SSH_USER}@${host}" 'aplay -l | grep -q "^card"'; then
    ok "ALSA device(s) present"
  else
    warn "no ALSA devices found (aplay -l)"
  fi

  echo
done

# Optional: check Icecast stream reachability from this host
if [[ -n "${ICECAST_URL}" ]]; then
  if curl -fsI --max-time 5 "${ICECAST_URL}" >/dev/null 2>&1; then
    ok "Icecast mount reachable: ${ICECAST_URL}"
  else
    err "Icecast mount not reachable: ${ICECAST_URL}"
  fi
fi

echo "Done."

# --- Video role hooks (stubs) ---
# If you later add a video-capture role/API, wire checks here, e.g.:
# for host in "$@"; do
#   if curl -fsS "http://${host}:8091/healthz" >/dev/null 2>&1; then
#     ok "video API healthy (:8091/healthz)"
#   else
#     warn "video API not responding on ${host}"
#   fi
# done
