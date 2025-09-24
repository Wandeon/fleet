# Monitoring & Alerts Runbook

This runbook explains how to reach the monitoring stack and respond quickly when the on-call channel receives an alert. Use it alongside the detailed [Monitoring runbook](../runbooks/monitoring.md) for architecture-level guidance.

## Accessing Grafana and Prometheus

The monitoring components live in the `infra/vps/compose.prom-grafana-blackbox.yml` docker-compose stack. Prometheus listens on port `9090` and Grafana on port `3000`.

1. **Connect to the monitoring host.** SSH or VPN into the VPS or server where the compose stack is deployed.
2. **List running services.** `docker compose -f infra/vps/compose.prom-grafana-blackbox.yml ps` should show the `prometheus` and `grafana` containers in the `Up` state.
3. **Open the dashboards.**
   - Prometheus UI: `http://<host>:9090/` → explore metrics or view the `/alerts` page.
   - Grafana UI: `http://<host>:3000/` → dashboards are auto-provisioned from `grafana/dashboards/`.
4. **Credentials.** Grafana defaults to the admin credentials configured in the deployment secrets. Reset by running `docker compose ... exec grafana grafana-cli admin reset-admin-password <new-password>` if needed.
5. **Port-forward (optional).** If the host blocks direct access, run `ssh -L 9090:localhost:9090 -L 3000:localhost:3000 <user>@<host>` and then browse to `http://localhost:9090` and `http://localhost:3000` locally.

## Alert guide and first response

Prometheus evaluates the alert rules defined in `infra/vps/prometheus/alerts.yml` every 15 seconds. The table below outlines what each alert means and the recommended first response.

| Alert | What it indicates | First steps |
| --- | --- | --- |
| **ApiDown** | The API target stopped responding (`up{job="api"} == 0` for >1 minute). | 1. Hit `/healthz` on the API through the load balancer. 2. `docker compose logs api --tail 100` on the host. 3. If the container is unresponsive, `docker compose restart api` and re-check the health endpoint. |
| **HealthDegraded** | UI health probes report a degraded state for >5 minutes (`app_overall_health == 1`). | 1. Open Grafana → UI dashboard to see failing panels. 2. Validate the UI manually; capture console errors. 3. Check the UI container logs (`docker compose logs ui`). |
| **HealthDown** | UI health probes report a full outage (`app_overall_health == 2`). | 1. Verify `/healthz` from the blackbox probe. 2. Inspect UI container logs for crashes. 3. Restart the UI container and confirm health returns to `0` (healthy). |
| **High5xx** | Average HTTP 5xx rate >0.5 requests/second for 10 minutes. | 1. Check API/UI access logs for common errors. 2. Verify upstream dependencies (database, third-party APIs). 3. Roll back recent deploys if spike started after a release. |
| **CertExpirySoon** | TLS certificate used by the blackbox probe expires within 14 days. | 1. Confirm which hostname is affected in the alert labels. 2. Renew via ACME/Let’s Encrypt automation or manual cert issuance. 3. Reload the reverse proxy (`nginx -s reload` or restart container). |
| **DeviceOffline** | Audio device `/metrics` endpoint unreachable for >5 minutes (`up{job="audio-player"} == 0`). | 1. Check device power/network status (ping the IP). 2. Review device logs via SSH or remote console. 3. Power-cycle or restart the device-side container/service if it stays offline. |
| **PrometheusTargetDown** | Any monitored target reports `up == 0` for >3 minutes. | 1. Identify the `job`/`instance` labels in the alert to locate the failing target. 2. Confirm reachability (ping/SSH). 3. Restart the service or fix network routing, then ensure `up` returns to 1. |
| **DiskSpaceLow** | Available disk space on a node <10% for 10 minutes. | 1. `df -h` on the host to confirm the filesystem. 2. Clear logs or rotate them (`journalctl --vacuum-time=7d`). 3. Expand the disk or attach more storage if usage is legitimate. |
| **CpuHot** | Device CPU temperature >80°C for 5 minutes. | 1. Inspect device ventilation and ambient temperature. 2. Reduce workload or throttle processes if possible. 3. Schedule maintenance if the alert persists to avoid hardware damage. |
| **BlackboxHttpFail** | Blackbox HTTP probe failed (timeout, non-2xx/3xx/4xx response) for >2 minutes. | 1. Visit the probed URL manually to reproduce the failure. 2. Check upstream service health and DNS. 3. Restart the service or adjust probe endpoints if they changed. |
| **RoleAgentStale** | Role agent has not run in >15 minutes (`time() - role_agent_last_run_timestamp`). | 1. SSH to the host indicated by `$labels.host`. 2. Inspect systemd timers or cron for the role agent. 3. Run the agent manually and confirm timestamp metrics update. |
| **RoleAgentFailure** | Last role agent convergence failed (`role_agent_last_run_success == 0`). | 1. Review the agent logs for the failing run. 2. Resolve configuration or dependency errors. 3. Re-run the agent and watch Grafana for a success metric. |

## General incident checklist

1. **Acknowledge the alert** in Slack or PagerDuty so others know it is being handled.
2. **Capture diagnostics** (Grafana snapshot, `kubectl`/`docker compose` status, system metrics) before restarting services.
3. **Communicate updates** every 15 minutes in the incident channel, including mitigations attempted and remaining impact.
4. **Document the resolution** in the incident tracker and update any runbooks if new failure modes were uncovered.

## Escalation

Escalate to the platform team lead if:

- Two or more production services remain degraded after 30 minutes of work.
- An alert clears but immediately re-fires more than twice.
- You need access to secrets or infrastructure changes outside your permissions.

Provide a quick summary (what failed, actions taken, current status) when escalating to keep context tight.
