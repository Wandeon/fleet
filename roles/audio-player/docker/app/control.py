#!/usr/bin/env python3
"""Audio control API for Fleet audio-player role."""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from typing import Any, Dict, Optional, Tuple

from flask import Flask, Response, jsonify, request

BIND = os.environ.get("CONTROL_BIND", "0.0.0.0")
PORT = int(os.environ.get("CONTROL_PORT", "8081"))
DATA_DIR = os.environ.get("AUDIO_DATA_DIR", "/data")
CFG_PATH = os.path.join(DATA_DIR, "config.json")
STATUS_PATH = os.path.join(DATA_DIR, "status.json")
FALLBACK_PATH = os.path.join(DATA_DIR, "fallback.mp3")
TOKEN = os.environ.get("AUTH_TOKEN", "")
MIXER_CARD = os.environ.get("MIXER_CARD", "0")
MIXER_CONTROL = os.environ.get("MIXER_CONTROL", "Master")
OUTPUT_DEVICE = os.environ.get("AUDIO_OUTPUT_DEVICE", "hw:0,0")
DEFAULT_STREAM_URL = os.environ.get("STREAM_URL", "")
DEFAULT_VOLUME_ENV = os.environ.get("AUDIO_VOLUME", "1.0")

try:
    DEFAULT_VOLUME = float(DEFAULT_VOLUME_ENV)
except ValueError:
    DEFAULT_VOLUME = 1.0

VALID_SOURCES = {"stream", "file", "stop"}
VALID_MODES = {"auto", "manual"}

app = Flask(__name__)


def clamp_volume(value: Any) -> float:
    try:
        vol = float(value)
    except (TypeError, ValueError):
        vol = DEFAULT_VOLUME
    return max(0.0, min(2.0, vol))


def base_config() -> Dict[str, Any]:
    return {
        "stream_url": DEFAULT_STREAM_URL,
        "volume": DEFAULT_VOLUME,
        "mode": "auto",
        "source": "stream",
    }


def load_config() -> Dict[str, Any]:
    cfg = base_config()
    try:
        with open(CFG_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                cfg.update(data)
    except FileNotFoundError:
        pass
    except json.JSONDecodeError:
        pass

    cfg["volume"] = clamp_volume(cfg.get("volume"))
    if cfg.get("mode") not in VALID_MODES:
        cfg["mode"] = "auto"
    if cfg.get("source") not in VALID_SOURCES:
        cfg["source"] = "stream"
    if not isinstance(cfg.get("stream_url"), str):
        cfg["stream_url"] = DEFAULT_STREAM_URL
    return cfg


def save_config(cfg: Dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp_path = CFG_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh)
    os.replace(tmp_path, CFG_PATH)


def read_status() -> Dict[str, Any]:
    try:
        with open(STATUS_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except FileNotFoundError:
        pass
    except json.JSONDecodeError:
        pass
    return {}


def _authed() -> bool:
    if not TOKEN:
        return True
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False
    token = auth_header.split(" ", 1)[1]
    return token == TOKEN


EXEMPT_PATHS = {"/healthz"}


@app.before_request
def _guard() -> Optional[Tuple[str, int]]:
    if request.method == "OPTIONS":
        return None
    if request.path in EXEMPT_PATHS:
        return None
    if not _authed():
        return ("unauthorized", 401)
    return None


def update_config_fields(updates: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[Tuple[str, int]]]:
    cfg = load_config()
    changed = False

    if "stream_url" in updates:
        value = updates.get("stream_url")
        cfg["stream_url"] = "" if value is None else str(value)
        changed = True

    if "volume" in updates:
        cfg["volume"] = clamp_volume(updates.get("volume"))
        changed = True

    if "mode" in updates:
        mode = str(updates.get("mode"))
        if mode not in VALID_MODES:
            return cfg, ("invalid mode", 400)
        cfg["mode"] = mode
        changed = True

    if "source" in updates:
        source = str(updates.get("source"))
        if source not in VALID_SOURCES:
            return cfg, ("invalid source", 400)
        cfg["source"] = source
        changed = True

    if changed:
        save_config(cfg)
    return cfg, None


def status_payload() -> Dict[str, Any]:
    cfg = load_config()
    status = read_status()
    fallback_exists = bool(status.get("fallback_exists")) or os.path.exists(FALLBACK_PATH)
    now = time.time()
    response = dict(cfg)
    response["fallback_exists"] = fallback_exists
    response["current_source"] = status.get("current_source", cfg["source"])
    response["target_state"] = status.get("target_state", cfg["source"])
    response["stream_up"] = bool(status.get("stream_up", 0))
    response["fallback_active"] = bool(status.get("fallback_active", 0))
    response["last_switch_timestamp"] = status.get("last_switch_timestamp")
    ts = status.get("timestamp")
    response["status_age_seconds"] = (
        max(0.0, now - float(ts)) if isinstance(ts, (int, float)) else None
    )
    response["ffmpeg_pid"] = status.get("ffmpeg_pid")
    response["last_stream_probe_success"] = status.get("last_stream_probe_success")
    response["last_stream_probe_failure"] = status.get("last_stream_probe_failure")
    response["output_device"] = status.get("output_device", OUTPUT_DEVICE)
    response["fallback_path"] = status.get("fallback_path", FALLBACK_PATH)
    response["status"] = status
    hw_volume = _get_hw_vol()
    if hw_volume is not None:
        response["hw_volume_percent"] = hw_volume
    return response


def _format_float(value: float) -> str:
    return f"{float(value):.6f}"


def metrics_body() -> str:
    cfg = load_config()
    status = read_status()
    fallback_exists = bool(status.get("fallback_exists")) or os.path.exists(FALLBACK_PATH)
    now = time.time()
    ts = status.get("timestamp")
    status_age = max(0.0, now - float(ts)) if isinstance(ts, (int, float)) else None
    current_source = status.get("current_source", cfg.get("source"))
    target_state = status.get("target_state", cfg.get("source"))
    desired_source = cfg.get("source")
    stream_up = 1 if status.get("stream_up") else 0
    fallback_active = 1 if status.get("fallback_active") else 0
    last_switch = float(status.get("last_switch_timestamp", 0.0) or 0.0)
    last_probe_ok = float(status.get("last_stream_probe_success", 0.0) or 0.0)
    last_probe_fail = float(status.get("last_stream_probe_failure", 0.0) or 0.0)
    volume = clamp_volume(cfg.get("volume"))
    mode = cfg.get("mode", "auto")
    ffmpeg_pid = status.get("ffmpeg_pid") or 0
    hw_volume = _get_hw_vol()

    lines = []

    def gauge(name: str, value: Any, help_text: str) -> None:
        lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} gauge")
        if isinstance(value, float):
            lines.append(f"{name} {_format_float(value)}")
        else:
            lines.append(f"{name} {value}")

    gauge("audio_volume", float(volume), "Software volume (0.0-2.0)")
    gauge("audio_stream_up", int(stream_up), "1 when the stream pipeline is active")
    gauge("audio_fallback_active", int(fallback_active), "1 when the fallback file is playing")
    gauge("audio_fallback_exists", 1 if fallback_exists else 0, "1 when fallback.mp3 is present")
    gauge(
        "audio_status_age_seconds",
        status_age if status_age is not None else 0.0,
        "Seconds since the player last updated status.json",
    )
    gauge("audio_last_switch_timestamp", last_switch, "Unix timestamp of the last source switch")
    gauge(
        "audio_stream_probe_last_success",
        last_probe_ok,
        "Unix timestamp of the last successful stream probe",
    )
    gauge(
        "audio_stream_probe_last_failure",
        last_probe_fail,
        "Unix timestamp of the last failed stream probe",
    )
    gauge("audio_ffmpeg_pid", int(ffmpeg_pid), "PID of the running ffmpeg process or 0 when idle")
    if hw_volume is not None:
        gauge(
            "audio_hw_mixer_percent",
            int(hw_volume),
            "Hardware mixer volume percent (if configured)",
        )

    for src in VALID_SOURCES:
        lines.append(
            f'audio_current_source{{state="{src}"}} {1 if current_source == src else 0}'
        )
        lines.append(
            f'audio_target_state{{state="{src}"}} {1 if target_state == src else 0}'
        )
        lines.append(
            f'audio_desired_source{{state="{src}"}} {1 if desired_source == src else 0}'
        )

    for mode_name in VALID_MODES:
        lines.append(
            f'audio_config_mode{{mode="{mode_name}"}} {1 if mode == mode_name else 0}'
        )

    return "\n".join(lines) + "\n"


def _amixer_cmd(*args: str) -> Tuple[str, ...]:
    return ("amixer", "-c", str(MIXER_CARD), *args)


def _get_hw_vol() -> Optional[int]:
    try:
        out = subprocess.check_output(_amixer_cmd("get", MIXER_CONTROL), text=True, timeout=3)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    match = re.search(r"\[(\d+)%\]", out)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def _set_hw_vol(percent: int) -> bool:
    try:
        subprocess.check_call(_amixer_cmd("set", MIXER_CONTROL, f"{percent}%"), timeout=3)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


@app.get("/healthz")
def healthz() -> str:
    return "ok"


@app.get("/status")
def status() -> Response:
    return jsonify(status_payload())


@app.get("/config")
def get_config() -> Response:
    return jsonify(load_config())


@app.put("/config")
def put_config() -> Response:
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "invalid json"}), 400
    allowed = {k: v for k, v in data.items() if k in {"stream_url", "volume", "mode", "source"}}
    cfg, error = update_config_fields(allowed)
    if error:
        message, status_code = error
        return jsonify({"error": message}), status_code
    return jsonify(cfg)


@app.post("/volume")
def set_volume() -> Response:
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or "volume" not in data:
        return jsonify({"error": "missing volume"}), 400
    cfg, error = update_config_fields({"volume": data["volume"]})
    if error:
        message, status_code = error
        return jsonify({"error": message}), status_code
    return jsonify(cfg)


@app.post("/play")
def play() -> Response:
    data = request.get_json(force=True, silent=True) or {}
    updates: Dict[str, Any] = {}
    updates["source"] = data.get("source", "stream")
    if "mode" in data:
        updates["mode"] = data["mode"]
    if "stream_url" in data:
        updates["stream_url"] = data["stream_url"]
    cfg, error = update_config_fields(updates)
    if error:
        message, status_code = error
        return jsonify({"error": message}), status_code
    return jsonify(cfg)


@app.post("/stop")
def stop() -> Response:
    cfg, _ = update_config_fields({"source": "stop"})
    return jsonify(cfg)


@app.post("/upload")
def upload() -> Response:
    if "file" not in request.files:
        return jsonify({"error": "missing file"}), 400
    uploaded = request.files["file"]
    os.makedirs(os.path.dirname(FALLBACK_PATH), exist_ok=True)
    uploaded.save(FALLBACK_PATH)
    size = os.path.getsize(FALLBACK_PATH)
    return jsonify({"saved": True, "path": FALLBACK_PATH, "size": size})


@app.get("/metrics")
def metrics() -> Response:
    return Response(metrics_body(), mimetype="text/plain; version=0.0.4")


@app.get("/hwvolume")
def hwvolume_get() -> Response:
    vol = _get_hw_vol()
    return jsonify({
        "mixer_card": int(MIXER_CARD),
        "mixer_control": MIXER_CONTROL,
        "volume_percent": vol,
    })


@app.post("/hwvolume")
def hwvolume_set() -> Response:
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or "volume_percent" not in data:
        return jsonify({"error": "missing volume_percent"}), 400
    try:
        value = int(data["volume_percent"])
    except (TypeError, ValueError):
        return jsonify({"error": "volume_percent must be integer"}), 400
    value = max(0, min(100, value))
    if not _set_hw_vol(value):
        return jsonify({"error": "failed to set mixer volume"}), 500
    return jsonify({"ok": True, "volume_percent": value})


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CFG_PATH):
        save_config(load_config())
    app.run(host=BIND, port=PORT)
