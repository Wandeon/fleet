#!/usr/bin/env bash
set -euo pipefail

# Simple controller for audio-player API
# Usage:
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh status
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh volume 0.8
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh play stream
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh play file
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh stop
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh set-url http://<vps>:8000/<mount>
#   AUDIOCTL_HOST=100.x.y.z AUDIOCTL_TOKEN=token ./scripts/audioctl.sh upload /path/to/fallback.mp3

HOST=${AUDIOCTL_HOST:-}
TOKEN=${AUDIOCTL_TOKEN:-}
BASE="http://${HOST}:8081"

hdr(){
  if [[ -n "$TOKEN" ]]; then
    echo -H "Authorization: Bearer ${TOKEN}"
  fi
}

cmd=${1:-}
case "$cmd" in
  status)
    curl -sS $(hdr) "$BASE/status" | jq .
    ;;
  volume)
    v=${2:-1.0}
    curl -sS $(hdr) -H 'Content-Type: application/json' -d "{\"volume\":$v}" "$BASE/volume" | jq .
    ;;
  play)
    src=${2:-stream}
    curl -sS $(hdr) -H 'Content-Type: application/json' -d "{\"source\":\"$src\"}" "$BASE/play" | jq .
    ;;
  stop)
    curl -sS $(hdr) -X POST "$BASE/stop"
    ;;
  set-url)
    url=${2:?usage set-url <url>}
    curl -sS $(hdr) -X PUT -H 'Content-Type: application/json' -d "{\"stream_url\":\"$url\"}" "$BASE/config" | jq .
    ;;
  upload)
    file=${2:?usage upload <file>}
    curl -sS $(hdr) -F "file=@${file}" "$BASE/upload" | jq .
    ;;
  *)
    echo "usage: AUDIOCTL_HOST=host [AUDIOCTL_TOKEN=tok] $0 {status|volume <v>|play <stream|file>|stop|set-url <url>|upload <file>}" >&2
    exit 1
    ;;
esac

