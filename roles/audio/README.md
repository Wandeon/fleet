Audio Role

This role runs an FFmpeg-based audio capture container that streams from the host's ALSA device to an Icecast server on your VPS.

Configuration is provided via environment variables. For secrets, use SOPS to create `roles/audio/.env.sops.enc` (the convergence agent will decrypt and export it on the device before running Docker Compose).

Key variables:

- AUDIO_ALSA_DEVICE: ALSA input, e.g. `hw:1,0` (USB sound card)
- AUDIO_RATE: Sample rate, e.g. `48000`
- AUDIO_CHANNELS: Channels, `1` or `2`
- AUDIO_BITRATE: Opus bitrate, e.g. `128k`
- ICECAST_HOST: VPS hostname or Tailscale IP
- ICECAST_PORT: Icecast port, default `8000`
- ICECAST_USER: Icecast source user, default `source`
- ICECAST_PASSWORD: Source user password
- ICECAST_MOUNT: Mount name, default `${HOSTNAME}.opus`
- ICECAST_NAME: Stream name, default `${HOSTNAME}`

Testing on the Pi:

1) Verify ALSA device presence: `arecord -l`
2) Optionally test capture locally: `arecord -D hw:1,0 -f cd -d 3 test.wav`
3) Ensure the agent is running and role is set to `audio` in `inventory/devices.yaml`.

Hardware note (HiFiBerry DAC+ Zero):

- DAC+ Zero is a playback-only HAT (no ADC). It cannot capture audio for streaming with this role.
- To stream audio, use a USB sound card with input or an ADC HAT (e.g., HiFiBerry ADC, AudioInjector).
- If you want a listening-only Pi with DAC+ Zero, use a separate playback role that pulls from Icecast and outputs to ALSA (e.g., `hw:0,0`). Let me know and I can add this `audio-player` role.
