import os
import json
import socket
import subprocess
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import PlainTextResponse
from prometheus_client import Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST


MEDIA_CONTROL_TOKEN = os.environ.get("MEDIA_CONTROL_TOKEN", "")
MPV_SOCKET = os.environ.get("MPV_SOCKET", "/run/mpv.sock")

app = FastAPI(title="HDMI Media Control")

reg = CollectorRegistry()
g_playing = Gauge("media_playing", "MPV playing state (1=playing,0=paused/stopped)", registry=reg)


def check_auth(authorization: Optional[str]):
    if not MEDIA_CONTROL_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization.split(" ", 1)[1]
    if token != MEDIA_CONTROL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")


def mpv_command(cmd: dict):
    data = (json.dumps(cmd) + "\n").encode("utf-8")
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        s.connect(MPV_SOCKET)
        s.sendall(data)
        try:
            resp = s.recv(4096)
        except socket.timeout:
            resp = b""
    return resp


def mpv_set(property_name: str, value):
    return mpv_command({"command": ["set_property", property_name, value]})


def mpv_get(property_name: str):
    return mpv_command({"command": ["get_property", property_name]})


def cec(*args: str) -> int:
    try:
        return subprocess.call(["cec-ctl", *args])
    except FileNotFoundError:
        return 127


@app.get("/healthz", response_class=PlainTextResponse)
def healthz():
    return "ok"


@app.get("/metrics")
def metrics():
    try:
        state = json.loads(mpv_get("pause").decode("utf-8"))
        paused = state.get("data", False)
        g_playing.set(0.0 if paused else 1.0)
    except Exception:
        g_playing.set(0.0)
    output = generate_latest(reg)
    return PlainTextResponse(content=output, media_type=CONTENT_TYPE_LATEST)


@app.get("/status")
def status(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    out = {}
    try:
        out["pause"] = json.loads(mpv_get("pause").decode("utf-8")).get("data")
        out["time_pos"] = json.loads(mpv_get("time-pos").decode("utf-8")).get("data")
        out["duration"] = json.loads(mpv_get("duration").decode("utf-8")).get("data")
        out["volume"] = json.loads(mpv_get("volume").decode("utf-8")).get("data")
        out["path"] = json.loads(mpv_get("path").decode("utf-8")).get("data")
    except Exception:
        pass
    return out


@app.post("/play")
def play(payload: dict, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    url = payload.get("url")
    start = payload.get("start")
    if not url:
        raise HTTPException(400, "missing url")
    mpv_command({"command": ["loadfile", url, "replace"]})
    if start is not None:
        mpv_command({"command": ["seek", float(start), "absolute"]})
    mpv_set("pause", False)
    return {"ok": True}


@app.post("/pause")
def pause(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    mpv_set("pause", True)
    return {"ok": True}


@app.post("/resume")
def resume(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    mpv_set("pause", False)
    return {"ok": True}


@app.post("/stop")
def stop(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    mpv_command({"command": ["stop"]})
    return {"ok": True}


@app.post("/seek")
def seek(payload: dict, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    seconds = float(payload.get("seconds", 0))
    mpv_command({"command": ["seek", seconds, "relative"]})
    return {"ok": True}


@app.post("/volume")
def volume(payload: dict, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    v = max(0, min(100, int(payload.get("volume", 100))))
    mpv_set("volume", v)
    return {"ok": True, "volume": v}


@app.post("/tv/power_on")
def tv_power_on(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    rc = cec("-s", "-d1", "--to", "0", "--image-view-on")
    return {"ok": rc == 0}


@app.post("/tv/power_off")
def tv_power_off(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    rc = cec("-s", "-d1", "--to", "0", "--standby")
    return {"ok": rc == 0}


@app.post("/tv/input")
def tv_input(payload: dict = None, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    # For simplicity, mark this device as active source
    rc = cec("-s", "-d1", "--to", "0", "--active-source")
    return {"ok": rc == 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)

