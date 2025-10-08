# Snapcast Deployment - READY ✅

**Date:** 2025-10-08
**VPS Snapcast Server:** ✅ RUNNING AND STREAMING
**Fallback File:** ✅ CREATED (Beautiful Relaxing Music.mp3, 166MB)

---

## VPS Status - ✅ COMPLETE

### Snapcast Server
```bash
docker logs snapcast-server --tail 5
# Output: State changed: default, state: idle => playing
# Status: STREAMING AUDIO via FIFO
```

### Liquidsoap
```bash
docker logs liquidsoap --tail 5
# Output: output.file gets up with content type: {audio=pcm(stereo)}
# Status: OUTPUTTING TO BOTH Icecast AND Snapcast FIFO
```

### VPS Tailscale IP
```
100.64.123.81
```

---

## Pi Device Deployment Commands

### Prerequisites on Pi Devices

The following files are ready in `/home/admin/fleet/roles/audio-player/`:
- `40-app.yml` - Updated with Snapcast services
- `docker/app/control_snapcast.py` - Snapcast-aware control API
- `docker/app/fallback.liq` - Local fallback script
- `.env.snapcast.example` - Environment template

### Deploy to pi-audio-01

```bash
# SSH to device
ssh pi-audio-01

# Navigate to fleet repo
cd /opt/fleet

# Pull latest changes
sudo git pull

# Navigate to role
cd roles/audio-player

# Create .env file
sudo cp .env.snapcast.example .env

# Edit with correct values
sudo nano .env
```

**Set these values in .env:**
```bash
DEVICE_ID=pi-audio-01
SNAPCAST_SERVER=100.64.123.81
AUDIO_OUTPUT_DEVICE=plughw:0,0
AUDIO_VOLUME=0.0
AUDIO_CONTROL_TOKEN=changeme-token
```

**Save and trigger deployment:**
```bash
# Let role-agent pick up changes
sudo systemctl restart role-agent

# Monitor deployment
journalctl -u role-agent -f

# After deployment completes, verify containers
docker ps | grep -E "snapcast|audio"
```

**Expected containers:**
- `snapcast-client` - Running
- `audio-fallback` - May be stopped (starts on failover)
- `audio-control` - Running

**Verify volume at 0%:**
```bash
curl http://localhost:8081/metrics | grep audio_volume
# Should show: audio_volume 0.0
```

### Deploy to pi-audio-02

Repeat the above steps with:
```bash
DEVICE_ID=pi-audio-02
```

---

## Testing Checklist (Volume at 0%)

### 1. Verify Snapcast Connection
```bash
# On pi-audio-01
curl http://localhost:8081/metrics | grep snapcast_connected
# Expected: snapcast_connected 1

# On pi-audio-02
curl http://localhost:8081/metrics | grep snapcast_connected
# Expected: snapcast_connected 1
```

### 2. Check Audio Mode
```bash
# On both Pi devices
curl http://localhost:8081/metrics | grep audio_mode_state
# Expected: audio_mode_state{mode="snapcast"} 1
```

### 3. Verify Fallback File Exists
```bash
# On both Pi devices
docker exec audio-control ls -lh /data/fallback.mp3
# Expected: 166MB file
```

### 4. Test Failover (Snapcast → Fallback)
```bash
# On pi-audio-01
docker stop snapcast-client

# Wait 5 seconds, check mode
sleep 5
curl http://localhost:8081/metrics | grep audio_mode_state
# Expected: audio_mode_state{mode="fallback"} 1

# Restore
docker start snapcast-client

# Wait 10 seconds, check mode
sleep 10
curl http://localhost:8081/metrics | grep audio_mode_state
# Expected: audio_mode_state{mode="snapcast"} 1
```

### 5. Synchronization Test
```bash
# Stand equidistant from both speakers
# If you hear echo or delay, something is wrong
# Should hear unified single sound source
```

---

## Volume is 0% - Safe to Test

**IMPORTANT:** All devices are configured with `AUDIO_VOLUME=0.0` by default.

To gradually test audio (when ready):
```bash
# Via API (increase volume slowly)
curl -X POST http://app.headspamartina.hr/api/audio/devices/pi-audio-01/volume \
  -H "Content-Type: application/json" \
  -d '{"volumePercent":5}'

curl -X POST http://app.headspamartina.hr/api/audio/devices/pi-audio-02/volume \
  -H "Content-Type: application/json" \
  -d '{"volumePercent":5}'
```

---

## Files Modified

**VPS (`/home/admin/fleet/infra/vps/`):**
- ✅ `Dockerfile.snapserver` - Custom Snapcast server image
- ✅ `compose.fleet.yml` - Added Snapcast server service
- ✅ `liquidsoap/playlist.liq` - Added FIFO output
- ✅ `compose.liquidsoap.yml` - Updated volume mounts

**Pi Role (`/home/admin/fleet/roles/audio-player/`):**
- ✅ `40-app.yml` - Complete Snapcast configuration
- ✅ `docker/app/control_snapcast.py` - Snapcast-aware API
- ✅ `docker/app/fallback.liq` - Fallback playback script
- ✅ `.env.snapcast.example` - Environment template

**Other:**
- ✅ `/srv/Audio/fallback.mp3` - 166MB fallback file on VPS

---

## Current Status

🎉 **VPS Deployment: COMPLETE**
- Snapcast server streaming audio
- Liquidsoap outputting to Icecast + Snapcast
- Ready for Pi clients to connect

⏳ **Pi Deployment: PENDING**
- Configuration files ready
- Awaiting `.env` file creation and role-agent deployment
- Volume preset to 0% for safety

---

## Next Steps

1. Create `.env` files on both Pi devices
2. Restart role-agent to trigger deployment
3. Verify Snapcast connection
4. Test failover behavior
5. Test synchronization between devices
6. Gradually increase volume if testing audio

**Status:** Ready for Pi device deployment!
