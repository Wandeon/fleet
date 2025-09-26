# Raspberry Pi HiFiBerry DAC+ Zero Output Configuration

Enable the HiFiBerry DAC overlay and disable onboard audio. On Raspberry Pi OS (Bookworm):

1. Edit `/boot/firmware/config.txt` and add:

```
dtoverlay=hifiberry-dac
dtparam=audio=off
```

2. Reboot the Pi.

3. Verify the ALSA device:

```
aplay -l
# Expected: card 0, device 0 -> hw:0,0
```

Defaults for this project use `plughw:0,0` as the ALSA output device to enable format conversion. Override via `roles/audio-player/.env` using `AUDIO_OUTPUT_DEVICE`.
