from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from typing import Optional

from common import clamp, ensure_dir, load_json, save_json

DATA_DIR = os.environ.get("AUDIO_DATA_DIR", "/data")
CFG_PATH = os.path.join(DATA_DIR, "config.json")
STATE_PATH = os.path.join(DATA_DIR, "state.json")
LOG_PATH = os.path.join(DATA_DIR, "player.log")
OUTPUT_DEVICE = os.environ.get("AUDIO_OUTPUT_DEVICE", "hw:0,0")
DEFAULT_STREAM_URL = os.environ.get("STREAM_URL", "")
FALLBACK_PATH = os.environ.get("FALLBACK_FILE", os.path.join(DATA_DIR, "fallback.mp3"))
HEARTBEAT_INTERVAL = float(os.environ.get("PLAYER_HEARTBEAT_SECONDS", "1.0"))

try:
    DEFAULT_VOLUME = float(os.environ.get("AUDIO_VOLUME", "1.0"))
except Exception:
    DEFAULT_VOLUME = 1.0


def log_event(message: str) -> None:
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write(f"{timestamp} {message}\n")
    except Exception:
        pass


def load_config() -> dict:
    defaults = {
        "stream_url": DEFAULT_STREAM_URL,
        "volume": DEFAULT_VOLUME,
        "mode": "manual",
        "source": "stream",
    }
    return load_json(CFG_PATH, defaults)


def save_config(config: dict) -> None:
    save_json(CFG_PATH, config)


def load_state() -> dict:
    defaults = {
        "now_playing": "stop",
        "fallback_active": False,
        "fallback_exists": False,
        "stream_up": 0,
        "last_switch_timestamp": 0.0,
        "last_error": "",
    }
    return load_json(STATE_PATH, defaults)


def save_state(state: dict) -> None:
    save_json(STATE_PATH, state)


def terminate_process(proc: Optional[subprocess.Popen]) -> Optional[subprocess.Popen]:
    if proc is None:
        return None
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()
    return None


def play_stream(url: str, volume: float) -> subprocess.Popen:
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
    return subprocess.Popen(args)


def play_fallback(path: str, volume: float) -> subprocess.Popen:
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
    return subprocess.Popen(args)


def ffprobe_ok(url: str) -> bool:
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
                "-of",
                "json",
                "-show_format",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=4,
            check=False,
        )
    except Exception:
        return False
    return result.returncode == 0


def update_state(now_playing: str, fallback_exists: bool, stream_up: bool, last_switch: float, last_error: str) -> None:
    payload = {
        "now_playing": now_playing,
        "fallback_active": now_playing == "file",
        "fallback_exists": bool(fallback_exists),
        "stream_up": 1 if stream_up and now_playing == "stream" else 0,
        "last_switch_timestamp": float(last_switch),
        "last_error": last_error or "",
    }
    save_state(payload)


def player_loop() -> None:
    ensure_dir(DATA_DIR)
    log_event("audio player starting")

    cfg = load_config()
    save_config(cfg)
    state = load_state()
    last_switch = float(state.get("last_switch_timestamp") or time.time())
    last_error = state.get("last_error", "")
    proc: Optional[subprocess.Popen] = None
    current = "stop"
    try:
        last_mtime = os.path.getmtime(CFG_PATH)
    except Exception:
        last_mtime = time.time()

    update_state(current, os.path.exists(FALLBACK_PATH), False, last_switch, last_error)

    while True:
        cfg = load_config()
        desired = str(cfg.get("source", "stream")).lower()
        try:
            vol = float(cfg.get("volume", DEFAULT_VOLUME))
        except Exception:
            vol = DEFAULT_VOLUME
        vol = clamp(vol, 0.0, 2.0)
        url = cfg.get("stream_url", DEFAULT_STREAM_URL)
        fallback_exists = os.path.exists(FALLBACK_PATH)
        mode = str(cfg.get("mode", "manual")).lower()
        auto_mode = mode == "auto"

        try:
            mtime = os.path.getmtime(CFG_PATH)
        except FileNotFoundError:
            mtime = last_mtime
        except Exception:
            mtime = time.time()

        if mtime != last_mtime:
            log_event("configuration change detected; restarting pipeline")
            proc = terminate_process(proc)
            current = "stop"
            last_mtime = mtime
            last_switch = time.time()

        stream_up = False

        if desired == "stop":
            if current != "stop":
                log_event("stopping playback (requested)")
            proc = terminate_process(proc)
            current = "stop"
            stream_up = False
            last_error = ""
        elif desired == "file" or (auto_mode and (not url or not ffprobe_ok(str(url)))):
            if not fallback_exists:
                if current != "stop":
                    proc = terminate_process(proc)
                    current = "stop"
                    last_switch = time.time()
                last_error = "fallback file missing"
                update_state(current, fallback_exists, False, last_switch, last_error)
                time.sleep(2)
                continue
            if current != "file":
                proc = terminate_process(proc)
                log_event("switching to fallback file playback")
                proc = play_fallback(FALLBACK_PATH, vol)
                current = "file"
                last_switch = time.time()
            if desired != "file" and auto_mode:
                last_error = "stream unavailable, playing fallback"
            else:
                last_error = ""
            stream_up = False
        else:
            if current != "stream":
                proc = terminate_process(proc)
                log_event(f"starting stream playback: {url}")
                proc = play_stream(str(url), vol)
                current = "stream"
                last_switch = time.time()
            stream_up = proc is not None and proc.poll() is None
            last_error = ""

        update_state(current, fallback_exists, stream_up, last_switch, last_error)

        time.sleep(HEARTBEAT_INTERVAL)

        if proc is not None and proc.poll() is not None:
            rc = proc.returncode
            log_event(f"playback process exited (rc={rc})")
            last_error = f"playback exited (rc={rc})"
            proc = None
            if current != "stop":
                current = "stop"
                last_switch = time.time()
            update_state(current, os.path.exists(FALLBACK_PATH), False, last_switch, last_error)


def handle_signal(signum: int, _frame) -> None:
    log_event(f"received signal {signum}, exiting")
    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    try:
        player_loop()
    finally:
        pass


if __name__ == "__main__":
    main()
