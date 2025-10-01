FROM debian:bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://archive.raspberrypi.com/debian/raspberrypi.gpg.key \
         | gpg --dearmor -o /etc/apt/keyrings/raspberrypi-archive-keyring.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/raspberrypi-archive-keyring.gpg arch=arm64] http://archive.raspberrypi.com/debian/ bookworm main" \
         > /etc/apt/sources.list.d/raspi.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends rpicam-apps ffmpeg jq netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV CAMERA_RTSP_URL="rtsp://127.0.0.1:8554/camera" \
    CAMERA_WIDTH="1920" \
    CAMERA_HEIGHT="1080" \
    CAMERA_FRAMERATE="20" \
    CAMERA_BITRATE="6000000" \
    CAMERA_AWB="auto" \
    CAMERA_EXPOSURE="normal"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]