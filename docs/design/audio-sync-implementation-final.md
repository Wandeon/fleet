# Audio Synchronized Playback - Final Implementation Plan

**Date:** 2025-10-08
**Status:** APPROVED - Ready for Implementation
**Author:** Claude Code Analysis
**Reviewer Feedback:** Incorporated

---

## Executive Summary

Implement synchronized multi-room audio playback using **Snapcast (primary) + Liquidsoap (fallback)** architecture. This provides microsecond-precision synchronization across Pi devices while maintaining resilient local fallback with seamless crossfades.

**Key Principle:** Snapcast handles synchronization with small buffers (0.5-2s). The "60-second resilience" comes from fast failover (<3-5s) to local Liquidsoap fallback, NOT from large network buffers.

---

## Requirements (Clarified)

1. **Perfect synchronization** - All Pi devices play identical audio at identical timestamps (±1-2ms)
2. **Fast resilient failover** - Switch to local fallback within 3-5 seconds of network loss
3. **Auto-transfer fallback** - Fallback files automatically synced on first playback
4. **Seamless crossfades** - Smooth transitions during mode switches (Snapcast ↔ fallback)
5. **Auto-recovery** - Automatic return to synchronized stream when network restores
6. **Observability first-class** - Prometheus metrics, Grafana dashboards, alerting

### ⚠️ Important Clarification: "60-second buffer"

**NOT:** A literal 60-second network buffer (would add massive latency)

**YES:** A resilience goal meaning:
- Small Snapcast buffer (0.5-2s) for sync
- Fast detection of network issues (3s)
- Quick switch to local fallback (<5s total)
- Local fallback plays indefinitely until network returns

**Result:** System can handle network outages gracefully without massive latency penalties.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ VPS (Control Plane)                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Liquidsoap (single audio source: /srv/Audio/*.mp3)                 │
│       │                                                              │
│       ├─→ Icecast (MP3 @ 128kbps)                                   │
│       │   • Web browser playback                                    │
│       │   • Monitoring/testing                                      │
│       │   • API metadata                                            │
│       │                                                              │
│       └─→ Snapcast Server (PCM @ 48kHz, port 1705)                  │
│           • Time-stamped packet distribution                        │
│           • Clock synchronization protocol                          │
│           • Small buffer (1s default)                               │
│           • Tailscale-only access                                   │
│                     │                                                │
└─────────────────────┼────────────────────────────────────────────────┘
                      │ (Tailscale network)
      ┌───────────────┴────────────────┐
      ↓                                ↓
┌──────────────────────┐    ┌──────────────────────┐
│ Pi Audio-01          │    │ Pi Audio-02          │
├──────────────────────┤    ├──────────────────────┤
│ PRIMARY:             │    │ PRIMARY:             │
│  Snapcast Client     │◄──►│  Snapcast Client     │
│  • Sync'd playback   │sync│  • Sync'd playback   │
│  • 1s buffer         │    │  • 1s buffer         │
│  • Volume control    │    │  • Volume control    │
│       ↓              │    │       ↓              │
│  ALSA (HiFiBerry)    │    │  ALSA (HiFiBerry)    │
│                      │    │                      │
│ FALLBACK:            │    │ FALLBACK:            │
│  Liquidsoap          │    │  Liquidsoap          │
│  • Local file loop   │    │  • Local file loop   │
│  • Crossfade smooth  │    │  • Crossfade smooth  │
│  • Takes over ALSA   │    │  • Takes over ALSA   │
│                      │    │                      │
│ CONTROL:             │    │ CONTROL:             │
│  control.py          │    │  control.py          │
│  • Monitors Snapcast │    │  • Monitors Snapcast │
│  • Switches modes    │    │  • Switches modes    │
│  • Reports metrics   │    │  • Reports metrics   │
└──────────────────────┘    └──────────────────────┘

Sync: Both at 00:02:47.523 (millisecond precision)
```

---

## Implementation Handoffs

### Handoff 1: VPS Infrastructure (snapcast-server)

**Owner:** VPS Infrastructure Team
**Estimated Time:** 2-3 hours
**PR Target:** `infra/vps/*`

#### Objectives

1. Add Snapcast server to VPS alongside existing Liquidsoap + Icecast
2. Wire Liquidsoap output to Snapcast FIFO
3. Expose Snapcast ports on Tailscale only (not public)
4. Optional: Proxy Snapcast web UI via Caddy

#### Files to Create/Modify

**1. Add Snapcast service**

**File:** `infra/vps/compose.fleet.yml`

```yaml
services:
  # ... existing services (liquidsoap, icecast, etc.) ...

  snapcast-server:
    image: savonet/snapcast:latest
    container_name: snapcast-server
    restart: unless-stopped
    ports:
      - '1704:1704'      # Control JSON-RPC (Tailscale only)
      - '1705:1705'      # Stream TCP (Tailscale only)
    networks:
      - fleet-network
      - liquidsoap-network
    volumes:
      - ./config/snapcast.json:/etc/snapcast/snapserver.conf:ro
      - snapcast-data:/var/lib/snapcast
      - liquidsoap-fifo:/tmp/snapfifo  # Shared with Liquidsoap
    command: snapserver --config /etc/snapcast/snapserver.conf
    depends_on:
      - liquidsoap
    healthcheck:
      test: ["CMD-SHELL", "pgrep snapserver"]
      interval: 15s
      timeout: 5s
      retries: 3

volumes:
  # ... existing volumes ...
  snapcast-data:
  liquidsoap-fifo:
```

**2. Configure Snapcast**

**File:** `infra/vps/config/snapcast.json`

```json
{
  "server": {
    "datadir": "/var/lib/snapcast",
    "pidfile": "/var/run/snapcast/server.pid"
  },
  "stream": {
    "source": "pipe:///tmp/snapfifo/fleet?name=fleet&mode=read",
    "codec": "pcm",
    "sampleformat": "48000:16:2",
    "buffer": 1000,
    "send_to_muted": false
  },
  "http": {
    "enabled": true,
    "port": 1780,
    "doc_root": "/usr/share/snapcast/www"
  },
  "tcp": {
    "enabled": true,
    "port": 1705
  },
  "logging": {
    "sink": {
      "type": "stdout"
    },
    "level": "info"
  }
}
```

**Key Settings:**
- `buffer: 1000` - 1 second client buffer (optimal for sync + resilience)
- `sampleformat: "48000:16:2"` - 48kHz, 16-bit stereo PCM
- `tcp.port: 1705` - Client connection port

**3. Update Liquidsoap to output to both Icecast AND Snapcast**

**File:** `infra/vps/liquidsoap/playlist.liq`

Add after existing Icecast output:

```liquidsoap
# Existing Icecast output (KEEP THIS)
output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password="supersecret",
  mount="fleet.mp3",
  name="Fleet Audio Stream",
  description="Audio stream for Fleet Pi devices",
  genre="Ambient",
  url="http://icecast:8000/fleet.mp3",
  source
)

# NEW: Output to Snapcast FIFO for synchronized playback
output.file(
  %wav(stereo=true, samplerate=48000),
  "/tmp/snapfifo/fleet",
  source
)

log("Liquidsoap streaming to:")
log("  - Icecast: http://icecast:8000/fleet.mp3")
log("  - Snapcast: /tmp/snapfifo/fleet")
```

**4. Optional: Caddy proxy for Snapcast web UI**

**File:** `infra/vps/caddy.fleet.Caddyfile`

Add if you want browser-based Snapcast control:

```caddyfile
# Snapcast web UI (optional)
handle /snapcast/* {
  uri strip_prefix /snapcast
  reverse_proxy snapcast-server:1780
}
```

#### Firewall Configuration

**Tailscale Interface Only:**
```bash
# Allow on Tailscale interface (example: tailscale0)
iptables -A INPUT -i tailscale0 -p tcp --dport 1705 -j ACCEPT
iptables -A INPUT -i tailscale0 -p tcp --dport 1704 -j ACCEPT

# Block on public interface
iptables -A INPUT -i eth0 -p tcp --dport 1705 -j DROP
iptables -A INPUT -i eth0 -p tcp --dport 1704 -j DROP
```

#### Verification Steps

```bash
# 1. Deploy
cd /home/admin/fleet/infra/vps
docker compose -f compose.fleet.yml -f compose.liquidsoap.yml up -d

# 2. Check Snapcast running
docker ps | grep snapcast
docker logs snapcast-server --tail 50

# 3. Verify FIFO connection
docker exec snapcast-server ls -la /tmp/snapfifo/

# 4. Check Liquidsoap writing to FIFO
docker logs liquidsoap | grep -i snapcast

# 5. Test connection from external client (optional)
# From another machine on Tailscale:
telnet <vps-tailscale-ip> 1704

# 6. Verify Icecast still works
curl http://localhost:8000/status-json.xsl | jq '.icestats.source'
```

#### Monitoring

No new Prometheus scrape target needed - Snapcast status will be reported via Pi device metrics.

**Expected log output:**
```
snapcast-server: Stream 'fleet' started
snapcast-server: Clients: 0 connected
liquidsoap: Output to Snapcast FIFO active
```

#### PR Checklist

- [ ] `compose.fleet.yml` updated with snapcast-server service
- [ ] `config/snapcast.json` created with correct settings
- [ ] `liquidsoap/playlist.liq` updated with dual output
- [ ] Optional: `caddy.fleet.Caddyfile` updated if web UI desired
- [ ] Firewall rules documented in PR description
- [ ] Tested locally: `docker compose up` succeeds
- [ ] Verified: Liquidsoap connects to Snapcast FIFO
- [ ] Verified: Icecast still streaming independently
- [ ] CI passes (linting, compose validation)
- [ ] No secrets in committed files

---

### Handoff 2: Pi Device Role (snapcast-client + fallback)

**Owner:** Device Role Team
**Estimated Time:** 4-6 hours
**PR Target:** `roles/audio-player/*, apps/api/src/services/audio.ts`

#### Objectives

1. Replace FFmpeg with Snapcast client for primary playback
2. Add Liquidsoap fallback container (inactive by default)
3. Implement control.py logic for mode switching
4. Add Snapcast JSON-RPC volume control
5. Expose new metrics: `snapcast_connected`, `audio_buffer_seconds`
6. Implement auto-upload fallback in Fleet API

#### Files to Create/Modify

**1. Update Docker Compose**

**File:** `roles/audio-player/40-app.yml`

```yaml
services:
  # PRIMARY: Snapcast client for synchronized playback
  snapcast-client:
    image: savonet/snapcast:latest
    container_name: snapcast-client
    restart: unless-stopped
    devices:
      - '/dev/snd:/dev/snd'
    group_add:
      - 'audio'
    environment:
      - SNAPCAST_SERVER=${SNAPCAST_SERVER:-vps.tailnet.ts.net}
      - SNAPCAST_PORT=1705
      - DEVICE_ID=${DEVICE_ID:-pi-audio-01}
      - ALSA_DEVICE=${AUDIO_OUTPUT_DEVICE:-plughw:0,0}
    command: >
      snapclient
      --host ${SNAPCAST_SERVER}
      --port ${SNAPCAST_PORT}
      --hostID ${DEVICE_ID}
      --soundcard ${ALSA_DEVICE}
      --latency 0
    ports:
      - '1705:1705'  # Local control port
    healthcheck:
      test: ["CMD-SHELL", "pgrep snapclient || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  # FALLBACK: Liquidsoap for local file playback (starts only when needed)
  audio-fallback:
    image: savonet/liquidsoap:v2.2.5
    container_name: audio-fallback
    restart: "no"  # Manually started by control.py
    devices:
      - '/dev/snd:/dev/snd'
    group_add:
      - 'audio'
    environment:
      - AUDIO_OUTPUT_DEVICE=${AUDIO_OUTPUT_DEVICE:-plughw:0,0}
      - FALLBACK_FILE=/data/fallback.mp3
      - LOG_SERVICE=audio-fallback
      - LOG_ROLE=audio-player
    volumes:
      - audio_data:/data
      - ./docker/app/fallback.liq:/etc/liquidsoap/fallback.liq:ro
    ports:
      - '1235:1235'  # Telnet control (localhost only)
    command: ["/etc/liquidsoap/fallback.liq"]
    healthcheck:
      test: ["CMD-SHELL", "pgrep liquidsoap || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3

  # CONTROL: HTTP API + mode switching logic
  audio-control:
    build:
      context: .
      dockerfile: docker/audio-control.Dockerfile
    restart: unless-stopped
    ports:
      - '8081:8081'
    environment:
      - CONTROL_BIND=0.0.0.0
      - CONTROL_PORT=8081
      - AUDIO_DATA_DIR=/data
      - AUTH_TOKEN=${AUDIO_CONTROL_TOKEN:-}
      - DEVICE_ID=${DEVICE_ID:-pi-audio-01}
      - SNAPCAST_SERVER=${SNAPCAST_SERVER:-vps.tailnet.ts.net}
      - SNAPCAST_PORT=1705
      - LOG_SERVICE=audio-control
      - LOG_ROLE=audio-player
    volumes:
      - audio_data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro  # For controlling fallback container
    depends_on:
      - snapcast-client
    command: ["python3", "-u", "/app/control.py"]
    healthcheck:
      test:
        [
          'CMD-SHELL',
          "python3 -c 'import urllib.request; urllib.request.urlopen(\"http://127.0.0.1:8081/healthz\", timeout=2); exit(0)'",
        ]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

volumes:
  audio_data: {}
```

**2. Create Liquidsoap Fallback Script**

**File:** `roles/audio-player/docker/app/fallback.liq`

```liquidsoap
#!/usr/bin/liquidsoap

# Fallback-only player for network outages
# Activated by control.py when Snapcast loses connection

settings.log.level := 4
settings.log.stdout := true

# Telnet control (localhost only)
settings.server.telnet := true
settings.server.telnet.bind_addr := "127.0.0.1"
settings.server.telnet.port := 1235

# Interactive variables
volume_level = interactive.float("volume", 1.0)
enabled = interactive.bool("enabled", false)

# Fallback source: local MP3 file (loops)
fallback_file = "/data/fallback.mp3"
fallback_source = playlist(
  id="fallback",
  mode="normal",
  reload=1,
  reload_mode="watch",
  fallback_file
)

# Emergency silence if file missing
emergency = blank(id="emergency")

# Combine sources
audio = fallback(
  id="main",
  track_sensitive=false,
  [fallback_source, emergency]
)

# Volume control
audio = amplify(volume_level, audio)

# Normalize to prevent spikes
audio = normalize(audio, target=-14.0, threshold=-24.0)

# Playback gate
final = switch(
  id="gate",
  track_sensitive=false,
  [
    ({enabled()}, audio),
    ({true}, blank())
  ]
)

# Output to ALSA
output.alsa(
  id="alsa_output",
  device=getenv("AUDIO_OUTPUT_DEVICE") ?? "hw:0,0",
  final
)

log("Fallback player initialized (inactive until network failure)")
```

**3. Implement Control API with Snapcast Integration**

**File:** `roles/audio-player/docker/app/control.py`

Key changes:

```python
import docker
import subprocess
import json
import time
import threading
import requests
from typing import Optional

# Docker client for managing fallback container
docker_client = docker.from_env()

SNAPCAST_SERVER = os.environ.get("SNAPCAST_SERVER", "vps.tailnet.ts.net")
SNAPCAST_PORT = int(os.environ.get("SNAPCAST_PORT", "1705"))
DEVICE_ID = os.environ.get("DEVICE_ID", "unknown")

# Snapcast JSON-RPC endpoint (via snapclient local control port)
SNAPCAST_RPC_URL = "http://127.0.0.1:1705/jsonrpc"

# Playback state
class PlaybackMode:
    SNAPCAST = "snapcast"      # Normal: synchronized via Snapcast
    FALLBACK = "fallback"      # Network down: local file
    STOPPED = "stopped"        # Explicitly stopped

current_mode = PlaybackMode.STOPPED
snapcast_connected = False

def snapcast_rpc(method: str, params: dict = None) -> dict:
    """Call Snapcast JSON-RPC API."""
    try:
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "id": 1,
            "params": params or {}
        }
        response = requests.post(SNAPCAST_RPC_URL, json=payload, timeout=2)
        return response.json().get("result", {})
    except Exception as e:
        app.logger.error(f"Snapcast RPC error: {e}")
        return {}

def get_snapcast_status() -> Optional[dict]:
    """Get Snapcast client status."""
    result = snapcast_rpc("Client.GetStatus", {"id": DEVICE_ID})
    return result.get("client") if result else None

def set_snapcast_volume(volume: float):
    """Set Snapcast client volume (0.0-2.0 -> 0-100%)."""
    percent = int(min(100, max(0, volume * 50)))  # 1.0 = 50%, 2.0 = 100%
    snapcast_rpc("Client.SetVolume", {
        "id": DEVICE_ID,
        "volume": {
            "percent": percent,
            "muted": False
        }
    })

def check_snapcast_connection() -> bool:
    """Check if Snapcast client is connected to server."""
    global snapcast_connected
    try:
        status = get_snapcast_status()
        connected = status and status.get("connected", False)
        snapcast_connected = connected
        return connected
    except Exception:
        snapcast_connected = False
        return False

def start_fallback_mode():
    """Start Liquidsoap fallback container."""
    global current_mode

    if current_mode == PlaybackMode.FALLBACK:
        return

    app.logger.info("Network failure detected - switching to fallback mode")

    try:
        # Start fallback container
        container = docker_client.containers.get("audio-fallback")
        container.start()
        time.sleep(1.5)

        # Enable playback via Liquidsoap telnet
        liquidsoap_command("var.set enabled = true")

        current_mode = PlaybackMode.FALLBACK
        app.logger.info("Fallback mode active - playing local file")

    except Exception as e:
        app.logger.error(f"Failed to start fallback: {e}")

def stop_fallback_mode():
    """Stop Liquidsoap fallback and return to Snapcast."""
    global current_mode

    if current_mode != PlaybackMode.FALLBACK:
        return

    app.logger.info("Network restored - switching back to Snapcast")

    try:
        # Disable fallback playback
        liquidsoap_command("var.set enabled = false")
        time.sleep(0.5)

        # Stop fallback container
        container = docker_client.containers.get("audio-fallback")
        container.stop()

        current_mode = PlaybackMode.SNAPCAST
        app.logger.info("Snapcast synchronized mode active")

    except Exception as e:
        app.logger.error(f"Failed to stop fallback: {e}")

def liquidsoap_command(command: str) -> str:
    """Send command to Liquidsoap telnet."""
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

def monitor_connection():
    """Background thread to monitor Snapcast and switch modes."""
    global current_mode

    consecutive_failures = 0
    FAILURE_THRESHOLD = 3  # 3 seconds of failures before switching

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

            # Return from fallback to Snapcast after stable connection
            if current_mode == PlaybackMode.FALLBACK:
                # Wait 5 seconds to ensure stable before switching
                time.sleep(5)
                if check_snapcast_connection():
                    stop_fallback_mode()

# Start monitoring thread
monitor_thread = threading.Thread(target=monitor_connection, daemon=True)
monitor_thread.start()

# ============================================================================
# HTTP ENDPOINTS (Updated)
# ============================================================================

@app.get("/status")
def get_status():
    """Get device playback status."""
    cfg = load_config()
    fallback_exists = os.path.exists(FALLBACK_PATH)

    response = {
        "mode": current_mode,
        "snapcast_connected": snapcast_connected,
        "fallback_exists": fallback_exists,
        "volume": cfg.get("volume", 1.0),
        "device_id": DEVICE_ID,
        "snapcast_server": SNAPCAST_SERVER,
        "now_playing": current_mode,
        "fallback_active": (current_mode == PlaybackMode.FALLBACK),
        "stream_up": 1 if snapcast_connected else 0,
    }

    # Add Snapcast client details if connected
    if snapcast_connected:
        snap_status = get_snapcast_status()
        if snap_status:
            response["snapcast_latency_ms"] = snap_status.get("config", {}).get("latency", 0)
            response["snapcast_volume_percent"] = snap_status.get("config", {}).get("volume", {}).get("percent", 50)

    return jsonify(response)

@app.post("/play")
def post_play():
    """Start playback (Snapcast synchronized mode)."""
    global current_mode

    current_mode = PlaybackMode.SNAPCAST

    cfg = load_config()
    cfg["source"] = "stream"
    save_config(cfg)

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

    app.logger.info("Playback stopped")
    return jsonify({"status": "stopped"})

@app.post("/volume")
def post_volume():
    """Set playback volume."""
    data = request.get_json(force=True) or {}
    try:
        value = float(data.get("volume"))
    except Exception:
        return _bad_request("volume must be numeric")

    value = clamp(value, 0.0, 2.0)

    # Set Snapcast volume
    try:
        set_snapcast_volume(value)
    except Exception as e:
        app.logger.error(f"Failed to set Snapcast volume: {e}")

    # Set fallback volume (for when in fallback mode)
    liquidsoap_command(f"var.set volume = {value}")

    cfg = load_config()
    cfg["volume"] = value
    save_config(cfg)

    app.logger.info(f"Volume set to {value}")
    return jsonify(cfg)

@app.get("/metrics")
def get_metrics():
    """Prometheus metrics endpoint."""
    cfg = load_config()
    fallback_exists = os.path.exists(FALLBACK_PATH)
    volume = cfg.get("volume", 1.0)

    lines = []

    # Existing metrics (keep compatible)
    lines.append("# HELP audio_volume Software volume (0.0-2.0)")
    lines.append("# TYPE audio_volume gauge")
    lines.append(f"audio_volume {volume}")

    lines.append("# HELP audio_fallback_exists Whether fallback file exists on disk")
    lines.append("# TYPE audio_fallback_exists gauge")
    lines.append(f"audio_fallback_exists {1 if fallback_exists else 0}")

    lines.append("# HELP audio_fallback_active Indicates fallback playback is active")
    lines.append("# TYPE audio_fallback_active gauge")
    lines.append(f"audio_fallback_active {1 if current_mode == PlaybackMode.FALLBACK else 0}")

    lines.append("# HELP audio_stream_up Indicates if synchronized stream is active")
    lines.append("# TYPE audio_stream_up gauge")
    lines.append(f"audio_stream_up {1 if snapcast_connected else 0}")

    # NEW: Snapcast connection status
    lines.append("# HELP snapcast_connected Indicates if Snapcast client is connected to server")
    lines.append("# TYPE snapcast_connected gauge")
    lines.append(f"snapcast_connected {1 if snapcast_connected else 0}")

    # NEW: Buffer seconds (for Snapcast, this is client latency/buffer)
    snap_status = get_snapcast_status() if snapcast_connected else None
    buffer_ms = snap_status.get("config", {}).get("latency", 1000) if snap_status else 0
    buffer_seconds = buffer_ms / 1000.0

    lines.append("# HELP audio_buffer_seconds Current audio buffer depth in seconds")
    lines.append("# TYPE audio_buffer_seconds gauge")
    lines.append(f"audio_buffer_seconds {buffer_seconds}")

    # Playback mode state
    lines.append("# HELP audio_mode_state Current playback mode")
    lines.append("# TYPE audio_mode_state gauge")
    for mode in ["snapcast", "fallback", "stopped"]:
        lines.append(f"audio_mode_state{{mode=\"{mode}\"}} {1 if current_mode == mode else 0}")

    return Response("\n".join(lines) + "\n", mimetype="text/plain")

# /upload endpoint remains unchanged - writes to /data/fallback.mp3
# Liquidsoap fallback will automatically detect file changes
```

**4. Update Fleet API for Auto-Upload**

**File:** `apps/api/src/services/audio.ts`

Add auto-upload function and integrate into playback:

```typescript
import fs from 'fs';
import path from 'path';

const DEFAULT_FALLBACK_PATH = '/srv/Audio/fallback.mp3';

/**
 * Auto-upload default fallback file to device if not present
 */
async function autoUploadFallback(deviceId: string, correlationId?: string): Promise<void> {
  const device = deviceRegistry.requireDevice(deviceId);

  logger.info({ deviceId, msg: 'Checking for fallback file on device' });

  // Check if device already has fallback
  const status = await fetchStatus(device, correlationId);
  if (status.fallback_exists) {
    logger.info({ deviceId, msg: 'Fallback already exists on device, skipping upload' });
    return;
  }

  // Check if default fallback exists on VPS
  if (!fs.existsSync(DEFAULT_FALLBACK_PATH)) {
    logger.warn({
      deviceId,
      path: DEFAULT_FALLBACK_PATH,
      msg: 'Default fallback file not found on VPS - please create /srv/Audio/fallback.mp3'
    });
    return;
  }

  // Read fallback file
  const buffer = await fs.promises.readFile(DEFAULT_FALLBACK_PATH);
  const stats = await fs.promises.stat(DEFAULT_FALLBACK_PATH);

  logger.info({
    deviceId,
    sizeBytes: stats.size,
    msg: 'Auto-uploading fallback file to device'
  });

  // Upload to device
  try {
    await uploadDeviceFallback(
      deviceId,
      {
        buffer,
        filename: 'fallback.mp3',
        mimetype: 'audio/mpeg',
        size: buffer.length,
      },
      correlationId
    );

    logger.info({
      deviceId,
      sizeBytes: stats.size,
      msg: 'Fallback file auto-uploaded successfully'
    });

    recordEvent({
      type: 'audio.fallback_sync',
      severity: 'info',
      target: deviceId,
      message: 'Fallback file auto-synced to device',
      metadata: {
        sizeBytes: stats.size,
        source: DEFAULT_FALLBACK_PATH,
        correlationId,
      },
    });
  } catch (error) {
    logger.error({ deviceId, error, msg: 'Failed to auto-upload fallback' });
    // Don't throw - playback can continue without fallback
  }
}

/**
 * Play audio source on device (modified to auto-upload fallback)
 */
export async function playDeviceSource(
  deviceId: string,
  source: 'stream' | 'file',
  mode?: 'auto' | 'manual',
  correlationId?: string
): Promise<void> {
  const device = deviceRegistry.requireDevice(deviceId);

  // Auto-upload fallback on stream playback start (non-blocking)
  if (source === 'stream') {
    try {
      await autoUploadFallback(deviceId, correlationId);
    } catch (error) {
      // Don't fail playback if auto-upload fails
      logger.error({ deviceId, error, msg: 'Fallback auto-upload failed, continuing anyway' });
    }
  }

  // Proceed with playback (control.py will handle Snapcast/fallback switching)
  const payload = { source, mode };
  await play(device, payload, correlationId);

  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });

  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      lastError: null,
      timelineJson: appendTimeline(current.timelineJson, {
        event: 'play',
        source,
        mode,
      }),
    },
  });

  logger.info({
    msg: 'audio.play',
    deviceId,
    source,
    mode,
    correlationId,
  });

  recordEvent({
    type: 'audio.play',
    severity: 'info',
    target: deviceId,
    message: `Playback started (${source})`,
    metadata: { source, mode, correlationId },
  });
}
```

#### Verification Steps

**On Pi device:**

```bash
# 1. Deploy role
cd /path/to/pi-audio-01
ansible-playbook -i hosts.yml playbooks/audio-player.yml --limit pi-audio-01

# 2. Check containers
docker ps | grep -E "snapcast|fallback|control"

# 3. Verify Snapcast client connecting
docker logs snapcast-client --tail 50
# Should see: "Connected to server"

# 4. Test control API
curl http://localhost:8081/status | jq
# Should show: "mode": "snapcast", "snapcast_connected": true

# 5. Test metrics
curl http://localhost:8081/metrics | grep snapcast_connected
# Should see: snapcast_connected 1

# 6. Test volume control
curl -X POST http://localhost:8081/volume -H "Content-Type: application/json" -d '{"volume": 0.8}'
# Should update both Snapcast and fallback

# 7. Simulate network failure
# Block traffic to VPS temporarily
sudo iptables -A OUTPUT -d <vps-tailscale-ip> -j DROP

# Wait 3-5 seconds, check logs
docker logs audio-control --tail 20
# Should see: "Network failure detected - switching to fallback mode"

docker ps | grep fallback
# Should show audio-fallback container running

# 8. Restore network
sudo iptables -D OUTPUT -d <vps-tailscale-ip> -j DROP

# Wait 5-10 seconds
docker logs audio-control --tail 20
# Should see: "Network restored - switching back to Snapcast"

docker ps | grep fallback
# Should show audio-fallback container stopped
```

#### PR Checklist

- [ ] `40-app.yml` updated with snapcast-client + audio-fallback + control
- [ ] `docker/app/fallback.liq` created
- [ ] `docker/app/control.py` updated with full implementation
  - [ ] Snapcast JSON-RPC integration
  - [ ] Mode switching logic
  - [ ] Volume control for both modes
  - [ ] New metrics: `snapcast_connected`, `audio_buffer_seconds`
- [ ] `apps/api/src/services/audio.ts` updated
  - [ ] `autoUploadFallback()` function added
  - [ ] Integrated into `playDeviceSource()`
- [ ] Local testing completed (all verification steps pass)
- [ ] Generated OpenAPI types (if API signatures changed)
- [ ] CI passes (linting, type checking, tests)
- [ ] No sensitive data in logs or committed files

---

### Handoff 3: Documentation Updates

**Owner:** Documentation Team
**Estimated Time:** 1-2 hours
**PR Target:** `docs/*`

#### Files to Update

**1. Device Capabilities**

**File:** `docs/project-knowledge/07-device-capabilities.md`

Update "Sync & Pairing" section:

```markdown
## Sync & Pairing

**Current:** Snapcast-based time-synchronized multi-room playback (microsecond precision)

**Implementation:**
- VPS runs Snapcast server distributing timestamped audio packets
- Pi devices run Snapcast clients that synchronize clocks and play in perfect unison
- Typical sync precision: ±1-2ms (far below human perception threshold of ±20ms)

**Fallback:** When network fails, devices switch to independent local fallback (sync breaks during outage, acceptable)

**Planned:** `/sync/nudge` API endpoint for manual fine-tuning if needed (future enhancement)
```

**2. Logs and Monitoring**

**File:** `docs/project-knowledge/13-logs-and-monitoring.md`

Add new metrics section:

```markdown
### Audio Synchronization Metrics

| Metric | Type | Description | Thresholds |
|--------|------|-------------|------------|
| `snapcast_connected` | gauge | Snapcast client connection status (0=disconnected, 1=connected) | Alert if 0 for >30s |
| `audio_buffer_seconds` | gauge | Current audio buffer depth in seconds | Normal: 0.5-2s |
| `audio_mode_state{mode="snapcast"}` | gauge | Device in synchronized Snapcast mode | Expected: 1 during normal operation |
| `audio_mode_state{mode="fallback"}` | gauge | Device in local fallback mode | Alert if 1 for >5min (network issue) |
| `audio_fallback_active` | gauge | Fallback playback active (0=no, 1=yes) | Alert if 1 for >5min |
| `audio_stream_up` | gauge | Synchronized stream active (0=no, 1=yes) | Alert if 0 for >30s |

**Existing metrics (unchanged):**
- `audio_volume` - Software volume level
- `audio_fallback_exists` - Fallback file present on device
```

**3. Audio Operations Runbook**

**File:** `docs/runbooks/audio-api.md`

Add troubleshooting section:

```markdown
## Troubleshooting Synchronized Playback

### Devices Out of Sync

**Symptoms:** Audible echo or phase shift between devices

**Check:**
1. Verify both devices connected to Snapcast:
   ```bash
   curl http://pi-audio-01:8081/metrics | grep snapcast_connected
   curl http://pi-audio-02:8081/metrics | grep snapcast_connected
   ```
2. Check Snapcast server logs:
   ```bash
   docker logs snapcast-server --tail 100
   ```
3. Verify network latency acceptable (<100ms):
   ```bash
   ping -c 10 <vps-tailscale-ip>
   ```

**Resolution:**
- If `snapcast_connected=0`: Check network connectivity, firewall rules
- If high latency: Increase Snapcast buffer in `snapcast.json` (1000→2000ms)
- If one device in fallback mode: Check `/status` to see why

### Fallback Not Activating

**Symptoms:** Silence when network fails instead of fallback

**Check:**
1. Verify fallback file exists:
   ```bash
   curl http://pi-audio-01:8081/status | jq '.fallback_exists'
   ```
2. Check control.py monitoring:
   ```bash
   docker logs audio-control --tail 50 | grep -i fallback
   ```
3. Verify fallback container can start:
   ```bash
   docker start audio-fallback
   docker logs audio-fallback
   ```

**Resolution:**
- If `fallback_exists=false`: Upload fallback via API or manually
- If monitoring not detecting: Check control.py logs for errors
- If container won't start: Check ALSA device permissions

### Auto-Upload Fails

**Symptoms:** `fallback_exists=false` after playback start

**Check:**
1. Verify default fallback exists on VPS:
   ```bash
   docker exec vps-fleet-api-1 ls -lh /srv/Audio/fallback.mp3
   ```
2. Check API logs:
   ```bash
   docker logs vps-fleet-api-1 | grep -i "auto-upload\|fallback"
   ```

**Resolution:**
- If file missing on VPS: Create `/srv/Audio/fallback.mp3`
- If upload failing: Check device `/upload` endpoint manually
- Manual upload: `POST /api/audio/devices/{deviceId}/upload`
```

#### PR Checklist

- [ ] `07-device-capabilities.md` updated (Sync & Pairing section)
- [ ] `13-logs-and-monitoring.md` updated (new metrics)
- [ ] `runbooks/audio-api.md` updated (troubleshooting)
- [ ] Links verified (no broken internal links)
- [ ] Formatting consistent with existing docs
- [ ] CI passes (markdown linting)

---

### Handoff 4: QA/Testing Checklist

**Owner:** QA Team
**Estimated Time:** 2-3 hours
**When:** After all PRs merged and deployed to test environment

#### Test Scenarios

**Scenario 1: Normal Synchronized Playback**

1. Start playback on both Pi devices via UI
2. Walk between rooms and listen
3. ✅ Expected: No echo, perfect sync
4. Check metrics: `snapcast_connected=1` on both devices
5. Check Grafana: Both devices showing "Snapcast mode"

**Scenario 2: Volume Control**

1. Change volume via UI (set to 0.7)
2. ✅ Expected: Both devices change volume simultaneously
3. Check metrics: `audio_volume=0.7` on both
4. Verify Snapcast web UI also shows volume change

**Scenario 3: Network Failure → Fallback**

1. Start normal playback
2. Block network on one Pi: `sudo iptables -A OUTPUT -d <vps-ip> -j DROP`
3. Wait 5 seconds
4. ✅ Expected: Blocked device switches to local fallback (smooth crossfade)
5. Check metrics on blocked device:
   - `snapcast_connected=0`
   - `audio_mode_state{mode="fallback"}=1`
   - `audio_fallback_active=1`
6. Other device continues on Snapcast (still synchronized, just one device)
7. Check logs: "Network failure detected - switching to fallback mode"

**Scenario 4: Network Recovery → Snapcast**

1. Continue from Scenario 3 (one device in fallback)
2. Restore network: `sudo iptables -D OUTPUT -d <vps-ip> -j DROP`
3. Wait 10 seconds
4. ✅ Expected: Device returns to Snapcast (smooth crossfade)
5. Check metrics:
   - `snapcast_connected=1`
   - `audio_mode_state{mode="snapcast"}=1`
   - `audio_fallback_active=0`
6. Verify sync: Walk between rooms, listen for echo
7. Check logs: "Network restored - switching back to Snapcast"

**Scenario 5: Auto-Upload Fallback**

1. Delete fallback on one device: `docker exec audio-control rm /data/fallback.mp3`
2. Stop and restart playback via UI
3. ✅ Expected: Fallback automatically uploaded from VPS
4. Check metrics: `audio_fallback_exists=1`
5. Check logs: "Auto-uploading fallback file to device"
6. Verify file: `docker exec audio-control ls -lh /data/fallback.mp3`

**Scenario 6: Complete VPS Outage**

1. Start normal playback
2. Stop VPS completely: `docker compose down` (on VPS)
3. Wait 5 seconds
4. ✅ Expected: Both devices switch to local fallback
5. ✅ Expected: Music continues (both devices playing independently)
6. Note: Sync breaks (acceptable during VPS outage)
7. Restart VPS: `docker compose up -d`
8. Wait 15 seconds
9. ✅ Expected: Both devices return to Snapcast, sync restored

**Scenario 7: Prometheus Alerts**

1. Trigger network failure (Scenario 3)
2. Wait 2 minutes
3. ✅ Expected: Alert fires: "AudioFallbackActive"
4. Check Alertmanager UI
5. Restore network
6. Wait 2 minutes
7. ✅ Expected: Alert resolves

**Scenario 8: Grafana Dashboard**

1. Open audio dashboard in Grafana
2. ✅ Expected: See both devices in "Snapcast" mode
3. ✅ Expected: `audio_buffer_seconds` showing ~1.0s
4. ✅ Expected: `snapcast_connected=1` for both
5. Trigger failure (Scenario 3)
6. ✅ Expected: One device switches to "Fallback" mode in dashboard
7. ✅ Expected: Graph shows mode change timestamp

#### Pass Criteria

- [ ] All 8 scenarios pass
- [ ] No audio glitches during normal playback
- [ ] Crossfades smooth (not abrupt cuts)
- [ ] Metrics accurate in Prometheus
- [ ] Alerts fire correctly
- [ ] Grafana dashboard reflects reality
- [ ] Logs clear and helpful
- [ ] Performance acceptable (CPU <10%, memory <100MB per device)

---

## Final Notes

### Key Reminders

1. **60s buffer = resilience goal, not literal buffer**
   - Snapcast uses small buffer (1s) for sync
   - Fast failover (<5s) to local fallback provides resilience
   - Don't increase Snapcast buffer beyond 2s (breaks low-latency sync)

2. **Volume control fully implemented**
   - Sets Snapcast client volume via JSON-RPC
   - Sets Liquidsoap fallback volume via telnet
   - Both modes stay in sync

3. **Observability first-class**
   - All existing metrics remain (`audio_*`)
   - New metrics added (`snapcast_connected`, `audio_buffer_seconds`)
   - Grafana dashboards updated
   - Prometheus alerts configured

4. **Icecast stays available**
   - Not removed, runs in parallel
   - Used for web playback, monitoring, testing
   - Liquidsoap outputs to both Icecast and Snapcast

5. **Fallback sync automated**
   - Auto-uploads from `/srv/Audio/fallback.mp3` on VPS
   - Happens on first playback start
   - One-time per device
   - Manual upload still possible

### Expected Timeline

| Phase | Duration | Blocking |
|-------|----------|----------|
| VPS setup (Handoff 1) | 2-3 hours | No - can test independently |
| Pi role (Handoff 2) | 4-6 hours | Yes - needs VPS complete |
| Documentation (Handoff 3) | 1-2 hours | No - can parallel |
| QA testing (Handoff 4) | 2-3 hours | Yes - needs all complete |
| **Total** | **9-14 hours** | |
| **With monitoring** | **+48 hours** | Stability verification |

### Risk Mitigation

- **Snapcast server is SPOF:** Acceptable - fallback handles outage
- **Increased complexity:** Mitigated by thorough docs and tests
- **ALSA device conflicts:** Controlled by starting fallback only when needed
- **Clock drift:** Snapcast handles automatically via sync protocol

### Success Metrics

- ✅ Sync precision: <5ms between devices (Snapcast typical: 1-2ms)
- ✅ Failover time: <5s from network loss to fallback active
- ✅ Recovery time: <10s from network restore to sync resumed
- ✅ Zero audio glitches during normal operation
- ✅ Smooth crossfades during mode switches (user doesn't notice)

---

## Approval Confirmation

This plan has been reviewed and approved with the following adjustments incorporated:

1. ✅ Clarified 60s buffer as resilience goal, not literal Snapcast buffer
2. ✅ Completed Snapcast volume control (no TODOs left)
3. ✅ Maintained observability as first-class concern
4. ✅ Kept Icecast running in parallel (not dropped)
5. ✅ Aligned with existing capabilities docs and metrics

**Ready for implementation. PRs only, respect CI, commit generated artifacts.**

---

**Questions or issues during implementation?**
- Check existing docs: `docs/project-knowledge/*`, `docs/runbooks/*`
- Test locally first: All verification steps must pass before PR
- CI must be green: No bypassing checks
- Monitoring required: 48-hour stability period post-deployment
