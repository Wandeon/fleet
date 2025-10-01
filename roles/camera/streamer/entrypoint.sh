#!/usr/bin/env bash
set -euo pipefail

STREAM_URL=${CAMERA_RTSP_URL:-rtsp://127.0.0.1:8554/camera}
WIDTH=${CAMERA_WIDTH:-1920}
HEIGHT=${CAMERA_HEIGHT:-1080}
FPS=${CAMERA_FRAMERATE:-20}
BITRATE=${CAMERA_BITRATE:-6000000}
AWB=${CAMERA_AWB:-auto}
EXPOSURE=${CAMERA_EXPOSURE:-normal}
RTSP_HOST=$(printf '%s' "$STREAM_URL" | sed -E 's#rtsp://([^/:]+).*#\1#')
RTSP_PORT=$(printf '%s' "$STREAM_URL" | sed -nE 's#rtsp://[^/:]+:([0-9]+).*#\1#p')
RTSP_PORT=${RTSP_PORT:-8554}

wait_for_rtsp() {
  local host="$1" port="$2"
  for _ in $(seq 1 30); do
    if nc -z "$host" "$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "RTSP server $host:$port not reachable" >&2
  return 1
}

wait_for_rtsp "$RTSP_HOST" "$RTSP_PORT"

exec bash -lc "rpicam-vid -t 0 --inline --codec h264 --width $WIDTH --height $HEIGHT --framerate $FPS --bitrate $BITRATE --awb $AWB --exposure $EXPOSURE -o - | ffmpeg -f h264 -i - -c copy -f rtsp $STREAM_URL"