# Resilience Playbook

Fleet agents now install multiple safety nets to heal Pi nodes if they drift or hang.

## Systemd watchdog chain

- `role-agent-watchdog.timer` runs every 5 minutes and checks for a recent `Converged` journal entry.
- If no success within 15 minutes, it restarts `role-agent.service` and reboots the host after 3 failed attempts.
- `role-agent-healthcheck.timer` inspects the active compose project; three consecutive unhealthy states trigger a compose recycle.
- View status with `systemctl list-timers "role-agent*"` and inspect logs via `journalctl -u role-agent-watchdog.service`.

## Hardware watchdog

- Run `sudo ./scripts/setup-watchdogs.sh` during provisioning to install the Linux `watchdog` service and register `/usr/local/bin/fleet-watchdog-health.sh`.
- The health script confirms Docker, the agent timers, and container health. Missing heartbeats cause the SoC watchdog to reboot the Pi automatically.
- Original `/etc/watchdog.conf` is saved as `/etc/watchdog.conf.fleet.bak`.
- Check status with `systemctl status watchdog` and last trip reason with `journalctl -u watchdog`.

## Manual recovery quick reference

- Force an agent run: `sudo systemctl start role-agent.service`.
- Disable watchdogs temporarily: `sudo systemctl stop watchdog role-agent-watchdog.timer role-agent-healthcheck.timer`.
- Re-enable after maintenance: `sudo systemctl start watchdog role-agent-watchdog.timer role-agent-healthcheck.timer`.
