#!/usr/bin/liquidsoap

# Fleet Audio Streaming Configuration
# Streams audio files to Icecast server for Pi device playback

# Set log level
settings.log.level.set(4)
settings.log.stdout.set(true)

# Create a playlist source from /music directory
# Plays files in random order and loops infinitely
music = playlist(
  mode="randomize",
  reload_mode="watch",
  "/music"
)

# Create a fallback sine wave (1kHz beep) in case no music files exist
emergency = sine(1000.)

# Use music if available, otherwise use emergency beep
source = fallback(track_sensitive=false, [music, emergency])

# Normalize audio to prevent volume spikes
source = normalize(source)

# Stream to Icecast server
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

# Log that we're running
log("Liquidsoap streaming to icecast://icecast:8000/fleet.mp3")
