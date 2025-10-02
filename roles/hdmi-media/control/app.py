import os
import json
import socket
import subprocess
import logging
from pathlib import Path
from typing import Optional, Tuple

from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse, JSONResponse
from prometheus_client import Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST


MEDIA_CONTROL_TOKEN = os.environ.get("MEDIA_CONTROL_TOKEN", "")
MPV_SOCKET = os.environ.get("MPV_SOCKET", "/run/mpv.sock")
VIDEO_DATA_DIR = os.environ.get("VIDEO_DATA_DIR", "/data")
VIDEO_LIBRARY_DIR = Path(VIDEO_DATA_DIR) / "library"

logger = logging.getLogger("hdmi-media.control")

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


def resolve_cec_device() -> Tuple[str, Path]:
    idx = "1" if str(os.environ.get("CEC_DEVICE_INDEX", "0")) == "1" else "0"
    primary_path = Path(f"/dev/cec{idx}")
    if primary_path.exists():
        return idx, primary_path
    fallback_idx = "0" if idx == "1" else "1"
    fallback_path = Path(f"/dev/cec{fallback_idx}")
    if fallback_path.exists():
        logger.warning(
            "Configured CEC device /dev/cec%s missing; falling back to /dev/cec%s",
            idx,
            fallback_idx,
        )
        return fallback_idx, fallback_path
    return idx, primary_path


def cec(*args: str) -> int:
    idx, device_path = resolve_cec_device()
    cmd = ["cec-ctl", f"-d{idx}", *args]
    cmd_str = " ".join(cmd)
    if not device_path.exists():
        logger.error("CEC device %s not present; command skipped: %s", device_path, cmd_str)
        return 1
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return 0
    except FileNotFoundError:
        logger.error("cec-ctl binary not found on PATH")
        return 127
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else ""
        if stderr:
            logger.error("cec-ctl failed (rc=%s): %s", exc.returncode, stderr.strip())
        else:
            logger.error("cec-ctl failed (rc=%s)", exc.returncode)
        return exc.returncode


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
    rc = cec("--to", "0", "--image-view-on")
    return {"ok": rc == 0}


@app.post("/tv/power_off")
def tv_power_off(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    rc = cec("--to", "0", "--standby")
    return {"ok": rc == 0}


@app.post("/tv/input")
def tv_input(payload: dict = None, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    rc = cec("--to", "0", "--active-source", "phys-addr=0.0.0.0")
    return {"ok": rc == 0}


@app.get("/library")
def list_library(Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)
    VIDEO_LIBRARY_DIR.mkdir(parents=True, exist_ok=True)

    videos = []
    for video_file in VIDEO_LIBRARY_DIR.glob("*"):
        if video_file.is_file() and video_file.suffix.lower() in ['.mp4', '.mkv', '.avi', '.mov', '.webm']:
            videos.append({
                "filename": video_file.name,
                "path": str(video_file),
                "size": video_file.stat().st_size,
            })

    return {"videos": videos}


@app.post("/library/upload")
async def upload_video(file: UploadFile = File(...), Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)

    if not file.filename:
        raise HTTPException(400, "missing filename")

    # Validate file extension
    allowed_extensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm']
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(400, f"invalid file type, allowed: {', '.join(allowed_extensions)}")

    VIDEO_LIBRARY_DIR.mkdir(parents=True, exist_ok=True)

    # Save file
    file_path = VIDEO_LIBRARY_DIR / file.filename
    try:
        with open(file_path, "wb") as f:
            while chunk := await file.read(8192):
                f.write(chunk)

        return {
            "ok": True,
            "filename": file.filename,
            "path": str(file_path),
            "size": file_path.stat().st_size,
        }
    except Exception as e:
        logger.error(f"Failed to upload video: {e}")
        raise HTTPException(500, f"upload failed: {str(e)}")


@app.delete("/library/{filename}")
def delete_video(filename: str, Authorization: Optional[str] = Header(None)):
    check_auth(Authorization)

    file_path = VIDEO_LIBRARY_DIR / filename

    if not file_path.exists():
        raise HTTPException(404, "video not found")

    if not file_path.is_relative_to(VIDEO_LIBRARY_DIR):
        raise HTTPException(400, "invalid filename")

    try:
        file_path.unlink()
        return {"ok": True, "deleted": filename}
    except Exception as e:
        logger.error(f"Failed to delete video: {e}")
        raise HTTPException(500, f"delete failed: {str(e)}")


@app.get("/openapi.yaml")
def openapi_spec():
    """Serve OpenAPI specification for API documentation and testing."""
    from pathlib import Path
    from fastapi.responses import PlainTextResponse

    spec_path = Path(__file__).parent / "openapi.yaml"
    try:
        return PlainTextResponse(spec_path.read_text(), media_type="text/yaml")
    except FileNotFoundError:
        return {"error": "OpenAPI spec not found"}, 404


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8082)
