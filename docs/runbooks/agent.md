# Fleet Role Agent Runbook

This runbook describes how to operate, monitor, and troubleshoot the fleet role agent that keeps Raspberry Pis in sync with their Git-defined role.

## Overview

The role agent (`agent/role-agent.sh`) performs GitOps convergence:

1. Fetch the latest `main` branch into `/opt/fleet`.
2. Resolve the device role from `inventory/devices.yaml` using the device hostname.
3. Decrypt role-specific environment with SOPS/AGE when present.
4. Build the compose plan (baseline + role overlays) and run `docker compose up` for project `${ROLE}_${COMMIT}`.
5. Publish health artifacts under `/var/run/fleet`.
6. Keep the current plus the two most recent previous compose deployments per role (configurable via `ROLE_AGENT_HISTORY_KEEP`), pruning older stacks and images.

The agent supports deterministic deploys, safe rollback to the previous commit, and detailed health logging for observability.

## Installation

1. **Deploy the repo**

   ```bash
   sudo mkdir -p /opt
   sudo chown root:root /opt
   sudo git clone https://github.com/your-org/fleet.git /opt/fleet
   ```

2. **Install agent prerequisites**

   - Docker Engine with Compose plugin (`docker compose`).
   - `git`, `jq`, `python3`, `sops` (only needed when roles use encrypted envs).
   - Copy your AGE private key to `/etc/fleet/age.key` (permissions `0600`, owner `root`).

3. **Install helper scripts (optional but recommended)**
   ```bash
   sudo install -m 0755 /opt/fleet/agent/validate-inventory.sh /usr/local/bin/fleet-validate-inventory
   sudo install -m 0755 /opt/fleet/agent/check-secrets.sh /usr/local/bin/fleet-check-secrets
   sudo install -m 0755 /opt/fleet/agent/plan.sh /usr/local/bin/fleet-plan
   sudo install -m 0755 /opt/fleet/agent/watchdog-health.sh /usr/local/bin/fleet-watchdog-health
   ```

## Systemd setup

1. Copy the unit files:

   ```bash
   sudo install -D -m 0644 /opt/fleet/agent/systemd/fleet-role-agent.service /etc/systemd/system/fleet-role-agent.service
   sudo install -D -m 0644 /opt/fleet/agent/systemd/fleet-role-agent.timer /etc/systemd/system/fleet-role-agent.timer
   sudo install -D -m 0644 /opt/fleet/agent/systemd/fleet-role-agent-watchdog.service /etc/systemd/system/fleet-role-agent-watchdog.service
   sudo install -D -m 0644 /opt/fleet/agent/systemd/fleet-role-agent-watchdog.timer /etc/systemd/system/fleet-role-agent-watchdog.timer
   ```

2. Reload and enable:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now fleet-role-agent.timer
   sudo systemctl enable --now fleet-role-agent-watchdog.timer
   ```

3. Check timers:
   ```bash
   systemctl list-timers 'fleet-role-agent*'
   ```

The service runs as `Type=oneshot`. The timer executes every 5 minutes with a 60-second jitter.

## Environment variables

- `ROLE_AGENT_REPO_DIR` – override repository path (default `/opt/fleet`).
- `ROLE_AGENT_RUN_DIR` – override state directory (default `/var/run/fleet`).
- `ROLE_AGENT_HOSTNAME` – override hostname used for inventory lookup (useful for tests).
- `ROLE_AGENT_TEXTFILE_DIR` – location for Prometheus textfile metrics.
- `SOPS_AGE_KEY_FILE` – path to the AGE key (default `/etc/fleet/age.key`).
- `ROLE_AGENT_PRUNE_THRESHOLD_GB` – image prune threshold before automatic pruning (default `3`).
- `ROLE_AGENT_HISTORY_KEEP` – number of previous successful commits to retain for quick rollback (default `2`).

## Day-2 operations

### Dry-run planning

Preview the plan without touching containers:

```bash
sudo /opt/fleet/agent/role-agent.sh --dry-run --log-json
```

The agent still validates prerequisites, decrypts secrets, and writes `health.json` with `"dryRun": true`.

For a quick compose file listing without agent state, use:

```bash
fleet-plan --host <hostname>
```

### Reading health signals

The agent writes:

- `/var/run/fleet/health.json` – latest run summary:
  ```json
  {
    "hostname": "pi-audio-01",
    "role": "audio-player",
    "commit": "abc1234",
    "status": "ok|degraded|error",
    "startedAt": "2024-04-21T10:30:00Z",
    "finishedAt": "2024-04-21T10:30:08Z",
    "durationMs": 8200,
    "errors": ["…"],
    "dryRun": false,
    "rollbackAttempted": true,
    "rollbackSucceeded": false
  }
  ```
- `/var/run/fleet/commit.sha` – commit hash of the active deployment.
- `/var/run/fleet/role-agent.prom` – Prometheus textfile metrics (mirrored into the configured node exporter directory when writable).

The watchdog service (`fleet-role-agent-watchdog.timer`) polls the health file. Failures raise unit warnings and can be scraped via `journalctl -u fleet-role-agent-watchdog.service`.

### Rollback behaviour

The agent keeps the last two successful compose stacks per role. When an upgrade fails during `docker compose up`, it rebuilds the previous stack using the recorded compose plan from the last success.

To manually revert, locate the prior commit and run:

```bash
sudo docker compose -p ${ROLE}_$(cat /var/run/fleet/commit.sha) ls
```

(Or rerun the agent after removing the faulty change from Git.)

### Disk hygiene

- On each run, dangling images are pruned when image usage exceeds `ROLE_AGENT_PRUNE_THRESHOLD_GB` (default 3GB).
- A full `docker system prune -af` occurs at most weekly (tracked under `/var/run/fleet/last-full-prune`).
- Compose projects older than the current commit plus the configured history keep window are removed with `down --volumes`.

## Troubleshooting

| Exit code | Meaning                                                                                                                           | Action                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `10`      | Host missing from `inventory/devices.yaml`.                                                                                       | Add the hostname with a role definition, then rerun.                                     |
| `11`      | SOPS/AGE tooling missing or key unreadable.                                                                                       | Install `sops`, ensure `/etc/fleet/age.key` exists with `0600` permissions (owner root). |
| `12`      | Secret decryption failure.                                                                                                        | Validate AGE key contents, run `sops --decrypt roles/<role>/.env.sops.enc` manually.     |
| `20`      | `docker compose up` failed. Agent attempted rollback; inspect `health.json` errors and `journalctl -u fleet-role-agent.service`.  |
| `21`      | Rollback attempt failed. Immediate manual intervention required—consider reverting the commit and running with `--force-rebuild`. |
| `30`      | Prerequisite missing (repo path, commands, compose binary).                                                                       | Verify Docker/CLI availability and `/opt/fleet` checkout.                                |

### Common commands

- Tail logs:
  ```bash
  journalctl -u fleet-role-agent.service -n 200 -f
  ```
- Validate inventory changes locally:
  ```bash
  fleet-validate-inventory --host pi-audio-01
  ```
- Check secrets hygiene:
  ```bash
  ROLE_AGENT_ALLOWED_KEY_OWNER=root fleet-check-secrets
  ```
- Acceptance sweep (uses temporary state under `/tmp`):
  ```bash
  sudo /opt/fleet/agent/tests/acceptance.sh
  ```

## Updating the agent

1. Modify scripts in `agent/` as required.
2. Commit and push to `main`.
3. Devices fetch the new commit on the next timer run (or trigger manually with `systemctl start fleet-role-agent.service`).
4. Monitor `/var/run/fleet/health.json` or `journalctl` for status.

Keep the top-level README in sync with any contract changes (compose plan, health files, or systemd units).
