FROM python:3.11-alpine3.20

RUN apk add --no-cache ffmpeg alsa-utils inotify-tools jq ca-certificates && \
    update-ca-certificates || true

# Player script is written at runtime by the compose command script.
