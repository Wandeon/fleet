# Fleet Audio Streaming with Liquidsoap

This directory contains the Liquidsoap configuration for streaming audio to Fleet Pi devices via Icecast.

## Architecture

```
[Liquidsoap] → reads /music directory
      ↓
[Encodes to MP3 @ 128kbps]
      ↓
[Streams to Icecast mount: fleet.mp3]
      ↓
[Pi devices fetch: http://icecast:8000/fleet.mp3]
      ↓
[Speakers output audio]
```

## Setup

1. **Add audio files to the music volume:**
   ```bash
   # Create a sample audio file
   docker run --rm -v liquidsoap-music:/music alpine sh -c \
     "apk add --no-cache ffmpeg && \
      ffmpeg -f lavfi -i 'sine=frequency=440:duration=10' -b:a 128k /music/test-tone.mp3"

   # Or copy your own files
   docker cp /path/to/song.mp3 liquidsoap:/music/
   ```

2. **Start the services:**
   ```bash
   cd /home/admin/fleet/infra/vps
   docker-compose -f compose.liquidsoap.yml up -d
   ```

3. **Verify streaming:**
   ```bash
   # Check Liquidsoap logs
   docker logs liquidsoap -f

   # Check Icecast mount points (should show fleet.mp3)
   curl http://localhost:8000/status-json.xsl

   # Test playback
   mpv http://localhost:8000/fleet.mp3
   ```

4. **Update Pi device stream URLs:**
   The Pi devices should be configured with:
   ```
   stream_url: http://icecast:8000/fleet.mp3
   ```

## Features

- **Playlist mode**: Plays all files in `/music` directory in random order
- **Auto-reload**: Watches `/music` directory for new files
- **Crossfade**: 5-second smooth transitions between tracks
- **Normalization**: Prevents volume spikes
- **Fallback**: Plays 1kHz sine wave if no music files exist
- **Loop**: Continuously plays playlist indefinitely

## Managing Audio Files

```bash
# List current files
docker exec liquidsoap ls -lh /music

# Add new file
docker cp newfile.mp3 liquidsoap:/music/

# Remove file
docker exec liquidsoap rm /music/oldfile.mp3

# Liquidsoap will automatically detect changes and reload the playlist
```

## Troubleshooting

**No audio playing:**
- Check Liquidsoap logs: `docker logs liquidsoap`
- Verify Icecast is running: `docker ps | grep icecast`
- Check mount point exists: `curl http://localhost:8000/status-json.xsl`

**Stream cutting out:**
- Check network connectivity between VPS and Pi devices
- Verify Icecast max clients setting
- Check VPS bandwidth usage

**Adding files not working:**
- Ensure files are valid MP3/audio format
- Check file permissions in volume
- Restart Liquidsoap if auto-reload fails: `docker restart liquidsoap`
