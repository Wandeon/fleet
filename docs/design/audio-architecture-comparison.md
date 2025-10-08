# Audio Architecture: Current vs Proposed

## 🔄 We Keep BOTH Icecast AND Add Snapcast

### Current Architecture (Working)

```
┌─────────────────────────────────────────────────────────┐
│ VPS                                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Liquidsoap → Icecast (MP3 @ 128kbps)                   │
│  /srv/Audio   port 8000                                 │
│               http://icecast:8000/fleet.mp3             │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
          ┌───────────────┴────────────────┐
          ↓                                ↓
    ┌──────────────┐                 ┌──────────────┐
    │ Pi Audio-01  │                 │ Pi Audio-02  │
    ├──────────────┤                 ├──────────────┤
    │ FFmpeg       │                 │ FFmpeg       │
    │ (independent)│                 │ (independent)│
    │ → ALSA       │                 │ → ALSA       │
    └──────────────┘                 └──────────────┘

Problem: Devices NOT synchronized (drift 5-10 seconds)
```

---

## Proposed Architecture (Synchronized)

```
┌─────────────────────────────────────────────────────────────────────┐
│ VPS                                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Liquidsoap (single source)                                         │
│  /srv/Audio                                                          │
│       │                                                              │
│       ├─────────→ Icecast (MP3 @ 128kbps)                           │
│       │           port 8000                                          │
│       │           http://icecast:8000/fleet.mp3                     │
│       │           • Web browser playback                            │
│       │           • Monitoring/testing                              │
│       │           • External clients                                │
│       │                                                              │
│       └─────────→ Snapcast Server (PCM @ 48kHz)                     │
│                   port 1705                                          │
│                   • Synchronized distribution                        │
│                   • Time-stamped packets                            │
│                   • Pi device clients                               │
│                         │                                            │
└─────────────────────────┼────────────────────────────────────────────┘
                          │
          ┌───────────────┴────────────────┐
          ↓                                ↓
    ┌──────────────┐                 ┌──────────────┐
    │ Pi Audio-01  │                 │ Pi Audio-02  │
    ├──────────────┤                 ├──────────────┤
    │ Snapcast     │◄────sync────►   │ Snapcast     │
    │ Client       │   protocol      │ Client       │
    │ → ALSA       │                 │ → ALSA       │
    └──────────────┘                 └──────────────┘

Result: Devices PERFECTLY synchronized (±1-2ms precision)
```

---

## Key Points

### ✅ Icecast STAYS - Still Available For:

1. **Web browser playback** - Listen from any device with a browser
2. **External monitoring** - Check what's playing from anywhere
3. **API integration** - Your UI can still fetch stream status
4. **Testing** - Easy to test audio without Pi devices
5. **Compatibility** - Any HTTP client can still connect

### ➕ Snapcast ADDED - Provides:

1. **Synchronized playback** - All Pi devices in perfect sync
2. **Lower latency** - PCM is uncompressed, faster than MP3 decoding
3. **Better quality** - No MP3 re-encoding artifacts
4. **Time coordination** - Built-in clock sync between devices

---

## Liquidsoap Output Configuration

**In the updated `playlist.liq`, Liquidsoap outputs to BOTH:**

```liquidsoap
# Audio source (single pipeline)
source = ...  # Your playlist

# OUTPUT 1: Icecast (MP3 for web/monitoring)
output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password="supersecret",
  mount="fleet.mp3",
  source
)

# OUTPUT 2: Snapcast (PCM for synchronized Pi playback)
output.file(
  %wav(stereo=true, samplerate=48000),
  "/tmp/snapfifo",
  source
)
```

**Same audio goes to both destinations simultaneously!**

---

## Use Cases

| Use Case | Uses | Why |
|----------|------|-----|
| **Pi playback (normal)** | Snapcast | Perfect sync required |
| **Web browser listening** | Icecast | Standard HTTP streaming |
| **Mobile app** | Icecast | Easy HTTP client |
| **Testing/debugging** | Icecast | Can play in VLC/browser |
| **External systems** | Icecast | Standard protocol |

---

## Why Not Just Use Icecast for Everything?

**Icecast (HTTP streaming) cannot provide synchronized playback because:**

1. **HTTP is stateless** - Each client independently fetches audio
2. **No time coordination** - Clients have no shared clock
3. **Network latency varies** - Each device has different buffering
4. **Independent buffering** - Clients buffer at different rates

**Example with Icecast only:**
```
Pi Audio-01: Fetches audio, buffers 5s, network delay 50ms → plays at T+5.05s
Pi Audio-02: Fetches audio, buffers 8s, network delay 120ms → plays at T+8.12s
Audible drift: 3.07 seconds (very noticeable echo!)
```

**Example with Snapcast:**
```
Pi Audio-01: Receives timestamped packet "play at T=10.000s" → plays at T=10.000s
Pi Audio-02: Receives timestamped packet "play at T=10.000s" → plays at T=10.000s
Audible drift: 0.001 seconds (imperceptible!)
```

---

## Resource Impact

### VPS (Before)
- Liquidsoap: 50 MB RAM
- Icecast: 20 MB RAM
- **Total: 70 MB**

### VPS (After)
- Liquidsoap: 50 MB RAM
- Icecast: 20 MB RAM
- Snapcast Server: 15 MB RAM
- **Total: 85 MB (+15 MB)**

### Pi Device (Before)
- FFmpeg: 20 MB RAM
- Control API: 30 MB RAM
- **Total: 50 MB**

### Pi Device (After)
- Snapcast Client: 10 MB RAM
- Control API: 30 MB RAM
- Liquidsoap fallback (idle): 30 MB RAM
- **Total: 70 MB (+20 MB)**

**Cost:** ~35 MB total additional RAM across all devices - negligible!

---

## Migration Strategy

### Phase 1: Add Snapcast (Non-Breaking)

1. Add Snapcast server to VPS
2. Add Snapcast output to Liquidsoap
3. **Icecast keeps working as before**
4. No impact on current system

### Phase 2: Switch Pi Devices One at a Time

1. Update Pi Audio-01 to use Snapcast client
2. Test and verify
3. **Icecast still available for monitoring**
4. Update Pi Audio-02

### Phase 3: Production

- Both Pis using Snapcast (synchronized)
- Icecast still available (web/API/monitoring)
- Best of both worlds!

---

## Fallback Behavior

### Network Failure Scenario

```
Normal State:
  VPS → Snapcast Server → Pi Snapcast Clients → Speakers
  VPS → Icecast Server → [available for web/monitoring]

Network Fails (Pi loses connection to VPS):
  Pi Snapcast Client: disconnects
  Pi Liquidsoap: takes over with local fallback.mp3
  Icecast: STILL WORKS (VPS online, just Pi disconnected)
  You can monitor via Icecast what SHOULD be playing

Network Restores:
  Pi Snapcast Client: reconnects, resumes synchronized playback
  Pi Liquidsoap: stops fallback
  Icecast: Still streaming (never stopped)
```

---

## Benefits of Dual Output

### 1. Monitoring
- Check Icecast stream in browser to verify what's playing
- Compare Pi output to Icecast to debug sync issues

### 2. Flexibility
- Play synchronized on Pi devices (Snapcast)
- Play on any other device via browser (Icecast)

### 3. Debugging
- If Snapcast has issues, can temporarily point Pis at Icecast
- Icecast as fallback for the fallback!

### 4. API Integration
- UI can still show "Now Playing" via Icecast metadata
- No changes to existing monitoring/dashboards

---

## Summary

**We are NOT replacing Icecast with Snapcast.**

**We are ADDING Snapcast alongside Icecast:**

- **Icecast:** General-purpose HTTP streaming (web, mobile, monitoring)
- **Snapcast:** Specialized synchronized playback (Pi devices)

**Liquidsoap outputs to both simultaneously - same audio, two destinations.**

This gives you:
- ✅ Perfect synchronization (Snapcast)
- ✅ Web/browser playback (Icecast)
- ✅ Monitoring capability (Icecast)
- ✅ Maximum flexibility (both protocols available)

**Cost:** ~35 MB additional RAM total - trivial compared to benefits.

Does this clarify the architecture? Both systems work together, not replacing each other!
