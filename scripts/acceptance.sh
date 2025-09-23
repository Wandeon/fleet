#!/usr/bin/env bash
set -euo pipefail

# Acceptance script to sanity-check player Pis and the stream.
# Usage:
#   SSH_USER=admin AUDIOCTL_TOKEN=token ICECAST_URL=http://vps:8000/mount \
#     scripts/acceptance.sh pi-audio-01 pi-audio-02
# Options:
#   --icecast <url>   # Override ICECAST_URL without exporting env
#   --play-both       # Trigger stream + fallback playback checks (requires token)

SSH_USER=${SSH_USER:-admin}
TOKEN=${AUDIOCTL_TOKEN:-}
ICECAST_URL=${ICECAST_URL:-}
PLAY_BOTH=0

auth_hdr=( )

usage(){
  cat <<'USAGE' >&2
usage: [SSH_USER=admin] [AUDIOCTL_TOKEN=token] [ICECAST_URL=http://...] scripts/acceptance.sh [options] <pi-host> [<pi-host> ...]

Options:
  --icecast <url>   Override ICECAST_URL for Icecast reachability check
  --play-both       Trigger stream and fallback playback toggles (requires AUDIOCTL_TOKEN)
  -h, --help        Show this help message
USAGE
}

hosts=( )
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      shift
      if [[ $# -lt 1 ]]; then
        echo "--icecast requires a URL" >&2
        usage
        exit 2
      fi
      ICECAST_URL=$1
      shift
      ;;
    --play-both)
      PLAY_BOTH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        hosts+=("$1")
        shift
      done
      break
      ;;
    -*)
      echo "unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      hosts+=("$1")
      shift
      ;;
  esac
done

if [[ ${#hosts[@]} -eq 0 ]]; then
  usage
  exit 2
fi

if [[ -n "$TOKEN" ]]; then
  auth_hdr=( -H "Authorization: Bearer ${TOKEN}" )
fi

ok()  { printf "\033[32mOK\033[0m %s\n"   "$*"; }
warn(){ printf "\033[33mWARN\033[0m %s\n" "$*"; }
err() { printf "\033[31mERR\033[0m %s\n"  "$*"; }

for host in "${hosts[@]}"; do
  echo "== ${host} =="
  base="http://${host}:8081"
  # Control API health
  if curl -fsS "${base}/healthz" >/dev/null 2>&1; then
    ok "control API healthy (:8081/healthz)"
  else
    err "control API not responding"
    # Show last few container logs if accessible via SSH
    if ssh -o ConnectTimeout=5 "${SSH_USER}@${host}" 'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 50' >/dev/null 2>&1; then
      ssh -o ConnectTimeout=5 "${SSH_USER}@${host}" 'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 50' || true
    fi
  fi

  # Status JSON (best-effort)
  if curl -fsS "${auth_hdr[@]}" "${base}/status" >/dev/null 2>&1; then
    curl -fsS "${auth_hdr[@]}" "${base}/status" || true
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

  if [[ ${PLAY_BOTH} -eq 1 ]]; then
    if [[ -z "$TOKEN" ]]; then
      warn "--play-both requested but AUDIOCTL_TOKEN not set; skipping playback toggles"
    else
      if curl -fsS "${auth_hdr[@]}" -H 'Content-Type: application/json' -d '{"source":"stream"}' "${base}/play" >/dev/null 2>&1; then
        ok "play stream requested via /play"
      else
        warn "unable to request stream playback"
      fi
      sleep 1
      if curl -fsS "${auth_hdr[@]}" -H 'Content-Type: application/json' -d '{"source":"file"}' "${base}/play" >/dev/null 2>&1; then
        ok "play fallback requested via /play"
      else
        warn "unable to request fallback playback"
      fi
      if curl -fsS "${auth_hdr[@]}" -X PUT -H 'Content-Type: application/json' -d '{"mode":"auto","source":"stream"}' "${base}/config" >/dev/null 2>&1; then
        ok "restored auto stream mode"
      else
        warn "could not restore auto stream mode"
      fi
    fi
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
# for host in "${hosts[@]}"; do
#   if curl -fsS "http://${host}:8091/healthz" >/dev/null 2>&1; then
#     ok "video API healthy (:8091/healthz)"
#   else
#     warn "video API not responding on ${host}"
#   fi
# done
