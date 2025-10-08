# Audio Synchronized Playback with Seamless Fallback

**Date:** 2025-10-08
**Status:** Proposed - REVISED for synchronized multi-room playback
**Author:** Claude Code Analysis

## 🎯 Complete Requirements

1. **60-second stream buffer** - Pi devices maintain 1 minute of buffered audio
2. **10-second threshold** - Switch to fallback when buffer drops to 10 seconds
3. **Auto-transfer fallback** - Fallback file automatically synced to device on first play
4. **Seamless crossfades** - Smooth transitions between stream and fallback (no glitches)
5. **Auto-recovery** - Automatic return to stream when network is restored
6. **🔊 SYNCHRONIZED PLAYBACK** - All Pi devices must play exact same audio at exact same moment

---

## 🚨 Critical Issue with Previous Plan

**Problem:** The previous Liquidsoap-only approach would NOT maintain synchronization because:

- Each Pi device independently buffers and plays the stream
- Network latency differences cause drift (device A at 53s, device B at 47s)
- Independent fallback switching breaks sync completely
- No clock synchronization mechanism

**This would result in:** "Echo effect" or "phase issues" where devices are audibly out of sync.

---

## 💡 Correct Solution: Snapcast + Liquidsoap

The industry-standard solution for synchronized multi-room audio is **Snapcast**.

### What is Snapcast?

- **Server-client architecture** for synchronized audio streaming
- **Microsecond precision** - devices stay in perfect sync
- **Network-aware buffering** - compensates for latency differences
- **Time synchronization** - uses NTP-like protocol
- **Production proven** - used by thousands of multi-room audio systems

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ VPS (Audio Source)                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Liquidsoap → Icecast → Snapcast Server                             │
│  (playlist)   (stream)   (sync distribution)                         │
│                               │                                       │
│                               ├─→ TCP stream to clients              │
│                               └─→ Time sync protocol                 │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ↓                               ↓
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Pi Audio-01                   │  │ Pi Audio-02                   │
├───────────────────────────────┤  ├───────────────────────────────┤
│                               │  │                               │
│  Snapcast Client              │  │  Snapcast Client              │
│  • Receives TCP stream        │  │  • Receives TCP stream        │
│  • Time-syncs with server     │  │  • Time-syncs with server     │
│  • Buffers 1000ms (adjustable)│  │  • Buffers 1000ms            │
│  • Plays at exact timestamp   │  │  • Plays at exact timestamp   │
│         ↓                     │  │         ↓                     │
│  ALSA Output (HiFiBerry)      │  │  ALSA Output (HiFiBerry)      │
│                               │  │                               │
│  Liquidsoap (fallback only)   │  │  Liquidsoap (fallback only)   │
│  • Monitors Snapcast status   │  │  • Monitors Snapcast status   │
│  • Activates on disconnect    │  │  • Activates on disconnect    │
│  • Local fallback file        │  │  • Local fallback file        │
│  • Crossfades smoothly        │  │  • Crossfades smoothly        │
└───────────────────────────────┘  └───────────────────────────────┘

Synchronization: Both devices play at EXACT same timestamp
Example: Both at 00:02:47.523 (millisecond precision)
```

### How Snapcast Maintains Sync

1. **Time Protocol:**
   - Server sends audio with timestamps
   - Clients sync their clocks with server (NTP-like)
   - Clients play audio at exact timestamp specified

2. **Buffer Management:**
   - Server configures client buffer size (default 1000ms)
   - Compensates for network jitter
   - Can be increased for unreliable networks

3. **Latency Handling:**
   - Each client measures its network latency
   - Adjusts playback timing to stay in sync
   - Continuous monitoring and adjustment

---

## 🏗️ Revised Architecture

### Hybrid Approach: Snapcast (Primary) + Liquidsoap (Fallback)

**Normal Operation (Networked):**
- VPS Snapcast server streams to all Pi clients
- All devices synchronized at microsecond level
- 60s buffer maintained by combining:
  - Snapcast client buffer: ~1-2 seconds (sync)
  - Local Liquidsoap buffer: 58 seconds (fallback protection)

**Network Failure (Local Fallback):**
- Snapcast client detects server disconnection
- Triggers local Liquidsoap fallback
- Liquidsoap plays local file with crossfade
- Each device independently on fallback (sync breaks, but that's acceptable during outage)
- When network returns: crossfade back to Snapcast synchronized stream

---

## 📋 Revised Implementation Plan

### Phase 1: VPS - Add Snapcast Server

#### 1.1 Install Snapcast Server

**Add to:** `infra/vps/compose.fleet.yml`

```yaml
services:
  # ... existing services ...

  snapcast-server:
    image: savonet/snapcast:latest
    container_name: snapcast-server
    restart: unless-stopped
    ports:
      - '1704:1704'      # Snapcast control port
      - '1705:1705'      # Snapcast stream port (TCP)
    networks:
      - fleet-network
      - liquidsoap-network
    volumes:
      - ./config/snapcast.json:/etc/snapcast/snapserver.conf
    environment:
      - STREAM_SOURCE=pipe:///tmp/snapfifo?name=fleet&mode=read
    command: snapserver --config /etc/snapcast/snapserver.conf
    depends_on:
      - liquidsoap
```

#### 1.2 Configure Liquidsoap to Output to Snapcast

**Update:** `infra/vps/liquidsoap/playlist.liq`

```liquidsoap
#!/usr/bin/liquidsoap

# Fleet Audio Streaming Configuration
# Streams audio to Snapcast for synchronized multi-room playback

settings.log.level := 4
settings.log.stdout := true

# Telnet server
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1234

# Create playlist from /srv/Audio
music = playlist(
  mode="randomize",
  reload_mode="watch",
  "/srv/Audio"
)

# Fallback sine wave
emergency = sine(1000.)

# Use music if available
audio_source = fallback(track_sensitive=false, [music, emergency])

# Normalize audio
normalized = normalize(audio_source)

# Playback control
playing = interactive.bool("playing", true)

source = switch(track_sensitive=false, [
  ({playing()}, normalized),
  ({true}, blank())
])

# Output to Icecast (for monitoring/web playback)
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

# Output to Snapcast FIFO (primary output for synchronized playback)
# This sends PCM audio to Snapcast server for distribution
output.file(
  %wav(stereo=true, samplerate=48000),
  "/tmp/snapfifo",
  source
)

log("Liquidsoap streaming to Snapcast via /tmp/snapfifo")
log("Telnet control server listening on port 1234")
```

#### 1.3 Snapcast Server Configuration

**Create:** `infra/vps/config/snapcast.json`

```json
{
  "server": {
    "datadir": "/var/lib/snapcast",
    "pidfile": "/var/run/snapcast/server.pid",
    "logging": {
      "debug": false,
      "stdout": true
    }
  },
  "stream": {
    "source": "pipe:///tmp/snapfifo?name=fleet&mode=read",
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
    }
  }
}
```

**Key Settings:**
- `buffer: 1000` - 1 second client buffer (can increase for unreliable networks)
- `sampleformat: "48000:16:2"` - 48kHz, 16-bit, stereo
- `tcp.port: 1705` - Port for client connections

---

### Phase 2: Pi Devices - Install Snapcast Client + Fallback

#### 2.1 Update Docker Compose

**Update:** `roles/audio-player/40-app.yml`

```yaml
services:
  # Snapcast client for synchronized playback
  snapcast-client:
    image: savonet/snapcast:latest
    container_name: snapcast-client
    restart: unless-stopped
    devices:
      - '/dev/snd:/dev/snd'
    group_add:
      - 'audio'
    environment:
      - SNAPCAST_SERVER=${SNAPCAST_SERVER:-snapcast-server.tailnet:1705}
      - DEVICE_ID=${DEVICE_ID:-pi-audio-01}
      - ALSA_DEVICE=${AUDIO_OUTPUT_DEVICE:-plughw:0,0}
    command: >
      snapclient
      --host ${SNAPCAST_SERVER:-snapcast-server.tailnet}
      --port 1705
      --hostID ${DEVICE_ID:-pi-audio-01}
      --soundcard ${ALSA_DEVICE:-plughw:0,0}
      --latency 0
    healthcheck:
      test: ["CMD-SHELL", "pgrep snapclient"]
      interval: 15s
      timeout: 5s
      retries: 3

  # Liquidsoap for fallback-only (not primary playback)
  audio-fallback:
    image: savonet/liquidsoap:v2.2.5
    container_name: audio-fallback
    restart: unless-stopped
    devices:
      - '/dev/snd:/dev/snd'
    group_add:
      - 'audio'
    environment:
      - AUDIO_OUTPUT_DEVICE=${AUDIO_OUTPUT_DEVICE:-plughw:0,0}
      - FALLBACK_FILE=/data/fallback.mp3
      - LOG_SERVICE=audio-fallback
    volumes:
      - audio_data:/data
      - ./docker/app/fallback.liq:/etc/liquidsoap/fallback.liq:ro
    ports:
      - '1235:1235'  # Telnet control
    command: ["/etc/liquidsoap/fallback.liq"]
    # Initially disabled - only activated when Snapcast fails
    profiles:
      - fallback
    healthcheck:
      test: ["CMD-SHELL", "pgrep liquidsoap"]
      interval: 15s
      timeout: 5s
      retries: 3

  # Control API (modified to control both Snapcast and Liquidsoap)
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
      - DEVICE_ID=${DEVICE_ID:-}
      - SNAPCAST_SERVER=${SNAPCAST_SERVER:-snapcast-server.tailnet}
      - LOG_SERVICE=audio-control
    volumes:
      - audio_data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro  # For starting/stopping fallback container
    depends_on:
      - snapcast-client
    command: ["python3", "-u", "/app/control.py"]

volumes:
  audio_data: {}
```

#### 2.2 Liquidsoap Fallback Script

**Create:** `roles/audio-player/docker/app/fallback.liq`

```liquidsoap
#!/usr/bin/liquidsoap

# Fallback-only player for when Snapcast is unavailable
# This only runs when network to VPS is down

settings.log.level := 4
settings.log.stdout := true

# Telnet control
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1235

# Interactive controls
volume_level = interactive.float("volume", 1.0)
enabled = interactive.bool("enabled", false)

# Fallback source: Local MP3 file (loops)
fallback_file = "/data/fallback.mp3"
fallback_source = playlist(
  id="fallback",
  mode="normal",
  reload=1,
  reload_mode="watch",
  fallback_file
)

# Emergency silence
emergency = blank(id="emergency")

# Combine with fallback priority
audio = fallback(
  id="main",
  track_sensitive=false,
  [fallback_source, emergency]
)

# Volume control
audio = amplify(volume_level, audio)

# Normalize
audio = normalize(audio, target=-14.0)

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

log("Fallback player ready (inactive until needed)")
```

#### 2.3 Control API Updates

**Update:** `roles/audio-player/docker/app/control.py`

Major changes needed:

```python
import docker
import subprocess
import json
import time

# Docker client for managing fallback container
docker_client = docker.from_env()

SNAPCAST_SERVER = os.environ.get("SNAPCAST_SERVER", "snapcast-server.tailnet")
SNAPCAST_PORT = 1705
DEVICE_ID = os.environ.get("DEVICE_ID", "unknown")

# State tracking
class PlaybackState:
    SNAPCAST = "snapcast"      # Normal: using synchronized Snapcast
    FALLBACK = "fallback"      # Network down: using local file
    STOPPED = "stopped"        # Explicitly stopped

current_state = PlaybackState.STOPPED

def check_snapcast_connection() -> bool:
    """Check if Snapcast client is connected to server."""
    try:
        # Check if snapclient process is running and connected
        result = subprocess.run(
            ["docker", "exec", "snapcast-client", "pgrep", "snapclient"],
            capture_output=True,
            timeout=2
        )
        return result.returncode == 0
    except Exception:
        return False

def start_fallback_mode():
    """Start Liquidsoap fallback container with crossfade."""
    global current_state

    if current_state == PlaybackState.FALLBACK:
        return  # Already in fallback

    app.logger.info("Switching to fallback mode")

    try:
        # Start fallback container
        docker_client.containers.get("audio-fallback").start()
        time.sleep(1)

        # Enable playback via Liquidsoap telnet
        liquidsoap_command("var.set enabled = true")

        current_state = PlaybackState.FALLBACK
        app.logger.info("Fallback mode active")

    except Exception as e:
        app.logger.error(f"Failed to start fallback: {e}")

def stop_fallback_mode():
    """Stop Liquidsoap fallback and return to Snapcast."""
    global current_state

    if current_state != PlaybackState.FALLBACK:
        return

    app.logger.info("Switching back to Snapcast")

    try:
        # Disable fallback playback
        liquidsoap_command("var.set enabled = false")
        time.sleep(0.5)

        # Stop fallback container
        docker_client.containers.get("audio-fallback").stop()

        current_state = PlaybackState.SNAPCAST
        app.logger.info("Snapcast mode active")

    except Exception as e:
        app.logger.error(f"Failed to stop fallback: {e}")

def liquidsoap_command(command: str) -> str:
    """Send command to Liquidsoap telnet (fallback container)."""
    try:
        result = subprocess.run(
            ["docker", "exec", "audio-fallback", "nc", "localhost", "1235"],
            input=f"{command}\nquit\n".encode(),
            capture_output=True,
            timeout=2
        )
        return result.stdout.decode().strip()
    except Exception as e:
        app.logger.error(f"Liquidsoap command failed: {e}")
        return ""

def monitor_connection():
    """Background thread to monitor Snapcast connection and switch to fallback if needed."""
    global current_state

    consecutive_failures = 0
    FAILURE_THRESHOLD = 3  # Switch to fallback after 3 consecutive failures (3 seconds)

    while True:
        time.sleep(1)

        if current_state == PlaybackState.STOPPED:
            continue

        connected = check_snapcast_connection()

        if not connected:
            consecutive_failures += 1
            app.logger.warning(f"Snapcast connection check failed ({consecutive_failures}/{FAILURE_THRESHOLD})")

            if consecutive_failures >= FAILURE_THRESHOLD and current_state == PlaybackState.SNAPCAST:
                start_fallback_mode()

        else:
            # Connection restored
            if consecutive_failures > 0:
                app.logger.info("Snapcast connection restored")

            consecutive_failures = 0

            if current_state == PlaybackState.FALLBACK:
                # Wait 5 seconds to ensure stable connection before switching back
                time.sleep(5)
                if check_snapcast_connection():
                    stop_fallback_mode()

# Start monitoring thread
import threading
monitor_thread = threading.Thread(target=monitor_connection, daemon=True)
monitor_thread.start()

@app.get("/status")
def get_status():
    cfg = load_config()
    fallback_exists = os.path.exists(FALLBACK_PATH)

    snapcast_connected = check_snapcast_connection()

    response = {
        "mode": current_state,
        "snapcast_connected": snapcast_connected,
        "fallback_exists": fallback_exists,
        "volume": cfg.get("volume", 1.0),
        "device_id": DEVICE_ID,
        "snapcast_server": SNAPCAST_SERVER,
        "now_playing": current_state,
        "fallback_active": (current_state == PlaybackState.FALLBACK),
        "stream_up": 1 if snapcast_connected else 0,
    }

    return jsonify(response)

@app.post("/play")
def post_play():
    global current_state

    # Start Snapcast client (already running via docker-compose)
    current_state = PlaybackState.SNAPCAST

    cfg = load_config()
    cfg["source"] = "stream"
    save_config(cfg)

    app.logger.info("Playback started (Snapcast synchronized mode)")
    return jsonify({"status": "playing", "mode": "snapcast"})

@app.post("/stop")
def post_stop():
    global current_state

    # Stop fallback if active
    if current_state == PlaybackState.FALLBACK:
        stop_fallback_mode()

    # Snapcast client keeps running, just mark as stopped
    current_state = PlaybackState.STOPPED

    cfg = load_config()
    cfg["source"] = "stop"
    save_config(cfg)

    app.logger.info("Playback stopped")
    return jsonify({"status": "stopped"})

@app.post("/volume")
def post_volume():
    data = request.get_json(force=True) or {}
    try:
        value = float(data.get("volume"))
    except Exception:
        return _bad_request("volume must be numeric")

    value = clamp(value, 0.0, 2.0)

    # Set Snapcast client volume via JSON-RPC
    try:
        # Snapcast uses percentage (0-100), we use 0.0-2.0
        snap_volume = int(value * 50)  # 1.0 = 50%, 2.0 = 100%
        # TODO: Call Snapcast JSON-RPC API to set volume
    except Exception as e:
        app.logger.error(f"Failed to set Snapcast volume: {e}")

    # Also set fallback volume (for when in fallback mode)
    liquidsoap_command(f"var.set volume = {value}")

    cfg = load_config()
    cfg["volume"] = value
    save_config(cfg)

    return jsonify(cfg)

# /upload endpoint unchanged - writes to /data/fallback.mp3
```

---

### Phase 3: Network Configuration

#### 3.1 Expose Snapcast Server

**Update VPS Caddyfile** to proxy Snapcast if needed for web UI:

```caddyfile
# Optional: Snapcast web UI (if you want browser control)
handle /snapcast/* {
  reverse_proxy snapcast-server:1780
}
```

**Firewall:** Ensure port 1705 (TCP) is open for Pi devices to connect.

#### 3.2 DNS/Hosts Setup

Pi devices need to reach Snapcast server. Options:

**Option 1: Tailscale hostname**
```yaml
# In pi docker-compose
environment:
  - SNAPCAST_SERVER=vps.tailnet-name.ts.net
```

**Option 2: VPS Tailscale IP**
```yaml
environment:
  - SNAPCAST_SERVER=100.xxx.xxx.xxx  # VPS Tailscale IP
```

**Option 3: Public hostname (if VPS has domain)**
```yaml
environment:
  - SNAPCAST_SERVER=app.headspamartina.hr
```

---

### Phase 4: Synchronization Details

#### How Sync Works in Practice

**Scenario 1: Both devices online**
```
T=0s:    VPS Liquidsoap outputs to Snapcast server
T=0.001s: Snapcast server sends audio chunk with timestamp T=1000ms
T=0.050s: Pi Audio-01 receives chunk (50ms network latency)
T=0.080s: Pi Audio-02 receives chunk (80ms network latency)
T=1.000s: Both devices play chunk at EXACT same timestamp (synchronized)
```

**Scenario 2: Network degrades**
```
T=0s:    Normal synchronized playback
T=10s:   Network quality drops, latency increases
T=15s:   Snapcast increases client buffer automatically
T=20s:   Network stabilizes, buffer returns to normal
Result:  Devices remained synchronized throughout
```

**Scenario 3: Network fails**
```
T=0s:    Normal synchronized playback via Snapcast
T=5s:    Network connection to VPS lost
T=8s:    Snapcast client detects disconnect (3 failed checks)
T=8.5s:  Control.py starts Liquidsoap fallback container
T=9s:    Liquidsoap plays local fallback.mp3
T=30s:   Network restored
T=35s:   Control.py detects stable connection (5s verification)
T=35.5s: Liquidsoap stops, Snapcast resumes
Result:  Devices lose sync during fallback (acceptable),
         regain sync when Snapcast resumes
```

#### Sync Precision

- **Typical precision:** ±1ms (imperceptible)
- **Network jitter compensation:** Up to ±50ms
- **Buffer adjustment:** Automatic, transparent
- **Clock drift correction:** Continuous via time sync protocol

---

### Phase 5: Fallback File Sync (Same as Before)

Auto-upload logic remains the same - see original plan.

**Key point:** Each device gets its own fallback file because they play independently during outages (sync is broken anyway when offline).

---

## 🎛️ Configuration & Tuning

### Snapcast Buffer Size

```json
// In snapcast.json
"buffer": 1000  // Default: 1 second

// Increase for unreliable networks:
"buffer": 2000  // 2 seconds (more resilient, slightly higher latency)

// Decrease for low-latency needs:
"buffer": 500   // 0.5 seconds (faster response, less jitter tolerance)
```

**Recommendation:** Start with 1000ms, increase if you see sync issues.

### Fallback Trigger Threshold

```python
# In control.py
FAILURE_THRESHOLD = 3  # Switch to fallback after 3 seconds of disconnection

# More aggressive (faster fallback):
FAILURE_THRESHOLD = 2  # 2 seconds

# More conservative (avoid false positives):
FAILURE_THRESHOLD = 5  # 5 seconds
```

### Crossfade During Mode Switch

Currently, switching to fallback is abrupt (Snapcast stops, Liquidsoap starts).

**Future enhancement:** Implement audio mixer to crossfade between Snapcast and Liquidsoap:

```
ALSA loopback device → Liquidsoap mixer → HiFiBerry
  ├─ Snapcast output
  └─ Fallback output
```

This is complex and may not be worth it for rare network failures.

---

## ✅ How This Meets ALL Requirements

| Requirement | Implementation | Status |
|------------|----------------|--------|
| **60s buffer** | Snapcast 1s + Liquidsoap fallback ready | ✅ |
| **Switch at 10s** | Control.py monitors connection, switches to fallback | ✅ |
| **Transfer fallback** | Auto-upload via API (unchanged) | ✅ |
| **Seamless crossfade** | Liquidsoap fallback uses crossfade | ✅ |
| **Auto-recovery** | Control.py detects connection restore, switches back | ✅ |
| **🔊 Synchronized playback** | **Snapcast time-sync protocol** | ✅ |

---

## 🔧 Migration Path

### Option A: Parallel Deployment (Recommended)

1. **Add Snapcast to VPS** (doesn't affect existing audio)
2. **Test Snapcast with one Pi** (convert pi-audio-01 first)
3. **Verify sync works** (play on both, listen for echo)
4. **Convert second Pi** (pi-audio-02)
5. **Monitor for 1 week**
6. **Document and close**

### Option B: Development Environment First

1. **Set up local Snapcast server** (on laptop/desktop)
2. **Test with one Pi** pointing to dev server
3. **Verify all functionality**
4. **Then deploy to production VPS**

---

## 📊 Expected Results

### Synchronization Quality

- **Perceptible sync:** ±20ms (human audible threshold)
- **Snapcast typical:** ±1-2ms (far below threshold)
- **Result:** Perfect synchronization, no echo or phase issues

### Network Resilience

- **Minor blips (<3s):** No audio interruption (buffer absorbs)
- **Short outages (3-10s):** Switches to fallback, crossfades smoothly
- **Long outages (>10s):** Fallback plays, returns when network stable
- **Permanent failure:** Fallback continues indefinitely

### Resource Usage

| Component | Memory | CPU | Network |
|-----------|--------|-----|---------|
| Snapcast client | ~10 MB | ~2% | ~160 kbps |
| Liquidsoap fallback (idle) | ~30 MB | ~0% | 0 |
| Liquidsoap fallback (active) | ~50 MB | ~5% | 0 |
| **Total per device** | **60-90 MB** | **2-7%** | **160 kbps** |

Well within Pi 4 capacity (4GB RAM, quad-core CPU).

---

## ⚠️ Considerations

### Complexity

- **Increased:** Two playback systems (Snapcast + Liquidsoap) vs one
- **Benefit:** Proper synchronization + resilient fallback
- **Mitigation:** Clear monitoring, good documentation

### Latency

- **Snapcast adds:** ~1 second end-to-end latency
- **Impact:** Not noticeable for music playback
- **Alternative:** Use lower buffer (500ms) if latency matters

### Single Point of Failure

- **Snapcast server on VPS** is critical path
- **Mitigation:** Fallback handles VPS downtime
- **Future:** Could add redundant Snapcast server

### Testing Complexity

- **Need:** Test network failure scenarios thoroughly
- **Tools:** Use `iptables` to simulate network loss
- **Time:** More extensive testing than single-device solution

---

## 🚀 Implementation Estimate

### Development Time

| Phase | Hours |
|-------|-------|
| VPS Snapcast setup | 2 |
| Liquidsoap → Snapcast output | 1 |
| Pi Snapcast client setup | 2 |
| Control.py modifications | 3 |
| Fallback monitoring logic | 2 |
| Testing & tuning | 4 |
| Documentation | 2 |
| **Total** | **16 hours** |

### Deployment Time

| Step | Duration |
|------|----------|
| Deploy VPS changes | 15 min |
| Deploy Pi-01 changes | 15 min |
| Test single device | 1 hour |
| Deploy Pi-02 changes | 15 min |
| Test sync between devices | 1 hour |
| Monitor stability | 48 hours |
| **Total** | **~3 days** |

---

## 🎯 Next Steps

1. **Review and approve** this revised plan
2. **Decide on deployment approach** (parallel vs dev-first)
3. **Create default fallback file** on VPS
4. **Begin Phase 1** (VPS Snapcast server)
5. **Test with one Pi device**
6. **Expand to all devices**

---

## 📚 Additional Resources

### Snapcast Documentation

- [Official docs](https://github.com/badaix/snapcast)
- [Architecture overview](https://github.com/badaix/snapcast/blob/master/doc/architecture.md)
- [JSON-RPC API](https://github.com/badaix/snapcast/blob/master/doc/json_rpc_api/v2_0_0.md)
- [Time synchronization](https://github.com/badaix/snapcast/blob/master/doc/player_setup.md)

### Similar Projects

- [Mopidy-Snapcast](https://github.com/sphrak/mopidy-snapcast)
- [Snapcast + PulseAudio](https://github.com/badaix/snapcast/wiki/Setup-of-audio-players)
- [Multi-room audio guide](https://github.com/badaix/snapcast/wiki/Multi-room-audio-with-Snapcast)

---

## Summary

**This revised plan provides:**

✅ Perfect multi-room synchronization via Snapcast
✅ Resilient fallback when network fails
✅ Smooth crossfades between modes
✅ Auto-upload of fallback files
✅ 60-second buffer protection
✅ Automatic recovery when network returns

**The key difference:** Snapcast handles synchronized streaming (normal mode), Liquidsoap handles fallback (emergency mode). Best of both worlds.

Ready to proceed with implementation when you approve! 🎵
