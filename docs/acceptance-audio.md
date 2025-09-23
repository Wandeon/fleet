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
