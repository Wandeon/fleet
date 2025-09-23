# Resilience Playbook

Fleet agents now install multiple safety nets to heal Pi nodes if they drift or hang.

## Systemd watchdog chain


- `role-agent.timer` runs every 10 minutes with up to 90s jitter to prevent overlapping converger jobs.
- `role-agent-watchdog.timer` (optional) runs every 60 minutes and checks for a recent `Converged` journal entry.
- If no success within 60 minutes (configurable via `WATCHDOG_THRESHOLD_MINUTES`), it restarts `role-agent.service` and reboots the host after 3 failed attempts.
- `role-agent-healthcheck.timer` (optional) inspects the active compose project; three consecutive unhealthy states trigger a compose recycle.
- View status with `systemctl list-timers "role-agent*"` and inspect logs via `journalctl -u role-agent-watchdog.service`.

### Tuning the convergence watchdog

- Check the current cadence with `systemctl list-timers --all | grep role-agent`.

- Override the convergence window if your converge cycle regularly exceeds 60 minutes:


```
sudo systemctl edit role-agent-watchdog.service

[Service]

Environment=WATCHDOG_THRESHOLD_MINUTES=90


- Reload and restart after editing: `sudo systemctl daemon-reload && sudo systemctl restart role-agent-watchdog.timer`.

## Hardware watchdog

- Run `sudo ./scripts/setup-watchdogs.sh` during provisioning to install the Linux `watchdog` service and register `/usr/local/bin/fleet-watchdog-health.sh`.
- The health script confirms Docker, the agent timers, and container health. Missing heartbeats cause the SoC watchdog to reboot the Pi automatically.
- Original `/etc/watchdog.conf` is saved as `/etc/watchdog.conf.fleet.bak`.
- Check status with `systemctl status watchdog` and last trip reason with `journalctl -u watchdog`.

## Manual recovery quick reference

- Force an agent run: `sudo systemctl start role-agent.service`.
- Disable watchdogs temporarily: `sudo systemctl stop watchdog role-agent-watchdog.timer role-agent-healthcheck.timer`.
- Re-enable after maintenance: `sudo systemctl start watchdog role-agent-watchdog.timer role-agent-healthcheck.timer` (the agent
  will leave them disabled on subsequent convergences until you re-enable them).

## Git lock recovery

- The agent now prunes stale `.git/*.lock` files before each fetch, but manual cleanup is still available when needed.
- To unblock a locked repo and re-run the converger:

```
sudo rm -f /opt/fleet/.git/{index,shallow,packed-refs}.lock
sudo systemctl start role-agent.service
```

- Locks younger than a minute are left in place automatically; if you see repeated failures, verify no `git` processes are running before removing the files manually.

## Monitoring agent freshness

- Each convergence run writes Prometheus textfile metrics: `role_agent_last_run_timestamp` and `role_agent_last_run_success` (labelled by `host`).
- By default the agent copies metrics into `/var/lib/node_exporter/textfile_collector/role-agent.prom` when that collector directory exists. Override the path with `ROLE_AGENT_TEXTFILE_DIR` if your node exporter uses a different location.
- Alerting examples are defined in `infra/vps/prometheus/alerts.yml` (`RoleAgentStale` after 15m without success, `RoleAgentFailure` when the last run failed for 5m).
