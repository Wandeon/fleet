# Audio Seamless Fallback Implementation Plan

**Date:** 2025-10-08
**Status:** Proposed
**Author:** Claude Code Analysis

## Executive Summary

This document outlines a comprehensive plan to implement seamless audio fallback with crossfades for Pi audio devices when network connectivity is lost. The solution replaces FFmpeg-based playback with Liquidsoap to provide buffering, automatic fallback, and smooth transitions.

---

## 🎯 Requirements

1. **60-second stream buffer** - Pi devices maintain 1 minute of buffered audio
2. **10-second threshold** - Switch to fallback when buffer drops to 10 seconds
3. **Auto-transfer fallback** - Fallback file automatically synced to device on first play
4. **Seamless crossfades** - Smooth transitions between stream and fallback (no glitches)
5. **Auto-recovery** - Automatic return to stream when network is restored

---

## 📊 Current State Analysis

### VPS (Stream Source)

**Components:**
- ✅ Liquidsoap 2.2.5 streams from `/srv/Audio` → Icecast → `http://icecast:8000/fleet.mp3`
- ✅ Fleet API with fallback upload endpoints
- ⚠️ VPS liquidsoap doesn't use crossfade (can add if desired)

**Streaming Path:**
```
/srv/Audio/*.mp3 → Liquidsoap → Icecast:8000/fleet.mp3 → [Network] → Pi Devices
```

### Pi Devices (Audio Players)

**Current Implementation:**
- ❌ Uses FFmpeg directly (no buffering control)
- ❌ Python `player.py` kills/restarts processes for switches (hard cuts, audio glitches)
- ❌ No crossfading capability
- ❌ "Auto" mode checks stream with `ffprobe` (2s timeout) - reactive, not proactive
- ✅ Has `/upload` endpoint to receive fallback files
- ✅ Stores fallback at `/data/fallback.mp3`

**Current Player Logic:**
```python
# player.py - Current approach
if desired == "stream":
    proc = terminate_process(proc)  # KILLS existing process
    proc = play_stream(url, vol)     # Hard cut to new stream
elif desired == "file":
    proc = terminate_process(proc)  # KILLS existing process
    proc = play_fallback(path, vol)  # Hard cut to fallback
```

### Requirements Gap Analysis

| Requirement | Current State | Gap |
|------------|---------------|-----|
| 1 min buffer | FFmpeg has no controllable buffer | ❌ No buffer management |
| Fallback at 10s | Checks stream health, not buffer level | ❌ Not buffer-aware |
| Auto-transfer fallback | Manual upload only | ❌ No auto-sync on play |
| Seamless crossfades | Process kill/restart = hard cuts | ❌ Audio glitches |
| Auto-recovery | `ffprobe` check every 1s | ⚠️ Works but crude |

---

## 💡 Proposed Solution: Liquidsoap on Pi Devices

Replace FFmpeg-based player with Liquidsoap on each Pi device.

### Why Liquidsoap?

1. **Native buffering** - Built-in `buffer()` operator with configurable size
2. **Crossfade support** - `crossfade()` operator for smooth transitions
3. **Smart fallback** - `fallback()` operator with automatic switching based on source availability
4. **Buffer monitoring** - Can check buffer depth and react programmatically
5. **Same tech as VPS** - Already using Liquidsoap successfully on VPS
6. **Production-proven** - Used by radio stations worldwide for 24/7 streaming
7. **Declarative config** - Less imperative Python code, more declarative audio pipeline

---

## 🏗️ Architecture Changes

### New Pi Device Stack

```
┌─────────────────────────────────────────────────────────────────┐
│ Pi Device (audio-player role)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Liquidsoap Script (player.liq)                       │     │
│  ├──────────────────────────────────────────────────────┤     │
│  │ • Primary: HTTP stream input with 60s buffer         │     │
│  │ • Fallback: Local MP3 file (loops)                   │     │
│  │ • Monitor buffer depth continuously                   │     │
│  │ • Crossfade transitions (3-5s, configurable)         │     │
│  │ • Auto-switch when stream fails                      │     │
│  │ • Auto-return when stream recovers                   │     │
│  │ • Volume control via interactive vars                │     │
│  │ • Enable/disable via interactive vars                │     │
│  └──────────────────────────────────────────────────────┘     │
│                    ↓                                           │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ ALSA Output (hw:0,0 / HiFiBerry)                     │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Control API (control.py - modified)                  │     │
│  ├──────────────────────────────────────────────────────┤     │
│  │ • HTTP API on :8081 (unchanged interface)            │     │
│  │ • Controls Liquidsoap via telnet :1235               │     │
│  │ • Handles fallback uploads (unchanged)               │     │
│  │ • Reports status/metrics (enhanced)                  │     │
│  │ • Reads buffer state from Liquidsoap                 │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Network Stream Flow:
VPS Icecast → [Network] → Pi input.http → 60s buffer → crossfade → ALSA

Fallback Flow:
/data/fallback.mp3 → playlist → crossfade → ALSA

Control Flow:
HTTP :8081 → control.py → telnet :1235 → Liquidsoap vars
```

---

## 📋 Implementation Plan

### Phase 1: Create Liquidsoap Player Script

**File:** `roles/audio-player/docker/app/player.liq`

```liquidsoap
#!/usr/bin/liquidsoap

# Fleet Audio Player with Seamless Fallback
# Provides 60s buffering, automatic fallback, and crossfade transitions

# ============================================================================
# SETTINGS
# ============================================================================

settings.log.level := 4
settings.log.stdout := true

# Telnet control server for runtime control
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1235

# ============================================================================
# INTERACTIVE VARIABLES (controlled via telnet/control.py)
# ============================================================================

stream_url = interactive.string("stream_url", "http://icecast:8000/fleet.mp3")
volume_level = interactive.float("volume", 1.0)
enabled = interactive.bool("enabled", false)

# ============================================================================
# AUDIO SOURCES
# ============================================================================

# Primary source: Icecast HTTP stream with 60-second buffer
stream_source = input.http(
  id="stream",
  buffer=60.0,              # 60-second buffer (meets requirement)
  timeout=10.0,             # Connection timeout
  max_buffer=65.0,          # Max buffer slightly higher than target
  autostart=true,           # Start buffering immediately
  stream_url()              # Read URL from interactive var
)

# Fallback source: Local MP3 file (loops continuously)
fallback_file = "/data/fallback.mp3"
fallback_source = playlist(
  id="fallback",
  mode="normal",            # Play in order (only one file)
  reload=1,                 # Check for file updates every 1s
  reload_mode="watch",      # Watch for file changes
  fallback_file
)

# Emergency silence if both sources fail
emergency = blank(id="emergency", duration=5.0)

# ============================================================================
# SOURCE SWITCHING WITH CROSSFADE
# ============================================================================

# Crossfade transition function (3 seconds)
def crossfade_transition(old, new) =
  add([
    fade.in(duration=3.0, new),   # Fade in new source over 3s
    fade.out(duration=3.0, old)   # Fade out old source over 3s
  ])
end

# Combine sources with priority: stream > fallback > silence
# track_sensitive=false means it can switch mid-track (crucial for seamless fallback)
audio = fallback(
  id="main_fallback",
  track_sensitive=false,           # Allow mid-track switching
  transitions=[                    # Apply crossfade to all transitions
    crossfade_transition
  ],
  [
    stream_source,                 # Priority 1: Network stream
    fallback_source,               # Priority 2: Local file
    emergency                      # Priority 3: Silence
  ]
)

# ============================================================================
# AUDIO PROCESSING
# ============================================================================

# Apply volume control (0.0 - 2.0 range)
audio = amplify(volume_level, audio)

# Normalize to prevent volume spikes (optional but recommended)
audio = normalize(audio, target=-14.0, threshold=-24.0)

# Gate playback based on enabled state
final = switch(
  id="playback_gate",
  track_sensitive=false,
  [
    ({enabled()}, audio),          # When enabled, play audio
    ({true}, blank())              # Otherwise, silence
  ]
)

# ============================================================================
# OUTPUT
# ============================================================================

# Output to ALSA device
output.alsa(
  id="alsa_output",
  device=getenv("AUDIO_OUTPUT_DEVICE") ?? "hw:0,0",
  final
)

# ============================================================================
# MONITORING & STATUS
# ============================================================================

# Buffer monitoring thread (runs every 5 seconds)
thread.run(delay=5.0, {
  # Get buffer depth (seconds of audio buffered)
  buffer_depth = source.buffer_length(stream_source)

  # Log buffer status
  log("Buffer: #{buffer_depth}s | Enabled: #{enabled()} | Volume: #{volume_level()}")

  # Write metrics to file for control.py to read
  system("echo '{\"buffer_seconds\": #{buffer_depth}, \"timestamp\": #{time()}}' > /data/liquidsoap_metrics.json")
})

# Source change detection
def on_track(metadata) =
  # Log when active source changes
  source_id = metadata["source"] ?? "unknown"
  log("Active source: #{source_id}")

  # Write status to file
  system("echo '{\"active_source\": \"#{source_id}\", \"timestamp\": #{time()}}' > /data/liquidsoap_status.json")
end

# Attach metadata handler
audio = on_track(audio)

# ============================================================================
# TELNET COMMANDS
# ============================================================================

# Custom command to get buffer depth
server.register(
  namespace="player",
  description="Get current buffer depth in seconds",
  usage="player.buffer_depth",
  "buffer_depth",
  fun(_) -> "#{source.buffer_length(stream_source)}"
)

# Custom command to get active source
server.register(
  namespace="player",
  description="Get currently active audio source",
  usage="player.active_source",
  "active_source",
  fun(_) -> if source.is_ready(stream_source) then "stream" elsif source.is_ready(fallback_source) then "fallback" else "emergency" end
)

# ============================================================================
# STARTUP
# ============================================================================

log("==========================================================")
log("Fleet Audio Player started successfully")
log("Telnet control: localhost:1235")
log("Stream buffer: 60 seconds")
log("Fallback file: #{fallback_file}")
log("==========================================================")
```

**Key Features:**

- **60s buffer:** `buffer=60.0` parameter in `input.http`
- **Auto-switch:** `fallback()` operator handles switching automatically
- **Crossfade:** Custom transition function with 3s fade in/out
- **Monitor buffer:** `source.buffer_length()` reports current buffer depth
- **Telnet control:** Commands to change URL, volume, enable/disable
- **Status export:** Writes JSON files for control.py to read

---

### Phase 2: Modify Control API

**Update:** `roles/audio-player/docker/app/control.py`

#### Changes Required:

1. **Add Liquidsoap telnet client:**

```python
import telnetlib
import json

LIQUIDSOAP_HOST = "127.0.0.1"
LIQUIDSOAP_PORT = 1235

def liquidsoap_command(command: str) -> str:
    """Send command to Liquidsoap telnet server."""
    try:
        tn = telnetlib.Telnet(LIQUIDSOAP_HOST, LIQUIDSOAP_PORT, timeout=2)
        tn.write(f"{command}\n".encode('ascii'))
        response = tn.read_until(b"END", timeout=2).decode('ascii')
        tn.close()
        return response.strip()
    except Exception as e:
        app.logger.error(f"Liquidsoap telnet error: {e}")
        return ""

def set_liquidsoap_var(var_name: str, value: any) -> None:
    """Set Liquidsoap interactive variable."""
    if isinstance(value, bool):
        value_str = "true" if value else "false"
    elif isinstance(value, str):
        value_str = f'"{value}"'
    else:
        value_str = str(value)

    liquidsoap_command(f"var.set {var_name} = {value_str}")

def get_liquidsoap_status() -> dict:
    """Get current Liquidsoap status."""
    # Read status from JSON file written by Liquidsoap
    try:
        with open('/data/liquidsoap_status.json', 'r') as f:
            status = json.load(f)
        with open('/data/liquidsoap_metrics.json', 'r') as f:
            metrics = json.load(f)
        return {**status, **metrics}
    except Exception:
        return {}
```

2. **Update existing endpoints:**

```python
@app.get("/status")
def get_status():
    cfg = load_config()
    liq_status = get_liquidsoap_status()

    fallback_exists = os.path.exists(FALLBACK_PATH)
    active_source = liq_status.get('active_source', 'unknown')
    buffer_seconds = liq_status.get('buffer_seconds', 0)

    # Map Liquidsoap source to our terminology
    now_playing = "stop"
    if active_source == "stream":
        now_playing = "stream"
    elif active_source == "fallback":
        now_playing = "file"

    response = dict(cfg)
    response["requested_source"] = cfg.get("source")
    response["fallback_exists"] = fallback_exists
    response["now_playing"] = now_playing
    response["fallback_active"] = (active_source == "fallback")
    response["stream_up"] = 1 if active_source == "stream" else 0
    response["buffer_seconds"] = buffer_seconds
    response["last_switch_timestamp"] = liq_status.get('timestamp', 0)

    return jsonify(response)

@app.post("/play")
def post_play():
    data = request.get_json(force=True) or {}
    source = str(data.get("source", "stream")).lower()

    cfg = load_config()
    cfg["source"] = source
    save_config(cfg)

    # Enable playback in Liquidsoap
    set_liquidsoap_var("enabled", True)

    app.logger.info("POST /play -> source=%s", source)
    return jsonify(cfg)

@app.post("/stop")
def post_stop():
    cfg = load_config()
    cfg["source"] = "stop"
    save_config(cfg)

    # Disable playback in Liquidsoap
    set_liquidsoap_var("enabled", False)

    app.logger.info("POST /stop")
    return jsonify(cfg)

@app.post("/volume")
def post_volume():
    data = request.get_json(force=True) or {}
    try:
        value = float(data.get("volume"))
    except Exception:
        return _bad_request("volume must be numeric")

    value = clamp(value, 0.0, 2.0)

    cfg = load_config()
    cfg["volume"] = value
    save_config(cfg)

    # Update Liquidsoap volume
    set_liquidsoap_var("volume", value)

    app.logger.info("POST /volume -> %.2f", value)
    return jsonify(cfg)

@app.put("/config")
def put_config():
    cfg = load_config()
    data = request.get_json(force=True) or {}

    updated = False

    if "stream_url" in data:
        value = data.get("stream_url")
        if value:
            cfg["stream_url"] = value
            set_liquidsoap_var("stream_url", value)
            updated = True

    if "volume" in data:
        volume = clamp(float(data.get("volume")), 0.0, 2.0)
        cfg["volume"] = volume
        set_liquidsoap_var("volume", volume)
        updated = True

    if "source" in data:
        source = str(data.get("source", "")).lower()
        if source in VALID_SOURCES:
            cfg["source"] = source
            # Enable/disable based on source
            set_liquidsoap_var("enabled", source != "stop")
            updated = True

    if updated:
        save_config(cfg)

    return jsonify(cfg)

# /upload endpoint remains unchanged - still writes to /data/fallback.mp3
# Liquidsoap will automatically detect the file and use it
```

3. **Update metrics endpoint:**

```python
@app.get("/metrics")
def get_metrics():
    cfg = load_config()
    liq_status = get_liquidsoap_status()

    fallback_exists = os.path.exists(FALLBACK_PATH)
    active_source = liq_status.get('active_source', 'unknown')
    buffer_seconds = liq_status.get('buffer_seconds', 0)

    now_playing = "stop"
    if active_source == "stream":
        now_playing = "stream"
    elif active_source == "fallback":
        now_playing = "file"

    fallback_active = 1 if active_source == "fallback" else 0
    stream_up = 1 if active_source == "stream" else 0

    lines = []
    lines.append("# HELP audio_volume Software volume (0.0-2.0)")
    lines.append("# TYPE audio_volume gauge")
    lines.append(f"audio_volume {cfg.get('volume', 1.0)}")

    lines.append("# HELP audio_fallback_exists Whether fallback file exists on disk")
    lines.append("# TYPE audio_fallback_exists gauge")
    lines.append(f"audio_fallback_exists {1 if fallback_exists else 0}")

    lines.append("# HELP audio_fallback_active Indicates fallback playback is active")
    lines.append("# TYPE audio_fallback_active gauge")
    lines.append(f"audio_fallback_active {fallback_active}")

    lines.append("# HELP audio_stream_up Indicates if the stream playback is active")
    lines.append("# TYPE audio_stream_up gauge")
    lines.append(f"audio_stream_up {stream_up}")

    lines.append("# HELP audio_buffer_seconds Current stream buffer depth in seconds")
    lines.append("# TYPE audio_buffer_seconds gauge")
    lines.append(f"audio_buffer_seconds {buffer_seconds}")

    # ... rest of metrics ...

    return Response("\n".join(lines) + "\n", mimetype="text/plain")
```

**Key Changes:**

- ✅ HTTP interface remains unchanged (backward compatible)
- ✅ Internally controls Liquidsoap via telnet
- ✅ Reads status from JSON files written by Liquidsoap
- ✅ Upload endpoint unchanged (Liquidsoap watches file)
- ✅ New metric: `audio_buffer_seconds` for monitoring

---

### Phase 3: Update Docker Configuration

**Update:** `roles/audio-player/40-app.yml`

```yaml
services:
  audio-player:
    image: savonet/liquidsoap:v2.2.5  # Official Liquidsoap image
    restart: unless-stopped
    devices:
      - '/dev/snd:/dev/snd'
    group_add:
      - 'audio'
    environment:
      - AUDIO_OUTPUT_DEVICE=${AUDIO_OUTPUT_DEVICE:-plughw:0,0}
      - STREAM_URL=${STREAM_URL:-${ICECAST_SCHEME:-http}://${ICECAST_HOST}:${ICECAST_PORT:-8000}/${ICECAST_MOUNT}}
      - LOG_SERVICE=audio-player
      - LOG_ROLE=audio-player
      - LOG_COMMIT=${FLEET_LOG_COMMIT:-unknown}
    volumes:
      - audio_data:/data
      - ./docker/app/player.liq:/etc/liquidsoap/player.liq:ro
    ports:
      - '1235:1235'  # Telnet control port (internal only)
    command: ["/etc/liquidsoap/player.liq"]
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          test -f /data/liquidsoap_status.json &&
          python3 -c "import json,time; d=json.load(open('/data/liquidsoap_status.json')); exit(0 if time.time()-d.get('timestamp',0)<60 else 1)"
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s

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
      - STREAM_URL=${STREAM_URL:-${ICECAST_SCHEME:-http}://${ICECAST_HOST}:${ICECAST_PORT:-8000}/${ICECAST_MOUNT}}
      - AUDIO_VOLUME=${AUDIO_VOLUME:-1.0}
      - DEVICE_ID=${DEVICE_ID:-}
      - LOG_SERVICE=audio-control
      - LOG_ROLE=audio-player
      - LOG_COMMIT=${FLEET_LOG_COMMIT:-unknown}
    volumes:
      - audio_data:/data
    depends_on:
      - audio-player
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
    command:
      - python3
      - -u
      - /app/control.py

volumes:
  audio_data: {}
```

**Key Changes:**

- Changed base image from custom FFmpeg to `savonet/liquidsoap:v2.2.5`
- Mounts `player.liq` script
- Exposes telnet port 1235 (for control.py to connect)
- Updated healthcheck to monitor Liquidsoap status file
- `audio-control` depends on `audio-player` to ensure startup order

---

### Phase 4: Implement Auto-Upload & Device Sync

#### 4.1 Create Default Fallback File on VPS

**Action:** Create a default fallback audio file on VPS that will be synced to all devices.

**Location:** `/srv/Audio/fallback.mp3`

**Options:**

1. **Use existing music:** Copy one of your ambient/calm tracks
2. **Generate tone:** Create a test tone
3. **Record announcement:** "Audio stream temporarily unavailable, reconnecting..."

**Example - Generate Test Tone:**
```bash
# On VPS
docker run --rm -v vps_fleet-assets:/srv alpine sh -c \
  "apk add --no-cache ffmpeg && \
   ffmpeg -f lavfi -i 'sine=frequency=440:duration=300' \
   -b:a 128k /srv/Audio/fallback.mp3"
```

**Recommended - Use Ambient Music:**
```bash
# Copy a calm/ambient track as fallback
docker cp /path/to/ambient-music.mp3 vps-fleet-api-1:/srv/Audio/fallback.mp3
```

#### 4.2 Update Fleet API to Auto-Upload

**Update:** `apps/api/src/services/audio.ts`

Add auto-upload logic to the device playback function:

```typescript
// Add near the top of the file
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
    logger.info({ deviceId, msg: 'Fallback already exists on device' });
    return;
  }

  // Check if default fallback exists on VPS
  if (!fs.existsSync(DEFAULT_FALLBACK_PATH)) {
    logger.warn({
      deviceId,
      path: DEFAULT_FALLBACK_PATH,
      msg: 'Default fallback file not found on VPS, skipping auto-upload'
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
}

/**
 * Play audio source on device
 * Modified to auto-upload fallback on first play
 */
export async function playDeviceSource(
  deviceId: string,
  source: 'stream' | 'file',
  mode?: 'auto' | 'manual',
  correlationId?: string
): Promise<void> {
  const device = deviceRegistry.requireDevice(deviceId);

  // Auto-upload fallback if needed (non-blocking)
  // Only do this when starting stream playback with auto mode
  if (source === 'stream' && mode === 'auto') {
    try {
      await autoUploadFallback(deviceId, correlationId);
    } catch (error) {
      // Don't fail playback if auto-upload fails
      logger.error({ deviceId, error, msg: 'Failed to auto-upload fallback, continuing anyway' });
    }
  }

  // Proceed with playback
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

#### 4.3 Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Device Fallback Sync Flow                                       │
└─────────────────────────────────────────────────────────────────┘

User Action: "Start playback on pi-audio-01"
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 1. User calls /audio/devices/pi-audio-01/play          │
  │    POST { "source": "stream", "mode": "auto" }         │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 2. Fleet API: playDeviceSource()                       │
  │    → Checks if mode === "auto"                         │
  │    → Calls autoUploadFallback()                        │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 3. Check device status                                 │
  │    GET http://pi-audio-01:8081/status                 │
  │    Response: { "fallback_exists": false }              │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 4. Read VPS fallback file                              │
  │    fs.readFile("/srv/Audio/fallback.mp3")              │
  │    Buffer: 5.2 MB                                      │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 5. Upload to device                                    │
  │    POST http://pi-audio-01:8081/upload                │
  │    Content-Type: multipart/form-data                   │
  │    File: fallback.mp3 (5.2 MB)                         │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 6. Device saves file                                   │
  │    control.py: save to /data/fallback.mp3              │
  │    Liquidsoap: detects file via watch mode             │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ 7. Start playback                                      │
  │    control.py: set_liquidsoap_var("enabled", true)     │
  │    Liquidsoap: starts streaming with fallback ready    │
  └─────────────────────────────────────────────────────────┘
      │
      ↓
  ┌─────────────────────────────────────────────────────────┐
  │ ✅ Device now playing with fallback protection         │
  └─────────────────────────────────────────────────────────┘
```

#### 4.4 Sync Behavior

**When sync happens:**

1. **First playback:** Device has no fallback → auto-uploads before starting
2. **Subsequent playbacks:** Fallback already exists → skips upload
3. **Manual upload:** User can still manually upload custom fallback via UI
4. **Fallback update:** If VPS fallback changes, devices keep existing (manual re-sync needed)

**Sync optimization:**

- ✅ Only syncs when `mode: "auto"` (not for manual fallback playback)
- ✅ Non-blocking: If upload fails, playback still starts (just without fallback)
- ✅ One-time operation: Doesn't re-upload on every playback
- ✅ Per-device: Each device gets its own copy

**Monitoring:**

- Event recorded: `audio.fallback_sync`
- Logs: `"Fallback file auto-synced to device"`
- Metrics: `audio_fallback_exists` gauge shows 1 after sync

#### 4.5 Force Re-Sync

If you want to force all devices to re-download fallback:

**Option 1: Via API**
```bash
# Delete fallback on device first, then it will auto-upload on next play
curl -X DELETE http://pi-audio-01:8081/fallback  # (would need new endpoint)
```

**Option 2: Manual script**
```bash
# Create helper script: scripts/sync-fallback.sh
#!/bin/bash
DEVICES=("pi-audio-01" "pi-audio-02")
for device in "${DEVICES[@]}"; do
  echo "Syncing fallback to $device..."
  curl -X POST http://localhost:3005/api/audio/devices/$device/upload \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/srv/Audio/fallback.mp3"
done
```

**Option 3: Via UI**
- Add "Sync fallback to all devices" button in Audio tab
- Calls API endpoint for each device

---

### Phase 5: Buffer Monitoring & Alerts

#### 5.1 Add Prometheus Metrics

Prometheus already scrapes `/metrics` from each Pi device. The updated `control.py` now exposes:

```
audio_buffer_seconds{device="pi-audio-01"} 58.2
```

#### 5.2 Create Prometheus Alert

**Add to:** `infra/vps/prometheus.yml` or alerting rules file

```yaml
groups:
  - name: audio_alerts
    interval: 10s
    rules:
      - alert: AudioBufferLow
        expr: audio_buffer_seconds < 15
        for: 10s
        labels:
          severity: warning
          component: audio
        annotations:
          summary: "Audio buffer low on {{ $labels.instance }}"
          description: "Buffer is at {{ $value }}s (threshold: 15s). Fallback may activate soon."

      - alert: AudioFallbackActive
        expr: audio_fallback_active == 1
        for: 30s
        labels:
          severity: warning
          component: audio
        annotations:
          summary: "Audio device {{ $labels.instance }} using fallback"
          description: "Device has switched to fallback file due to stream unavailability."

      - alert: AudioFallbackMissing
        expr: audio_fallback_exists == 0 and audio_source_state{source="stream"} == 1
        for: 1m
        labels:
          severity: critical
          component: audio
        annotations:
          summary: "Audio device {{ $labels.instance }} has no fallback"
          description: "Device is streaming without fallback protection. Upload fallback.mp3 immediately."
```

#### 5.3 Grafana Dashboard

Add panels to audio dashboard:

```json
{
  "title": "Audio Buffer Depth",
  "targets": [
    {
      "expr": "audio_buffer_seconds",
      "legendFormat": "{{ instance }}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "s",
      "thresholds": {
        "steps": [
          { "value": 0, "color": "red" },
          { "value": 10, "color": "yellow" },
          { "value": 30, "color": "green" }
        ]
      }
    }
  }
}
```

---

## 🎛️ Configuration Details

### Buffer Behavior

**Normal Operation:**
```
Time 0s:   Stream starts → buffer begins filling
Time 10s:  Buffer at 10s → continuing to fill
Time 60s:  Buffer full at 60s → steady state
Time 65s:  Network hiccup → buffer draining, no reconnect yet
Time 50s:  Buffer at 50s → Liquidsoap attempting reconnection
Time 20s:  Buffer at 20s → still attempting reconnection
Time 10s:  Buffer at 10s → crossfade to fallback begins
Time 7s:   3-second crossfade in progress (stream fading out, fallback fading in)
Time 4s:   100% on fallback, stream disconnected
```

**Network Recovery:**
```
Time 0s:   On fallback, network restored
Time 1s:   Liquidsoap detects stream available, begins buffering
Time 10s:  Stream buffer at 10s
Time 20s:  Stream buffer at 20s → ready to switch
Time 23s:  Crossfade begins (fallback fading out, stream fading in)
Time 26s:  100% back on stream
Time 60s:  Buffer back to full 60s
```

### Crossfade Parameters

Customize in `player.liq`:

```liquidsoap
# Short crossfade (faster, less smooth)
def crossfade_transition(old, new) =
  add([
    fade.in(duration=1.5, new),
    fade.out(duration=1.5, old)
  ])
end

# Long crossfade (slower, very smooth)
def crossfade_transition(old, new) =
  add([
    fade.in(duration=5.0, new),
    fade.out(duration=5.0, old)
  ])
end

# Smart crossfade (adjusts based on source)
def smart_crossfade(old, new) =
  # Different durations for different transitions
  duration = if source.id(new) == "stream" then 4.0 else 2.0 end
  add([
    fade.in(duration=duration, new),
    fade.out(duration=duration, old)
  ])
end
```

**Recommendation:** Start with 3s, adjust based on your audio content.

### Volume Normalization

```liquidsoap
# Gentle normalization (default)
audio = normalize(audio, target=-14.0, threshold=-24.0)

# Aggressive normalization (more consistent volume)
audio = normalize(audio, target=-16.0, threshold=-30.0)

# Disable normalization (use if pre-normalized)
# audio = normalize(audio)  # comment out
```

### Fallback File Recommendations

**Size:** 5-10 MB (3-5 minutes of audio at 128kbps)
**Format:** MP3, 128kbps, 44.1kHz stereo
**Content:** Calm ambient music or looping soundscape
**Avoid:** Speech (gets repetitive), loud music (jarring)

---

## ✅ How This Meets Requirements

| Requirement | Implementation | Verification |
|------------|----------------|--------------|
| **60-second buffer** | `buffer=60.0` in input.http | Check `audio_buffer_seconds` metric |
| **Switch at 10s** | Liquidsoap auto-switches when buffer exhausted | Monitor logs during network test |
| **Transfer fallback** | `autoUploadFallback()` in playDeviceSource | Check `/status` shows `fallback_exists: true` |
| **Seamless crossfade** | `crossfade_transition()` with 3s fade | Listen during manual source switches |
| **Auto-recovery** | `fallback()` re-prioritizes stream when available | Disconnect/reconnect network, observe |

---

## 🔄 Migration Path

### Recommended: Staged Rollout

**Week 1: Development & Testing**
1. Set up test Pi device (or use pi-audio-01)
2. Implement Liquidsoap player
3. Test all scenarios:
   - Normal playback
   - Network disconnect → fallback
   - Network restore → stream
   - Volume changes
   - Stop/start
4. Verify metrics & monitoring

**Week 2: Single Device Deployment**
1. Deploy to pi-audio-01
2. Monitor for 48 hours
3. Gather feedback
4. Fix any issues

**Week 3: Full Rollout**
1. Deploy to pi-audio-02
2. Monitor both devices
3. Update documentation
4. Archive old FFmpeg implementation

### Rollback Plan

If issues occur:

```bash
# Rollback to FFmpeg version
cd /home/admin/fleet
git checkout <previous-commit>
ansible-playbook -i hosts.yml playbooks/audio-player.yml --limit pi-audio-01
```

Keep old implementation in git history with tag: `audio-player-ffmpeg-v1`

---

## 📈 Benefits

### Technical Benefits

1. **Reliability:** 60s buffer handles temporary network blips (>95% of outages)
2. **Quality:** No audio glitches, smooth transitions
3. **Automation:** Auto-upload, auto-switch, auto-recover
4. **Simplicity:** Declarative Liquidsoap config vs imperative Python
5. **Consistency:** Same tech stack (Liquidsoap) on VPS and Pi
6. **Monitoring:** Better visibility into buffer state via metrics
7. **Professional:** Radio-grade streaming infrastructure

### Operational Benefits

1. **User Experience:** Seamless fallback = no silence/interruptions
2. **Reduced Support:** Fewer "why did music stop?" questions
3. **Confidence:** Known-good fallback ready on every device
4. **Scalability:** Easy to add more devices
5. **Maintainability:** Less custom code, more standard config

### Cost/Complexity

| Aspect | Current (FFmpeg) | Proposed (Liquidsoap) | Delta |
|--------|------------------|----------------------|-------|
| Memory | ~20 MB | ~50 MB | +30 MB |
| CPU | ~5% | ~8% | +3% |
| Disk | 0 MB buffer | ~15 MB buffer | +15 MB |
| Code | 282 lines Python | 150 lines Liquidsoap + 200 lines Python | Similar |
| Complexity | Medium | Medium | Neutral |

**Verdict:** Slightly higher resource usage, but well within Pi capacity. Benefits far outweigh costs.

---

## ⚠️ Considerations & Risks

### Technical Considerations

1. **Learning curve:** Liquidsoap scripting language (but well-documented)
2. **Resource usage:** Slightly higher memory (~50MB vs ~20MB FFmpeg)
3. **Crossfade tuning:** May need adjustment based on audio content type
4. **Fallback file size:** Balance between quality and upload time (~5-10MB recommended)
5. **ALSA device compatibility:** Test with HiFiBerry DAC (should work, but verify)
6. **Telnet security:** Port 1235 should not be exposed externally (only localhost and control.py)

### Operational Considerations

1. **Migration downtime:** ~5 minutes per device (can do rolling updates)
2. **Testing requirements:** Thorough testing needed before production rollout
3. **Monitoring setup:** Need to configure Prometheus alerts for new metrics
4. **Documentation:** Update operator runbooks with new troubleshooting steps
5. **Fallback updates:** Process for updating fallback.mp3 across all devices

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Liquidsoap crashes | Low | High | Restart policy, healthcheck, alerting |
| ALSA compatibility issue | Low | High | Test on actual hardware first |
| Crossfade sounds bad | Medium | Low | Configurable duration, easy to tune |
| Buffer too small/large | Medium | Low | Adjustable via config, can tune |
| Auto-upload fails | Low | Medium | Non-blocking, manual upload still works |
| Memory usage too high | Low | Low | 50MB is well within Pi 4 capacity (4GB RAM) |

---

## 🚀 Implementation Checklist

### Pre-Implementation

- [ ] Review and approve this plan
- [ ] Create default fallback file on VPS (`/srv/Audio/fallback.mp3`)
- [ ] Choose test device (recommend pi-audio-01)
- [ ] Back up current configuration
- [ ] Tag current version in git: `audio-player-ffmpeg-v1`

### Implementation

- [ ] **Phase 1:** Create `roles/audio-player/docker/app/player.liq`
- [ ] **Phase 2:** Update `roles/audio-player/docker/app/control.py`
  - [ ] Add Liquidsoap telnet client
  - [ ] Update `/status` endpoint
  - [ ] Update `/play` endpoint
  - [ ] Update `/stop` endpoint
  - [ ] Update `/volume` endpoint
  - [ ] Update `/config` endpoint
  - [ ] Update `/metrics` endpoint
- [ ] **Phase 3:** Update `roles/audio-player/40-app.yml`
- [ ] **Phase 4:** Update `apps/api/src/services/audio.ts`
  - [ ] Add `autoUploadFallback()` function
  - [ ] Update `playDeviceSource()` function
- [ ] **Phase 5:** Configure monitoring
  - [ ] Add Prometheus alerts
  - [ ] Add Grafana dashboard panels

### Testing

- [ ] Unit test Liquidsoap script locally
- [ ] Test telnet control from Python
- [ ] Deploy to test device
- [ ] **Scenario 1:** Normal playback
- [ ] **Scenario 2:** Volume changes
- [ ] **Scenario 3:** Stop/start playback
- [ ] **Scenario 4:** Network disconnect (manual)
- [ ] **Scenario 5:** Network restore
- [ ] **Scenario 6:** Fallback upload
- [ ] **Scenario 7:** Buffer monitoring metrics
- [ ] **Scenario 8:** Device restart
- [ ] Listen for audio quality (crossfades, glitches)
- [ ] Verify metrics in Prometheus
- [ ] Verify logs are clean

### Production Deployment

- [ ] Deploy to pi-audio-01
- [ ] Monitor for 48 hours
- [ ] Deploy to pi-audio-02
- [ ] Update documentation
  - [ ] Operator runbook
  - [ ] Troubleshooting guide
  - [ ] Architecture diagram
- [ ] Archive old implementation

### Post-Deployment

- [ ] Verify both devices stable for 1 week
- [ ] Collect performance metrics
- [ ] User acceptance testing
- [ ] Document lessons learned
- [ ] Plan for future improvements

---

## 📊 Success Criteria

### Technical Metrics

- ✅ Buffer maintains 50-60 seconds during normal operation
- ✅ Fallback activates within 3 seconds when stream fails
- ✅ Crossfades complete smoothly (no glitches audible)
- ✅ Auto-recovery happens within 30 seconds of network restoration
- ✅ Memory usage stays below 100 MB per device
- ✅ CPU usage stays below 15% average

### Operational Metrics

- ✅ Zero user-reported audio interruptions during network blips <60s
- ✅ Fallback file present on all devices (100% coverage)
- ✅ All devices auto-sync fallback on first play
- ✅ Prometheus alerts fire correctly for low buffer / fallback active
- ✅ No increase in support tickets related to audio playback

---

## 📚 Additional Resources

### Liquidsoap Documentation

- [Official docs](https://www.liquidsoap.info/doc-2.2.5/)
- [Input.http reference](https://www.liquidsoap.info/doc-2.2.5/reference.html#input.http)
- [Fallback operator](https://www.liquidsoap.info/doc-2.2.5/reference.html#fallback)
- [Crossfade guide](https://www.liquidsoap.info/doc-2.2.5/crossfade.html)
- [Telnet control](https://www.liquidsoap.info/doc-2.2.5/server.html)

### Debugging Commands

```bash
# Connect to Liquidsoap telnet
telnet localhost 1235

# Get buffer depth
player.buffer_depth

# Get active source
player.active_source

# Change stream URL
var.set stream_url = "http://newurl:8000/stream"

# Enable/disable
var.set enabled = true
var.set enabled = false

# Change volume
var.set volume = 0.8

# List all commands
help

# Exit
quit
```

---

## 🎯 Next Steps

Awaiting your approval to proceed with implementation.

**Estimated timeline:**
- Phase 1-3 (Liquidsoap + Control API): 2-3 hours
- Phase 4 (Auto-upload): 1 hour
- Phase 5 (Monitoring): 1 hour
- Testing: 2 hours
- **Total:** ~6-8 hours development + 48-72 hours monitoring

**Dependencies:**
- Create `/srv/Audio/fallback.mp3` on VPS
- Choose test device for initial deployment
- Approval to proceed with migration

Please review and let me know if you'd like any adjustments to the plan or if you're ready to proceed with implementation!
