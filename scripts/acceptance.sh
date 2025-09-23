#!/usr/bin/env bash
set -euo pipefail


usage() {
  cat <<'EOF'
Usage:
  SSH_USER=admin AUDIOCTL_TOKEN=<token> scripts/acceptance.sh [options] <host> [<host> ...]

Options:
  --icecast <url>   Verify Icecast mount via HTTP HEAD (e.g., http://vps:8000/mount)
  --play-both       Instruct each host to /play source=stream and verify status
  -h, --help        Show this help text

Environment:
  SSH_USER          SSH user for ALSA checks (default: admin)
  AUDIOCTL_TOKEN    Bearer token for control API (optional)
  ICECAST_URL       Default Icecast URL (overridden by --icecast)

EOF
}

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


HOSTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icecast)
      ICECAST_URL=${2:-}
      shift 2

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

      break
      ;;
    --*)
      echo "Unknown option: $1" >&2

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

      HOSTS+=("$1")

      hosts+=("$1")

      shift
      ;;
  esac
done


if (( ${#HOSTS[@]} == 0 )); then
  usage
  exit 2

if [[ ${#hosts[@]} -eq 0 ]]; then
  usage
  exit 2
fi

if [[ -n "$TOKEN" ]]; then
  auth_hdr=( -H "Authorization: Bearer ${TOKEN}" )

fi

warnings=0
errors=0

ok()  { printf "\033[32mOK\033[0m %s\n"   "$*"; }
warn(){ warnings=$((warnings + 1)); printf "\033[33mWARN\033[0m %s\n" "$*"; }
err() { errors=$((errors + 1)); printf "\033[31mERR\033[0m %s\n"  "$*"; }
info(){ printf "\033[36mINFO\033[0m %s\n" "$*"; }


auth_curl=()
if [[ -n $TOKEN ]]; then
  auth_curl=(-H "Authorization: Bearer ${TOKEN}")
fi

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no)

declare -A summary_online
declare -A summary_source
declare -A summary_fallback
declare -A summary_volume

for host in "${HOSTS[@]}"; do
  summary_online["$host"]="no"
  summary_source["$host"]="?"
  summary_fallback["$host"]="?"
  summary_volume["$host"]="?"

  echo "== ${host} =="

  base="http://${host}:8081"

  if curl -fsS -m 5 "${base}/healthz" >/dev/null 2>&1; then

for host in "${hosts[@]}"; do
  echo "== ${host} =="
  base="http://${host}:8081"
  # Control API health
  if curl -fsS "${base}/healthz" >/dev/null 2>&1; then

    ok "control API healthy (:8081/healthz)"
    summary_online["$host"]="yes"
  else
    err "control API not responding on ${host}"
  fi


  status_json=""
  if status_json=$(curl -fsS -m 7 "${auth_curl[@]}" "${base}/status" 2>/dev/null); then
    if command -v jq >/dev/null 2>&1; then
      printf '%s\n' "$status_json" | jq .
    else
      printf '%s\n' "$status_json"
    fi
    current_source=$(printf '%s' "$status_json" | jq -r '.current_source // .source // "?"' 2>/dev/null || printf '?')
    fallback_exists=$(printf '%s' "$status_json" | jq -r '.fallback_exists // false' 2>/dev/null || printf 'false')
    volume_value=$(printf '%s' "$status_json" | jq -r '.volume // empty' 2>/dev/null || printf '')
    stream_up_flag=$(printf '%s' "$status_json" | jq -r '.stream_up // false' 2>/dev/null || printf 'false')
    summary_source["$host"]=$current_source
    if [[ $fallback_exists == "true" ]]; then
      summary_fallback["$host"]="yes"
    elif [[ $fallback_exists == "false" ]]; then
      summary_fallback["$host"]="no"
    fi
    if [[ -n $volume_value ]]; then
      if awk -v v="$volume_value" 'BEGIN { if (v == "") exit 1; if (v+0 == v) exit 0; exit 1 }'; then
        summary_volume["$host"]=$(printf '%.2f' "$volume_value")
      else
        summary_volume["$host"]=$volume_value
      fi
    fi

  # Status JSON (best-effort)
  if curl -fsS "${auth_hdr[@]}" "${base}/status" >/dev/null 2>&1; then
    curl -fsS "${auth_hdr[@]}" "${base}/status" || true
    echo

  else
    warn "cannot fetch /status"
  fi

  if ssh "${ssh_opts[@]}" "${SSH_USER}@${host}" 'aplay -l 2>/dev/null | grep -q "^card"'; then
    ok "ALSA device(s) present"
  else
    warn "no ALSA devices found via SSH (aplay -l)"
  fi

  if (( PLAY_BOTH )); then
    info "requesting stream playback"
    if curl -fsS -m 7 "${auth_curl[@]}" -H 'Content-Type: application/json' -d '{"source":"stream"}' "${base}/play" >/dev/null 2>&1; then
      ok "POST /play (source=stream)"
    else
      err "failed to POST /play on ${host}"
    fi
    sleep 2
    if status_after=$(curl -fsS -m 7 "${auth_curl[@]}" "${base}/status" 2>/dev/null); then
      current_source=$(printf '%s' "$status_after" | jq -r '.current_source // .source // "?"' 2>/dev/null || printf '?')
      stream_up_flag=$(printf '%s' "$status_after" | jq -r '.stream_up // false' 2>/dev/null || printf 'false')
      fallback_exists=$(printf '%s' "$status_after" | jq -r '.fallback_exists // false' 2>/dev/null || printf 'false')
      volume_value=$(printf '%s' "$status_after" | jq -r '.volume // empty' 2>/dev/null || printf '')
      summary_source["$host"]=$current_source
      if [[ $fallback_exists == "true" ]]; then
        summary_fallback["$host"]="yes"
      elif [[ $fallback_exists == "false" ]]; then
        summary_fallback["$host"]="no"
      fi
      if [[ -n $volume_value ]]; then
        if awk -v v="$volume_value" 'BEGIN { if (v == "") exit 1; if (v+0 == v) exit 0; exit 1 }'; then
          summary_volume["$host"]=$(printf '%.2f' "$volume_value")
        else
          summary_volume["$host"]=$volume_value
        fi
      fi
      if [[ $current_source == "stream" || $stream_up_flag == "true" ]]; then
        ok "${host} reports stream playback"
      else
        warn "${host} did not report stream playback after /play"
      fi
    else
      warn "cannot refresh /status after /play"
    fi
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

if [[ -n $ICECAST_URL ]]; then
  if curl -fsI -m 5 "$ICECAST_URL" >/dev/null 2>&1; then
    ok "Icecast mount reachable: ${ICECAST_URL}"
  else
    err "Icecast mount not reachable: ${ICECAST_URL}"
  fi
fi


printf "Summary:\n"
printf "%-22s %-8s %-14s %-10s %-8s\n" "Host" "Online" "Source" "Fallback" "Volume"
  for host in "${HOSTS[@]}"; do
    printf "%-22s %-8s %-14s %-10s %-8s\n" \
      "$host" \
      "${summary_online[$host]}" \
      "${summary_source[$host]}" \
      "${summary_fallback[$host]}" \
      "${summary_volume[$host]}"
  done

exit_code=0
if (( errors > 0 )); then
  exit_code=2
elif (( warnings > 0 )); then
  exit_code=1
fi

case $exit_code in
  0) ok "All checks passed" ;;
  1) warn "Completed with warnings" ;;
  2) err "Completed with errors" ;;
 esac

  exit "$exit_code"

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

