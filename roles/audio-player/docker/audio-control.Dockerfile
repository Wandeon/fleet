FROM python:3.11-alpine3.20

RUN apk add --no-cache alsa-utils ca-certificates && \
    update-ca-certificates || true

RUN python3 -m pip install --no-cache-dir \
      flask==3.0.3 itsdangerous==2.2.0 jinja2==3.1.4 werkzeug==3.0.3 click==8.1.7 blinker==1.8.2

WORKDIR /app

COPY docker/app/common.py /app/common.py
COPY docker/app/control.py /app/control.py
COPY openapi.yaml /app/openapi.yaml
COPY openapi-audio-01.yaml /app/openapi-audio-01.yaml
COPY openapi-audio-02.yaml /app/openapi-audio-02.yaml
