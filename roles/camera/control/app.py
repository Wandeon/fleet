import os
import time
import socket
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import PlainTextResponse
from prometheus_client import (
    CollectorRegistry,
    Gauge,
    CONTENT_TYPE_LATEST,
    generate_latest,
)


CAMERA_CONTROL_TOKEN = os.environ.get("CAMERA_CONTROL_TOKEN", "")
CAMERA_HLS_URL = os.environ.get(
    "CAMERA_HLS_URL", "http://127.0.0.1:8888/camera/index.m3u8"
)
CAMERA_RTSP_URL = os.environ.get(
    "CAMERA_RTSP_URL", "rtsp://127.0.0.1:8554/camera"
)
PROBE_TIMEOUT = float(os.environ.get("CAMERA_PROBE_TIMEOUT", "2.5"))
PROBE_CACHE_SECONDS = float(os.environ.get("CAMERA_PROBE_CACHE_SECONDS", "10"))

_rtsp = urlparse(CAMERA_RTSP_URL)
RTSP_HOST = _rtsp.hostname or "127.0.0.1"
RTSP_PORT = _rtsp.port or 8554

app = FastAPI(title="Camera Control")

registry = CollectorRegistry()
g_stream_up = Gauge(
    "camera_stream_online", "Camera HLS stream availability (1=up)", registry=registry
)
g_probe_duration = Gauge(
    "camera_probe_duration_seconds",
    "Seconds taken to probe the camera stream",
    registry=registry,
)
g_last_probe = Gauge(
    "camera_last_probe_timestamp_seconds",
    "Unix timestamp of last probe",
    registry=registry,
)
g_last_success = Gauge(
    "camera_last_success_timestamp_seconds",
    "Unix timestamp of last successful probe",
    registry=registry,
)
g_rtsp_reachable = Gauge(
    "camera_rtsp_reachable",
    "RTSP TCP port reachable (1=yes)",
    registry=registry,
)

_last_probe_cache: Optional[dict[str, object]] = None
_last_success_ts = 0.0


def check_auth(header: Optional[str]):
    if not CAMERA_CONTROL_TOKEN:
        return
    if not header or not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = header.split(" ", 1)[1]
    if token != CAMERA_CONTROL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")


def probe_rtsp() -> bool:
    try:
        with socket.create_connection((RTSP_HOST, RTSP_PORT), timeout=1.5):
            return True
    except OSError:
        return False


async def perform_probe() -> dict:
    global _last_success_ts

    started = time.monotonic()
    ts = time.time()
    ok = False
    preview: list[str] = []
    error: Optional[str] = None

    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            resp = await client.get(
                CAMERA_HLS_URL,
                headers={"User-Agent": "camera-control/1.0"},
            )
            resp.raise_for_status()
            text = resp.text
            preview = text.splitlines()[:5]
            ok = True
    except Exception as exc:
        error = str(exc)
        ok = False

    duration = time.monotonic() - started
    g_probe_duration.set(duration)
    g_last_probe.set(ts)

    rtsp_ok = probe_rtsp()
    g_rtsp_reachable.set(1.0 if rtsp_ok else 0.0)

    if ok:
        _last_success_ts = ts
        g_stream_up.set(1.0)
    else:
        g_stream_up.set(0.0)

    if _last_success_ts:
        g_last_success.set(_last_success_ts)

    result = {
        "ok": ok,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts)),
        "duration": duration,
        "hls_url": CAMERA_HLS_URL,
        "rtsp_url": CAMERA_RTSP_URL,
        "rtsp_reachable": rtsp_ok,
        "preview": preview,
        "error": error,
        "last_success": (
            time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(_last_success_ts))
            if _last_success_ts
            else None
        ),
        "cached": False,
    }
    return result


async def probe(force: bool = False) -> dict:
    global _last_probe_cache
    now = time.time()
    if not force and _last_probe_cache:
        ts_val = _last_probe_cache.get("ts")
        cached_result = _last_probe_cache.get("result")
        if (
            isinstance(ts_val, (int, float))
            and isinstance(cached_result, dict)
            and now - ts_val < PROBE_CACHE_SECONDS
        ):
            cached = cached_result.copy()
            cached["cached"] = True
            return cached

    result = await perform_probe()
    _last_probe_cache = {"ts": now, "result": result}
    return result


@app.get("/healthz", response_class=PlainTextResponse)
async def healthz():
    result = await probe(force=False)
    if result.get("ok"):
        return "ok"
    raise HTTPException(status_code=503, detail="stream_unavailable")


@app.get("/metrics")
async def metrics():
    await probe(force=False)
    output = generate_latest(registry)
    return PlainTextResponse(content=output, media_type=CONTENT_TYPE_LATEST)


@app.get("/status")
async def status(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    result = await probe(force=False)
    return result


@app.post("/probe")
async def manual_probe(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    result = await probe(force=True)
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8083)
