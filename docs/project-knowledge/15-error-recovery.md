# Error Recovery Patterns

This document outlines how Fleet handles retries, rollbacks, and manual recovery across the control plane and device agents.

## API retry & circuit breaker logic

- Upstream HTTP calls use AbortController with `TIMEOUT_MS` (default 3s) and exponential backoff controlled by `RETRY_MAX`/`RETRY_BACKOFF_MS`. Only idempotent GETs retry; POST/PUT failures bubble immediately.【F:apps/api/ARCHITECTURE.md†L5-L33】
- Consecutive failures per device trip the circuit breaker after `CIRCUIT_FAILURE_THRESHOLD` errors. While open, the API returns `503 circuit_open` without hitting the device. Gauge `circuit_breaker_state{deviceId}` indicates state (1=open).【F:apps/api/ARCHITECTURE.md†L27-L41】
- Worker jobs update status via `updateJob` with optimistic concurrency. Failed jobs increment `metrics.jobs_fail`, log warning, and keep circuit open until a successful run resets it. Use `/health/events/recent` to see `command.failed` entries.【F:apps/api/src/services/jobs.ts†L1-L82】【F:apps/api/src/workers/executor.ts†L1-L55】

## Device agent recovery

- `role-agent.sh` writes `health.json` and Prometheus textfile metrics after each converge. Non-zero exit codes capture failure type (inventory missing, compose failed, rollback errors). Investigate via `journalctl -u role-agent.service` and inspect plan history under `/var/run/fleet/projects/`.【F:agent/role-agent.sh†L1-L120】
- The agent supports `--dry-run`, `--force-rebuild`, and `--log-json` for troubleshooting. On failure, metrics `role_agent_last_run_success{host}`=0 help Prometheus alert. 
- If compose fails, fix configuration/env, rerun `sudo /opt/fleet/agent/role-agent.sh`, and monitor `docker ps` for expected containers.【F:docs/runbooks/audio.md†L120-L160】

## Deployment rollback

- `scripts/vps-deploy.sh` records each deployment attempt in `.deploy/current-attempt.env`, promoting to `last-successful.env` after acceptance passes. On failure, it auto-invokes rollback (if enabled) by applying the previous manifest and re-running acceptance checks.【F:scripts/vps-deploy.sh†L1-L200】
- Manual rollback is available via `.github/workflows/rollback.yml`, which replays `.deploy/previous-successful.env`. Ensure acceptance hosts/credentials are up to date before invoking.

## Acceptance & verification

- Audio smoke tests (`scripts/acceptance.sh`) run after deploys and during incident response. They SSH into devices, trigger playback, and validate Icecast reachability; failures should prompt investigation of network, tokens, or stream health.【F:README.md†L130-L154】
- Monitoring alerts (Alertmanager → Slack) surface repeated failure scenarios: circuit breaker opens, Promtail log drops, agent converge failures. Review Grafana dashboards and Loki context to identify root cause.【F:infra/vps/README.md†L75-L115】

## Manual recovery playbook

1. **Device offline** – Check Tailscale connectivity, ensure host is powered, SSH in to inspect `journalctl` and container status. Update `inventory/devices.yaml` if role changed, then rerun agent. 
2. **API unavailable** – Inspect `docker compose -f infra/vps/compose.fleet.yml ps` on VPS, review `fleet-api` logs, confirm `API_BEARER` env set. Redeploy via `scripts/vps-deploy.sh` with fresh images if necessary. 
3. **Log ingestion gap** – Verify Promtail containers on devices (`docker ps`), ensure `LOKI_ENDPOINT` reachable, check VPS Promtail logs. Restart `infra/vps/compose.promtail.yml` stack if pipeline stalled.【F:baseline/docker-compose.yml†L21-L49】【F:infra/vps/compose.promtail.yml†L1-L12】
4. **Zigbee failure** – Follow hdmi-media reset steps (regenerate password file, confirm serial path). Document manual actions in device detail page for traceability.【F:roles/hdmi-media/README.md†L78-L146】

Document postmortems in repo runbooks when new failure modes occur and update this knowledge base accordingly.
