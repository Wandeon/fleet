#!/usr/bin/liquidsoap

# Fleet Audio Streaming Configuration
# Streams audio files to Icecast server for Pi device playback

# Set log level
settings.log.level := 4
settings.log.stdout := true

# Enable telnet server for remote control
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1234

# Create a playlist source from /srv/Audio directory
music = playlist(
  mode="randomize",
  reload_mode="watch",
  "/srv/Audio"
)

# Create a fallback sine wave (1kHz beep) in case no music files exist
emergency = sine(1000.)

# Use music if available, otherwise use emergency beep
audio_source = fallback(track_sensitive=false, [music, emergency])

# Normalize audio to prevent volume spikes
normalized = normalize(audio_source)

# Create interactive variable for playback control
# Control via telnet: var.set playing = true/false
playing = interactive.bool("playing", true)

# Control source based on playing state
source = switch(track_sensitive=false, [
  ({playing()}, normalized),
  ({true}, blank())
])

# Output to Icecast server (for web playback and monitoring)
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

# Output to Snapcast FIFO (for synchronized Pi playback)
# Snapcast expects the FIFO directly, not a file inside a directory
output.file(
  %wav(stereo=true, samplerate=48000),
  "/tmp/snapfifo",
  source
)

# Register telnet control commands
def start_playback(_) =
  playing.set(true)
  "Playback started"
end

def stop_playback(_) =
  playing.set(false)
  "Playback stopped"
end

def skip_track(_) =
  music.skip()
  "Skipped to next track"
end

server.register(
  namespace="player",
  description="Start playback",
  usage="player.start",
  "start",
  start_playback
)

server.register(
  namespace="player",
  description="Stop playback",
  usage="player.stop",
  "stop",
  stop_playback
)

server.register(
  namespace="player",
  description="Skip to next track",
  usage="player.skip",
  "skip",
  skip_track
)

# Log that we're running
log("Liquidsoap streaming to:")
log("  - Icecast: http://icecast:8000/fleet.mp3 (web playback)")
log("  - Snapcast: /tmp/snapfifo/fleet (synchronized Pi playback)")
log("Telnet control server listening on port 1234")
