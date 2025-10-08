from __future__ import annotations

import logging
import os
import re
import subprocess
import json
import time
import threading
from typing import Any, Dict, Optional

import docker
from flask import Flask, Response, jsonify, request

from common import clamp, ensure_dir, load_json, save_json

BIND = os.environ.get("CONTROL_BIND", "0.0.0.0")
PORT = int(os.environ.get("CONTROL_PORT", "8081"))
DATA_DIR = os.environ.get("AUDIO_DATA_DIR", "/data")
CFG_PATH = os.path.join(DATA_DIR, "config.json")
STATE_PATH = os.path.join(DATA_DIR, "state.json")
FALLBACK_PATH = os.path.join(DATA_DIR, "fallback.mp3")
TOKEN = os.environ.get("AUTH_TOKEN", "")
MIXER_CARD = os.environ.get("MIXER_CARD", "0")
MIXER_CONTROL = os.environ.get("MIXER_CONTROL", "Master")
DEFAULT_VOLUME = clamp(float(os.environ.get("AUDIO_VOLUME", "0.0")), 0.0, 2.0)  # Start at 0% for testing
DEFAULT_STREAM_URL = os.environ.get("STREAM_URL", "")
DEVICE_ID = os.environ.get("DEVICE_ID", "unknown")
SNAPCAST_SERVER = os.environ.get("SNAPCAST_SERVER", "vps")
SNAPCAST_PORT = int(os.environ.get("SNAPCAST_PORT", "1705"))

VALID_SOURCES = {"stream", "file", "stop"}
VALID_MODES = {"auto", "manual"}

app = Flask(__name__)
app.config["JSONIFY_PRETTYPRINT_REGULAR"] = False

ensure_dir(DATA_DIR)

LOG_PATH = os.path.join(DATA_DIR, "control.log")
_handler = logging.FileHandler(LOG_PATH)
_handler.setLevel(logging.INFO)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
app.logger.addHandler(_handler)
app.logger.setLevel(logging.INFO)
app.logger.propagate = False

# Playback state
class PlaybackMode:
    SNAPCAST = "snapcast"
    FALLBACK = "fallback"
    STOPPED = "stopped"

current_mode = PlaybackMode.STOPPED
snapcast_connected = False
last_mode_switch = time.time()


def load_config() -> Dict[str, Any]:
    defaults: Dict[str, Any] = {
        "stream_url": DEFAULT_STREAM_URL,
        "volume": DEFAULT_VOLUME,
        "mode": "manual",
        "source": "stream",
    }
    return load_json(CFG_PATH, defaults)


def save_config(config: Dict[str, Any]) -> None:
    save_json(CFG_PATH, config)


def load_state() -> Dict[str, Any]:
    defaults: Dict[str, Any] = {
        "now_playing": "stop",
        "fallback_active": False,
        "fallback_exists": False,
        "stream_up": 0,
        "last_switch_timestamp": 0.0,
        "last_error": "",
    }
    return load_json(STATE_PATH, defaults)


def save_state(state: Dict[str, Any]) -> None:
    save_json(STATE_PATH, state)


def docker_container_running(name: str) -> bool:
    """Check if docker container is running."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", f"name={name}", "--format", "{{.Names}}"],
            capture_output=True,
            timeout=2,
            text=True
        )
        return name in result.stdout
    except Exception:
        return False


def docker_container_start(name: str) -> bool:
    """Start docker container."""
    try:
        client = docker.from_env()
        container = client.containers.get(name)
        container.start()
        return True
    except Exception as e:
        app.logger.error(f"Failed to start container {name}: {e}")
        return False


def docker_container_stop(name: str) -> bool:
    """Stop docker container."""
    try:
        client = docker.from_env()
        container = client.containers.get(name)
        container.stop(timeout=10)
        return True
    except Exception as e:
        app.logger.error(f"Failed to stop container {name}: {e}")
        return False


def check_snapcast_connection() -> bool:
    """Check if Snapcast client is connected to server."""
    global snapcast_connected
    try:
        # Use Docker API to exec into snapcast-client container
        client = docker.from_env()
        container = client.containers.get("snapcast-client")
        exit_code, _ = container.exec_run("pgrep snapclient")
        connected = exit_code == 0
        snapcast_connected = connected
        return connected
    except Exception:
        snapcast_connected = False
        return False


def liquidsoap_command(command: str) -> str:
    """Send command to Liquidsoap fallback via telnet."""
    try:
        result = subprocess.run(
            ["docker", "exec", "audio-fallback", "sh", "-c",
             f'echo "{command}" | nc 127.0.0.1 1235'],
            capture_output=True,
            timeout=2,
            text=True
        )
        return result.stdout.strip()
    except Exception as e:
        app.logger.error(f"Liquidsoap command failed: {e}")
        return ""


def start_fallback_mode():
    """Start Liquidsoap fallback container."""
    global current_mode, last_mode_switch

    if current_mode == PlaybackMode.FALLBACK:
        return

    app.logger.info("Network failure detected - switching to fallback mode")

    try:
        # Start fallback container
        if not docker_container_running("audio-fallback"):
            docker_container_start("audio-fallback")
            time.sleep(2)  # Wait for container to fully start

        # Enable playback via Liquidsoap
        liquidsoap_command("var.set enabled = true")

        current_mode = PlaybackMode.FALLBACK
        last_mode_switch = time.time()
        app.logger.info("Fallback mode active - playing local file")

        # Update state
        state = load_state()
        state["fallback_active"] = True
        state["stream_up"] = 0
        state["now_playing"] = "file"
        state["last_switch_timestamp"] = last_mode_switch
        state["last_error"] = "Snapcast disconnected, using fallback"
        save_state(state)

    except Exception as e:
        app.logger.error(f"Failed to start fallback: {e}")


def stop_fallback_mode():
    """Stop Liquidsoap fallback and return to Snapcast."""
    global current_mode, last_mode_switch

    if current_mode != PlaybackMode.FALLBACK:
        return

    app.logger.info("Network restored - switching back to Snapcast")

    try:
        # Disable fallback playback
        liquidsoap_command("var.set enabled = false")
        time.sleep(0.5)

        # Stop fallback container
        if docker_container_running("audio-fallback"):
            docker_container_stop("audio-fallback")

        current_mode = PlaybackMode.SNAPCAST
        last_mode_switch = time.time()
        app.logger.info("Snapcast synchronized mode active")

        # Update state
        state = load_state()
        state["fallback_active"] = False
        state["stream_up"] = 1
        state["now_playing"] = "stream"
        state["last_switch_timestamp"] = last_mode_switch
        state["last_error"] = ""
        save_state(state)

    except Exception as e:
        app.logger.error(f"Failed to stop fallback: {e}")


def monitor_connection():
    """Background thread to monitor Snapcast and switch modes."""
    global current_mode

    consecutive_failures = 0
    FAILURE_THRESHOLD = 3  # 3 seconds before switching

    while True:
        time.sleep(1)

        if current_mode == PlaybackMode.STOPPED:
            consecutive_failures = 0
            continue

        connected = check_snapcast_connection()

        if not connected:
            consecutive_failures += 1
            if consecutive_failures >= FAILURE_THRESHOLD and current_mode == PlaybackMode.SNAPCAST:
                start_fallback_mode()
        else:
            if consecutive_failures > 0:
                app.logger.info(f"Snapcast connection restored (was down {consecutive_failures}s)")
            consecutive_failures = 0

            # Return from fallback to Snapcast
            if current_mode == PlaybackMode.FALLBACK:
                # Wait 5 seconds for stable connection
                time.sleep(5)
                if check_snapcast_connection():
                    stop_fallback_mode()


# Start monitoring thread
monitor_thread = threading.Thread(target=monitor_connection, daemon=True)
monitor_thread.start()


def _authed() -> bool:
    if not TOKEN:
        return True
    auth = request.headers.get("Authorization", "")
    return auth.startswith("Bearer ") and auth.split(" ", 1)[1] == TOKEN


@app.before_request
def require_auth():
    if request.path in ("/healthz", "/status", "/config", "/metrics", "/openapi.yaml"):
        return None
    if not _authed():
        return jsonify({"error": "unauthorized"}), 401
    return None


def _bad_request(message: str):
    return jsonify({"error": message}), 400


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


@app.get("/status")
def get_status():
    """Get device playback status."""
    cfg = load_config()
    fallback_exists = os.path.exists(FALLBACK_PATH)

    response = {
        "mode": current_mode,
        "snapcast_connected": snapcast_connected,
        "fallback_exists": fallback_exists,
        "volume": cfg.get("volume", DEFAULT_VOLUME),
        "device_id": DEVICE_ID,
        "snapcast_server": SNAPCAST_SERVER,
        "now_playing": current_mode,
        "fallback_active": (current_mode == PlaybackMode.FALLBACK),
        "stream_up": 1 if snapcast_connected else 0,
        "last_switch_timestamp": last_mode_switch,
        "stream_url": cfg.get("stream_url", DEFAULT_STREAM_URL),
    }

    return jsonify(response)


@app.get("/config")
def get_config():
    return jsonify(load_config())


@app.put("/config")
def put_config():
    cfg = load_config()
    data = request.get_json(force=True) or {}
    if not isinstance(data, dict):
        return _bad_request("invalid payload")

    updated = False

    if "stream_url" in data:
        value = data.get("stream_url")
        if value is None:
            cfg.pop("stream_url", None)
        elif not isinstance(value, str):
            return _bad_request("stream_url must be a string")
        else:
            cfg["stream_url"] = value
        updated = True

    if "volume" in data:
        try:
            volume = float(data.get("volume"))
        except Exception:
            return _bad_request("volume must be numeric")
        volume = clamp(volume, 0.0, 2.0)
        cfg["volume"] = volume

        # Update fallback volume for when in fallback mode
        liquidsoap_command(f"var.set volume = {volume}")
        updated = True

    if "mode" in data:
        mode = str(data.get("mode", "")).lower()
        if mode not in VALID_MODES:
            return _bad_request("mode must be 'auto' or 'manual'")
        cfg["mode"] = mode
        updated = True

    if "source" in data:
        source = str(data.get("source", "")).lower()
        if source not in VALID_SOURCES:
            return _bad_request("source must be 'stream', 'file', or 'stop'")
        cfg["source"] = source
        updated = True

    if not updated:
        return _bad_request("no supported fields supplied")

    save_config(cfg)
    app.logger.info("PUT /config -> %s", data)
    return jsonify(cfg)


@app.post("/volume")
def post_volume():
    """Set playback volume."""
    data = request.get_json(force=True) or {}
    if "volume" not in data:
        return _bad_request("volume is required")
    try:
        value = float(data.get("volume"))
    except Exception:
        return _bad_request("volume must be numeric")

    value = clamp(value, 0.0, 2.0)

    # Update fallback volume
    liquidsoap_command(f"var.set volume = {value}")

    cfg = load_config()
    cfg["volume"] = value
    save_config(cfg)

    app.logger.info(f"Volume set to {value}")
    return jsonify(cfg)


@app.post("/play")
def post_play():
    """Start playback (Snapcast synchronized mode)."""
    global current_mode

    data = request.get_json(force=True) or {}
    source = str(data.get("source", "stream")).lower()

    if source not in {"stream", "file"}:
        return _bad_request("source must be 'stream' or 'file'")

    current_mode = PlaybackMode.SNAPCAST

    cfg = load_config()
    cfg["source"] = source
    save_config(cfg)

    # Update state
    state = load_state()
    state["now_playing"] = "stream"
    state["stream_up"] = 1 if snapcast_connected else 0
    state["fallback_active"] = False
    save_state(state)

    app.logger.info("Playback started (Snapcast synchronized)")
    return jsonify({"status": "playing", "mode": "snapcast"})


@app.post("/stop")
def post_stop():
    """Stop playback."""
    global current_mode

    # Stop fallback if active
    if current_mode == PlaybackMode.FALLBACK:
        stop_fallback_mode()

    current_mode = PlaybackMode.STOPPED

    cfg = load_config()
    cfg["source"] = "stop"
    save_config(cfg)

    # Update state
    state = load_state()
    state["now_playing"] = "stop"
    state["stream_up"] = 0
    state["fallback_active"] = False
    save_state(state)

    app.logger.info("Playback stopped")
    return jsonify({"status": "stopped"})


@app.post("/upload")
def post_upload():
    """Upload fallback file."""
    if "file" not in request.files:
        return _bad_request("missing file")

    file_obj = request.files["file"]
    ensure_dir(DATA_DIR)
    file_obj.save(FALLBACK_PATH)

    try:
        size = os.path.getsize(FALLBACK_PATH)
    except Exception:
        size = 0

    app.logger.info("POST /upload -> saved fallback (%s bytes)", size)
    return jsonify({"saved": True, "path": FALLBACK_PATH, "size": size})


@app.get("/healthz")
def healthz():
    return "ok"


def _amixer_cmd(*args: str) -> list[str]:
    return ["amixer", "-c", str(MIXER_CARD), *args]


@app.get("/hwvolume")
def get_hwvolume():
    try:
        output = subprocess.check_output(_amixer_cmd("get", MIXER_CONTROL), text=True)
        match = re.search(r"\[(\d+)%\]", output)
        volume = int(match.group(1)) if match else None
    except Exception:
        volume = None
    return jsonify({"mixer_card": int(MIXER_CARD), "mixer_control": MIXER_CONTROL, "volume_percent": volume})


@app.post("/hwvolume")
def post_hwvolume():
    data = request.get_json(force=True) or {}
    try:
        value = int(data.get("volume_percent", 100))
    except Exception:
        return _bad_request("volume_percent must be numeric")

    value = max(0, min(100, value))

    try:
        subprocess.check_call(_amixer_cmd("set", MIXER_CONTROL, f"{value}%"))
    except Exception as exc:
        return str(exc), 500

    app.logger.info("POST /hwvolume -> %s%%", value)
    return jsonify({"ok": True, "volume_percent": value})


@app.get("/metrics")
def get_metrics():
    """Prometheus metrics endpoint."""
    cfg = load_config()
    fallback_exists = os.path.exists(FALLBACK_PATH)
    volume = cfg.get("volume", DEFAULT_VOLUME)

    lines = []

    # Audio volume
    lines.append("# HELP audio_volume Software volume (0.0-2.0)")
    lines.append("# TYPE audio_volume gauge")
    lines.append(f"audio_volume {volume}")

    # Fallback file exists
    lines.append("# HELP audio_fallback_exists Whether fallback file exists on disk")
    lines.append("# TYPE audio_fallback_exists gauge")
    lines.append(f"audio_fallback_exists {1 if fallback_exists else 0}")

    # Fallback active
    lines.append("# HELP audio_fallback_active Indicates fallback playback is active")
    lines.append("# TYPE audio_fallback_active gauge")
    lines.append(f"audio_fallback_active {1 if current_mode == PlaybackMode.FALLBACK else 0}")

    # Stream up
    lines.append("# HELP audio_stream_up Indicates if synchronized stream is active")
    lines.append("# TYPE audio_stream_up gauge")
    lines.append(f"audio_stream_up {1 if snapcast_connected else 0}")

    # NEW: Snapcast connection
    lines.append("# HELP snapcast_connected Indicates if Snapcast client is connected to server")
    lines.append("# TYPE snapcast_connected gauge")
    lines.append(f"snapcast_connected {1 if snapcast_connected else 0}")

    # NEW: Buffer seconds (for Snapcast, typically 1s)
    buffer_seconds = 1.0 if snapcast_connected else 0.0
    lines.append("# HELP audio_buffer_seconds Current audio buffer depth in seconds")
    lines.append("# TYPE audio_buffer_seconds gauge")
    lines.append(f"audio_buffer_seconds {buffer_seconds}")

    # Playback mode state
    lines.append("# HELP audio_mode_state Current playback mode")
    lines.append("# TYPE audio_mode_state gauge")
    for mode in ["snapcast", "fallback", "stopped"]:
        lines.append(f"audio_mode_state{{mode=\"{mode}\"}} {1 if current_mode == mode else 0}")

    # Last switch timestamp
    lines.append("# HELP audio_last_switch_timestamp Unix timestamp of last mode switch")
    lines.append("# TYPE audio_last_switch_timestamp gauge")
    lines.append(f"audio_last_switch_timestamp {last_mode_switch}")

    return Response("\n".join(lines) + "\n", mimetype="text/plain")


@app.get("/openapi.yaml")
def openapi_spec():
    """Serve OpenAPI specification."""
    device_id = os.environ.get("DEVICE_ID", "")

    if device_id:
        spec_filename = f"openapi-{device_id}.yaml"
    else:
        spec_filename = "openapi.yaml"

    spec_path = os.path.join(os.path.dirname(__file__), spec_filename)

    if not os.path.exists(spec_path):
        spec_path = os.path.join(os.path.dirname(__file__), "openapi.yaml")

    try:
        with open(spec_path, "r", encoding="utf-8") as f:
            spec_content = f.read()
        return Response(spec_content, mimetype="text/yaml")
    except FileNotFoundError:
        return jsonify({"error": "OpenAPI spec not found"}), 404


def main() -> None:
    if not os.path.exists(CFG_PATH):
        save_config(load_config())
    if not os.path.exists(STATE_PATH):
        save_state(load_state())

    app.logger.info("audio-control (Snapcast mode) starting on %s:%s", BIND, PORT)
    app.logger.info("Device ID: %s, Snapcast server: %s:%s", DEVICE_ID, SNAPCAST_SERVER, SNAPCAST_PORT)
    app.run(host=BIND, port=PORT)


if __name__ == "__main__":
    main()
