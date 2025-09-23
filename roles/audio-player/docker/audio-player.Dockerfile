FROM python:3.11-alpine3.20

RUN apk add --no-cache ffmpeg alsa-utils inotify-tools jq ca-certificates && \
    update-ca-certificates || true

WORKDIR /app

COPY app/player.py /app/player.py
