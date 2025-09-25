# Audio Playback Acceptance Workflow

This playbook verifies that each audio-player Pi can stream from Icecast, report
healthy metrics, and expose ALSA devices. Run from the repository root on a host
that can reach the Pis (typically the VPS) after preparing the roles described in
[`docs/runbooks/audio.md`](runbooks/audio.md).

## Requirements

- Icecast mount reachable from the runner (the VPS URL if testing remotely).
- `AUDIOCTL_TOKEN` (Bearer token for the control API when enabled).
- SSH access to each Pi (`SSH_USER`, default `admin`) to confirm ALSA devices.

## One-command acceptance test

```bash
SSH_USER=admin \
AUDIOCTL_TOKEN=<token> \
./scripts/acceptance.sh --icecast http://<vps>:8000/<mount> --play-both \
  pi-audio-01 pi-audio-02
```

What the script does for each host:

1. `GET /healthz` (no auth) to confirm the service is online.
2. `GET /status` with the Bearer token (pretty-printed when `jq` is available).
3. SSH into the host and run `aplay -l` to confirm ALSA devices are present.
4. When `--play-both` is set, `POST /play` with `{ "source": "stream" }` and recheck `/status` so `now_playing` reports `stream`.
5. Optionally `HEAD` the Icecast URL supplied via `--icecast` (or `ICECAST_URL`) to ensure the VPS can reach the mount.

## Output & exit codes

- Each check is colour-coded (`OK`, `WARN`, `ERR`).
- The summary table lists control API reachability, current playback source, fallback presence, and reported software volume.
- Exit codes: `0` (all checks succeeded), `1` (warnings present), `2` (errors).

Example summary:

```
Summary:
Host                  Online   Source         Fallback   Volume
pi-audio-01           yes      stream         yes        0.80
pi-audio-02           yes      stream         yes        0.80
OK All checks passed
```

## Follow-up checks

Perform these when deeper inspection is required:

```bash
# Inspect Prometheus metrics
AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh metrics

# Confirm fallback file exists
AUDIOCTL_HOST=pi-audio-01 AUDIOCTL_TOKEN=<token> ./scripts/audioctl.sh status --json | jq '.fallback_exists'

# Tail recent control/player logs
ssh admin@pi-audio-01 'tail -n 50 /data/player.log /data/control.log'
```

Use the script output plus supporting logs/metrics as the acceptance artefact
showing music plays successfully on every configured Raspberry Pi.
