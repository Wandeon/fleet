# Audio Acceptance Verification Runbook

Use this runbook immediately after converging the `audio-player` role to confirm that each Pi, the control API, and the Icecast mount are healthy. The procedure is automated by [`scripts/acceptance.sh`](../../scripts/acceptance.sh).

## Prerequisites

- SSH access to each Pi (`SSH_USER`, default `admin`).
- Control API token exported as `AUDIOCTL_TOKEN` (matches `AUDIO_CONTROL_TOKEN` in the role env).
- Icecast stream URL reachable from your workstation or the VPS.
- `curl`, `ssh`, and `jq` installed on the machine running the script.

## Basic usage

Run from the repo root:

```bash
SSH_USER=admin AUDIOCTL_TOKEN=$(pass fleet/audio/token) \
ICECAST_URL=http://vps.example.com:8000/pi-audio-01.opus \
  ./scripts/acceptance.sh pi-audio-01 pi-audio-02
```

The script emits color-coded status lines:

- `OK` ✅ — check passed.
- `WARN` ⚠ — informational issue (still investigate).
- `ERR` ❌ — hard failure that must be resolved before go-live.

## Options

`scripts/acceptance.sh` accepts command-line switches in addition to the environment variables.

| Option            | Description                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--icecast <url>` | Override the `ICECAST_URL` environment variable on the CLI. Useful when testing multiple mounts without re-exporting the env.                                            |
| `--play-both`     | Trigger playback toggles after the health checks. Requires `AUDIOCTL_TOKEN` and calls `/play` to switch to the stream and fallback file, then restores auto stream mode. |
| `-h, --help`      | Show usage information.                                                                                                                                                  |

Example with both options:

```bash
SSH_USER=admin AUDIOCTL_TOKEN=${AUDIO_TOKEN} \
  ./scripts/acceptance.sh --icecast http://vps.example.com:8000/pi-audio-01.opus \
  --play-both pi-audio-01 pi-audio-02
```

## Sample output

```
$ SSH_USER=admin AUDIOCTL_TOKEN=*** ICECAST_URL=http://vps:8000/pi.opus \
>   ./scripts/acceptance.sh --play-both pi-audio-01 pi-audio-02
== pi-audio-01 ==
OK control API healthy (:8081/healthz)
{"stream_url":"http://vps:8000/pi.opus","volume":1,"mode":"auto","source":"stream","fallback_exists":true}
OK ALSA device(s) present
OK play stream requested via /play
OK play fallback requested via /play
OK restored auto stream mode

== pi-audio-02 ==
ERR control API not responding
WARN cannot fetch /status
WARN no ALSA devices found (aplay -l)
WARN --play-both requested but AUDIOCTL_TOKEN not set; skipping playback toggles

ERR Icecast mount not reachable: http://vps:8000/pi.opus
Done.
```

Interpretation:

- `pi-audio-01` passed all checks (ready for production).
- `pi-audio-02` failed control API and ALSA checks and needs remediation before continuing.
- Icecast was unreachable from the execution host; verify the stream immediately.

## Troubleshooting flow

1. **Control API failure (`ERR control API not responding`)**

   - SSH to the Pi and inspect the container logs:
     ```bash
     ssh admin@pi-audio-02 'docker ps -q --filter name=audio-control | xargs -r docker logs --tail 100'
     ```
   - Check the health endpoint directly:
     ```bash
     curl -fsS http://pi-audio-02:8081/healthz
     ```
   - Confirm port 8081 is reachable on the private network (Tailscale preferred).

2. **Missing ALSA devices (`WARN no ALSA devices found`)**

   - Confirm the HiFiBerry overlay is applied (see [`audio.md`](./audio.md)).
   - Re-seat the HAT and reboot. Verify with `aplay -l`.
   - Ensure the `audio-player` container has `/dev/snd` mounted (`docker inspect`).

3. **Icecast unreachable**

   - From the VPS, `docker compose -f vps/compose.icecast.yml ps`.
   - Validate firewall rules expose port 8000 (and only 8000).
   - Open the Icecast status page in a browser: `http://<vps-host>:8000`.

4. **Playback toggles skipped**

   - `--play-both` requires `AUDIOCTL_TOKEN`. Export the token or remove the flag if not available.
   - Ensure a fallback file exists via `curl http://pi-audio-01:8081/status | jq '.fallback_exists'`.

5. **Persistent WARN/ERR**
   - Re-run the script after remediation to confirm the fleet is green.
   - If issues persist, escalate using the incident process in [`docs/runbooks/resilience.md`](./resilience.md).

## Acceptance checklist

| Step                       | Command                                                                      | Expected result                                        |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ | --------------- |
| Verify control API health  | `./scripts/acceptance.sh pi-audio-01 pi-audio-02`                            | Every host reports `OK control API healthy`.           |
| Validate ALSA devices      | `ssh admin@<pi> 'aplay -l'`                                                  | Output lists the HiFiBerry card.                       |
| Confirm fallback upload    | `curl -sS -H "Authorization: Bearer $AUDIOCTL_TOKEN" http://<pi>:8081/status | jq '.fallback_exists'`                                 | Returns `true`. |
| Exercise playback          | `./scripts/acceptance.sh --play-both <pis...>`                               | `OK play stream` and `OK play fallback` for each host. |
| Check Icecast reachability | `curl -fsI $ICECAST_URL`                                                     | Returns HTTP 200/302 headers.                          |

Once every row reads as expected, mark the deployment accepted and proceed with monitoring per [`audio.md`](./audio.md#6-monitoring-and-grafana).
