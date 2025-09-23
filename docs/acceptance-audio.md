<<<<<<< HEAD
# Audio Playback Acceptance Workflow

This playbook verifies that every audio player can stream from Icecast, report
healthy metrics, and expose ALSA devices. Run it after preparing the VPS and Pi
roles described in [`docs/runbooks/audio.md`](runbooks/audio.md).

## Requirements

- Icecast mount reachable from the runner (the VPS URL if testing remotely).
- `AUDIOCTL_TOKEN` (if the control API requires a Bearer token).
- SSH access to each Pi (`SSH_USER`, default `admin`) to confirm ALSA devices.

## Command Summary

```bash
# Basic health + status checks
SSH_USER=admin AUDIOCTL_TOKEN=<token> \
  ./scripts/acceptance.sh pi-audio-01 pi-audio-02

# Include Icecast reachability and force both players to stream
SSH_USER=admin AUDIOCTL_TOKEN=<token> \
  ./scripts/acceptance.sh --icecast http://vps:8000/mount --play-both \
  pi-audio-01 pi-audio-02
```

The script performs, per host:

1. `GET /healthz` with curl (no auth required).
2. `GET /status` with Bearer token when supplied, printing the JSON.
3. SSH into the host and run `aplay -l` to confirm ALSA devices.
4. Optional `POST /play` (when `--play-both` is set) followed by a `/status`
   check to verify the stream is active.

After iterating through every host the script optionally issues a `HEAD` request
against the Icecast URL supplied via `--icecast` or `ICECAST_URL`.

## Output & Exit Codes

- Each check is color-coded (`OK`, `WARN`, `ERR`).
- The summary table at the end lists whether the control API responded, the
  current source, whether a fallback file exists, and the reported software
  volume.
- Exit codes: `0` (all checks succeeded), `1` (warnings present), `2` (errors).

Example summary:

```
Summary:
Host                  Online   Source         Fallback   Volume
pi-audio-01           yes      stream         yes        0.80
pi-audio-02           yes      stream         yes        0.80
OK All checks passed
```

Use the script output (and optional screenshots of Grafana or `/metrics`) as the
acceptance artifact that music plays on every configured Raspberry Pi.
=======
# Audio Acceptance Workflow

This checklist proves that both audio-player Pis can pull from Icecast, play the
stream, and expose healthy control/metrics endpoints. Run the commands from the
repository root on the VPS (or any host that can reach the Pis over Tailscale).

## Prerequisites

- `ssh` access to each Pi as `$SSH_USER` (defaults to `admin`).
- Control API token exported as `AUDIOCTL_TOKEN` (matching `AUDIO_CONTROL_TOKEN`).
- Icecast stack online and reachable from the VPS (see `docs/runbooks/audio.md`).

## One-command acceptance test

```bash
SSH_USER=admin \
AUDIOCTL_TOKEN=<token> \
./scripts/acceptance.sh --icecast http://<vps>:8000/<mount> --play-both \
  pi-audio-01 pi-audio-02
```

What it does:

1. Calls `/healthz` on each host, flagging errors immediately.
2. Fetches `/status` (pretty-printed when `jq` is available) and verifies ALSA via SSH.
3. When `--play-both` is set, posts `{ "source": "stream" }` to `/play` and rechecks
   `/status` so `now_playing` shows `stream`.
4. Prints a colorized summary table: API state, current playback (`now_playing`),
   fallback presence, and volume per host.
5. Optionally performs a HEAD request against the Icecast mount to confirm the VPS can
   reach it.

Exit codes: `0` all clear, `1` warnings (e.g., missing fallback), `2` errors
(unreachable host, HTTP 4xx/5xx, Icecast offline).

## Follow-up checks

- Pull the first lines of Prometheus metrics:
  ```bash
  AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh metrics
  ```
- Confirm the fallback file exists:
  ```bash
  AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh status --json | jq '.fallback_exists'
  ```
- Inspect logs when troubleshooting:
  ```bash
  ssh admin@pi-audio-01 'tail -n 50 /data/player.log /data/control.log'
  ```

Keep `/data/player.log` and `/data/control.log` handy when debugging stream
failovers or authentication issues.
>>>>>>> 6e72588 (Refactor audio role packaging into reusable app)
