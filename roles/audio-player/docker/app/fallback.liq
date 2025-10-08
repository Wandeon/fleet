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
