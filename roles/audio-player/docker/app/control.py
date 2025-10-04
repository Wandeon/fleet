from __future__ import annotations

import logging
import os
import re
import subprocess
from typing import Any, Dict

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
DEFAULT_VOLUME = clamp(float(os.environ.get("AUDIO_VOLUME", "1.0")), 0.0, 2.0)
DEFAULT_STREAM_URL = os.environ.get("STREAM_URL", "")

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


def _authed() -> bool:
    if not TOKEN:
        return True
    auth = request.headers.get("Authorization", "")
    return auth.startswith("Bearer ") and auth.split(" ", 1)[1] == TOKEN


@app.before_request
def require_auth():
    # Allow unauthenticated access to read-only monitoring endpoints
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
    cfg = load_config()
    state = load_state()
    fallback_exists = os.path.exists(FALLBACK_PATH) or bool(state.get("fallback_exists"))
    now_playing = state.get("now_playing", cfg.get("source", "stream"))
    response: Dict[str, Any] = dict(cfg)
    response["requested_source"] = cfg.get("source")
    response["fallback_exists"] = bool(fallback_exists)
    response["now_playing"] = now_playing
    response["fallback_active"] = bool(state.get("fallback_active", now_playing == "file"))
    response["stream_up"] = 1 if state.get("stream_up") else 0
    response["last_switch_timestamp"] = float(state.get("last_switch_timestamp", 0.0))
    last_error = state.get("last_error")
    if last_error:
        response["last_error"] = last_error
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
    data = request.get_json(force=True) or {}
    if "volume" not in data:
        return _bad_request("volume is required")
    try:
        value = float(data.get("volume"))
    except Exception:
        return _bad_request("volume must be numeric")
    value = clamp(value, 0.0, 2.0)
    cfg = load_config()
    cfg["volume"] = value
    save_config(cfg)
    app.logger.info("POST /volume -> %.2f", value)
    return jsonify(cfg)


@app.post("/play")
def post_play():
    data = request.get_json(force=True) or {}
    source = str(data.get("source", "stream")).lower()
    if source not in {"stream", "file"}:
        return _bad_request("source must be 'stream' or 'file'")
    cfg = load_config()
    cfg["source"] = source
    if "mode" in data:
        mode = str(data.get("mode", "")).lower()
        if mode not in VALID_MODES:
            return _bad_request("mode must be 'auto' or 'manual'")
        cfg["mode"] = mode
    save_config(cfg)
    app.logger.info("POST /play -> source=%s mode=%s", cfg.get("source"), cfg.get("mode"))
    return jsonify(cfg)


@app.post("/stop")
def post_stop():
    cfg = load_config()
    cfg["source"] = "stop"
    save_config(cfg)
    app.logger.info("POST /stop -> stop")
    return jsonify(cfg)


@app.post("/upload")
def post_upload():
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
    cfg = load_config()
    state = load_state()
    fallback_exists = os.path.exists(FALLBACK_PATH) or bool(state.get("fallback_exists"))
    now_playing = state.get("now_playing", cfg.get("source", "stop"))
    fallback_active = 1 if state.get("fallback_active") or now_playing == "file" else 0
    stream_up = 1 if state.get("stream_up") else 0
    last_switch = float(state.get("last_switch_timestamp", 0.0))
    last_error = state.get("last_error", "")
    mode = str(cfg.get("mode", "manual")).lower()
    requested = str(cfg.get("source", "stream")).lower()
    try:
        volume = float(cfg.get("volume", DEFAULT_VOLUME))
    except Exception:
        volume = DEFAULT_VOLUME
    volume = clamp(volume, 0.0, 2.0)

    lines = []
    lines.append("# HELP audio_volume Software volume (0.0-2.0)")
    lines.append("# TYPE audio_volume gauge")
    lines.append(f"audio_volume {volume}")
    lines.append("# HELP audio_fallback_exists Whether fallback file exists on disk")
    lines.append("# TYPE audio_fallback_exists gauge")
    lines.append(f"audio_fallback_exists {1 if fallback_exists else 0}")
    lines.append("# HELP audio_fallback_active Indicates fallback playback is active")
    lines.append("# TYPE audio_fallback_active gauge")
    lines.append(f"audio_fallback_active {fallback_active}")
    lines.append("# HELP audio_stream_up Indicates if the stream playback is active")
    lines.append("# TYPE audio_stream_up gauge")
    lines.append(f"audio_stream_up {stream_up}")
    lines.append("# HELP audio_last_switch_timestamp Unix timestamp of the last playback source switch")
    lines.append("# TYPE audio_last_switch_timestamp gauge")
    lines.append(f"audio_last_switch_timestamp {last_switch}")
    lines.append("# HELP audio_source_state Requested playback source selection")
    lines.append("# TYPE audio_source_state gauge")
    for src in ("stream", "file", "stop"):
        lines.append(f"audio_source_state{{source=\"{src}\"}} {1 if requested == src else 0}")
    lines.append("# HELP audio_now_playing_state Current playback state reported by the player loop")
    lines.append("# TYPE audio_now_playing_state gauge")
    for src in ("stream", "file", "stop"):
        lines.append(f"audio_now_playing_state{{state=\"{src}\"}} {1 if now_playing == src else 0}")
    lines.append("# HELP audio_mode_state Requested playback mode selector")
    lines.append("# TYPE audio_mode_state gauge")
    for mode_name in ("auto", "manual"):
        lines.append(f"audio_mode_state{{mode=\"{mode_name}\"}} {1 if mode == mode_name else 0}")
    lines.append("# HELP audio_player_state_info Info metric capturing the last player error message")
    lines.append("# TYPE audio_player_state_info gauge")
    lines.append(f"audio_player_state_info{{last_error=\"{_escape_label(last_error or '')}\"}} 1")
    return Response("\n".join(lines) + "\n", mimetype="text/plain")


@app.get("/openapi.yaml")
def openapi_spec():
    """Serve OpenAPI specification for API documentation and testing."""
    device_id = os.environ.get("DEVICE_ID", "")

    # Try device-specific spec first, fall back to generic
    if device_id:
        spec_filename = f"openapi-{device_id}.yaml"
    else:
        spec_filename = "openapi.yaml"

    spec_path = os.path.join(os.path.dirname(__file__), spec_filename)

    # Fall back to generic spec if device-specific not found
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
    app.logger.info("audio-control starting on %s:%s", BIND, PORT)
    app.run(host=BIND, port=PORT)


if __name__ == "__main__":
    main()
