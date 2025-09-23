#!/usr/bin/env python3
"""Audio playback loop for Fleet audio-player role."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from typing import Any, Dict, Optional

DATA_DIR = "/data"
CFG_PATH = os.path.join(DATA_DIR, "config.json")
STATUS_PATH = os.path.join(DATA_DIR, "status.json")
LOG_DIR = os.path.join(DATA_DIR, "logs")
LOG_PATH = os.path.join(LOG_DIR, "player.log")

OUTPUT_DEVICE = os.environ.get("AUDIO_OUTPUT_DEVICE", "hw:0,0")
DEFAULT_STREAM_URL = os.environ.get("STREAM_URL", "")
DEFAULT_VOLUME_ENV = os.environ.get("AUDIO_VOLUME", "1.0")
FALLBACK_FILE = os.environ.get("FALLBACK_FILE", os.path.join(DATA_DIR, "fallback.mp3"))

try:
    DEFAULT_VOLUME = float(DEFAULT_VOLUME_ENV)
except ValueError:
    DEFAULT_VOLUME = 1.0

VALID_SOURCES = {"stream", "file", "stop"}
VALID_MODES = {"auto", "manual"}


def log_message(handle: Optional[Any], message: str) -> None:
    """Write a timestamped line to the log handle."""
    timestamp = time.strftime("[%Y-%m-%d %H:%M:%S] ")
    if handle is None:
        sys.stdout.write(timestamp + message + "\n")
        sys.stdout.flush()
        return
    handle.write(timestamp + message + "\n")
    handle.flush()


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
        # Ignore corrupt config; the control API will rewrite it on next update.
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


def write_status(state: Dict[str, Any], handle: Optional[Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp_path = STATUS_PATH + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
        os.replace(tmp_path, STATUS_PATH)
    except Exception as exc:  # pragma: no cover - best-effort logging
        log_message(handle, f"Failed to persist status.json: {exc}")


def ffprobe_ok(url: str) -> bool:
    if not url:
        return False
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-timeout",
                "2000000",
                "-i",
                url,
                "-show_format",
                "-of",
                "json",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=6,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def launch_stream(url: str, volume: float, handle: Optional[Any]) -> Optional[subprocess.Popen]:
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "info",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_on_network_error",
        "1",
        "-reconnect_delay_max",
        "2",
        "-i",
        url,
        "-vn",
        "-af",
        f"volume={volume}",
        "-c:a",
        "pcm_s16le",
        "-f",
        "alsa",
        OUTPUT_DEVICE,
    ]
    log_message(handle, f"Starting stream -> {OUTPUT_DEVICE} ({url}) volume={volume}")
    try:
        return subprocess.Popen(args, stdout=handle, stderr=handle)
    except Exception as exc:
        log_message(handle, f"Failed to launch stream ffmpeg: {exc}")
        return None


def launch_file_loop(path: str, volume: float, handle: Optional[Any]) -> Optional[subprocess.Popen]:
    if not os.path.exists(path):
        log_message(handle, f"Fallback file missing: {path}")
        return None
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "info",
        "-stream_loop",
        "-1",
        "-re",
        "-i",
        path,
        "-vn",
        "-af",
        f"volume={volume}",
        "-c:a",
        "pcm_s16le",
        "-f",
        "alsa",
        OUTPUT_DEVICE,
    ]
    log_message(handle, f"Starting fallback loop -> {OUTPUT_DEVICE} ({path}) volume={volume}")
    try:
        return subprocess.Popen(args, stdout=handle, stderr=handle)
    except Exception as exc:
        log_message(handle, f"Failed to launch fallback ffmpeg: {exc}")
        return None


def stop_process(proc: Optional[subprocess.Popen], handle: Optional[Any], reason: str) -> Optional[subprocess.Popen]:
    if proc is None:
        return None
    try:
        if proc.poll() is None:
            log_message(handle, f"Stopping ffmpeg ({reason})")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                log_message(handle, "ffmpeg still running, killing")
                proc.kill()
    except Exception as exc:
        log_message(handle, f"Error stopping ffmpeg: {exc}")
    return None


def build_status(
    cfg: Dict[str, Any],
    current: str,
    target: str,
    proc: Optional[subprocess.Popen],
    last_switch: float,
    last_probe_ok: float,
    last_probe_fail: float,
    fallback_exists: bool,
    volume: float,
) -> Dict[str, Any]:
    proc_running = proc is not None and proc.poll() is None
    now = time.time()
    return {
        "timestamp": now,
        "desired_source": cfg.get("source", "stream"),
        "target_state": target,
        "current_source": current if proc_running else "stop",
        "mode": cfg.get("mode", "auto"),
        "stream_url": cfg.get("stream_url", DEFAULT_STREAM_URL),
        "volume": volume,
        "fallback_exists": fallback_exists,
        "stream_up": 1 if proc_running and current == "stream" else 0,
        "fallback_active": 1 if proc_running and current == "file" else 0,
        "last_switch_timestamp": last_switch,
        "last_stream_probe_success": last_probe_ok,
        "last_stream_probe_failure": last_probe_fail,
        "ffmpeg_pid": proc.pid if proc_running else None,
        "output_device": OUTPUT_DEVICE,
        "fallback_path": FALLBACK_FILE,
    }


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)

    log_handle = open(LOG_PATH, "a", buffering=1, encoding="utf-8")
    log_message(log_handle, "Audio player booted")

    cfg = load_config()
    save_config(cfg)
    try:
        last_mtime = os.path.getmtime(CFG_PATH)
    except FileNotFoundError:
        last_mtime = 0.0

    proc: Optional[subprocess.Popen] = None
    current_state = "stop"
    last_switch = time.time()
    last_probe_ok = 0.0
    last_probe_fail = 0.0

    def handle_signal(signum: int, _frame: Any) -> None:
        nonlocal proc, current_state
        log_message(log_handle, f"Received signal {signum}, shutting down")
        proc = stop_process(proc, log_handle, "signal")
        current_state = "stop"
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        while True:
            cfg = load_config()
            desired = cfg.get("source", "stream")
            volume = clamp_volume(cfg.get("volume"))
            stream_url = cfg.get("stream_url", DEFAULT_STREAM_URL)
            mode = cfg.get("mode", "auto")
            fallback_exists = os.path.exists(FALLBACK_FILE)

            try:
                mtime = os.path.getmtime(CFG_PATH)
            except FileNotFoundError:
                mtime = last_mtime
            if mtime != last_mtime:
                log_message(log_handle, "Config change detected; recycling pipeline")
                proc = stop_process(proc, log_handle, "config refresh")
                current_state = "stop"
                last_mtime = mtime

            stream_ok = False
            if desired == "stream":
                if not stream_url:
                    log_message(log_handle, "Stream requested but no STREAM_URL configured")
                    last_probe_fail = time.time()
                elif mode == "manual":
                    stream_ok = True
                else:
                    if ffprobe_ok(stream_url):
                        stream_ok = True
                        last_probe_ok = time.time()
                    else:
                        last_probe_fail = time.time()
                        log_message(log_handle, "Stream probe failed; falling back if possible")

            target_state = "stop"
            if desired == "stop":
                target_state = "stop"
            elif desired == "file":
                target_state = "file" if fallback_exists else "stop"
                if not fallback_exists:
                    log_message(log_handle, "File playback requested but fallback missing")
            elif desired == "stream":
                if stream_ok:
                    target_state = "stream"
                elif fallback_exists:
                    target_state = "file"
                else:
                    target_state = "stop"
            else:
                log_message(log_handle, f"Unknown source '{desired}', forcing stop")

            if proc is not None and proc.poll() is not None:
                code = proc.poll()
                log_message(log_handle, f"ffmpeg exited with code {code}")
                proc = None
                current_state = "stop"

            prev_state = current_state

            if target_state == "stop":
                proc = stop_process(proc, log_handle, "target stop")
                current_state = "stop"
            elif target_state == "file":
                if not fallback_exists:
                    proc = stop_process(proc, log_handle, "fallback missing")
                    current_state = "stop"
                else:
                    if current_state != "file" or proc is None:
                        proc = stop_process(proc, log_handle, "switch to file")
                        proc = launch_file_loop(FALLBACK_FILE, volume, log_handle)
                    current_state = "file" if proc is not None else "stop"
            elif target_state == "stream":
                if stream_url:
                    if current_state != "stream" or proc is None:
                        proc = stop_process(proc, log_handle, "switch to stream")
                        proc = launch_stream(stream_url, volume, log_handle)
                    current_state = "stream" if proc is not None else "stop"
                else:
                    proc = stop_process(proc, log_handle, "missing stream url")
                    current_state = "stop"

            if proc is not None and proc.poll() is not None:
                code = proc.poll()
                log_message(log_handle, f"ffmpeg exited with code {code}")
                proc = None
                current_state = "stop"

            if current_state != prev_state:
                last_switch = time.time()

            status_payload = build_status(
                cfg=cfg,
                current=current_state,
                target=target_state,
                proc=proc,
                last_switch=last_switch,
                last_probe_ok=last_probe_ok,
                last_probe_fail=last_probe_fail,
                fallback_exists=fallback_exists,
                volume=volume,
            )
            write_status(status_payload, log_handle)

            time.sleep(1)
    finally:
        stop_process(proc, log_handle, "shutdown")
        try:
            log_handle.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
