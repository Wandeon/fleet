# Alerting & Integrations

Fleet alerts operators through Prometheus Alertmanager and Slack webhooks. Future integrations include incident escalation and MCP bridges.

## Current stack

- Alertmanager configuration lives in `infra/vps/alertmanager.yml`. Slack webhook stored in `infra/vps/secrets/slack-webhook.url`; start the monitoring stack with both Prometheus and Promtail compose files to load the secret.【F:infra/vps/README.md†L75-L115】【F:infra/vps/compose.prom-grafana-blackbox.yml†L1-L55】
- Alerts group by `alertname` and `instance` to avoid over-grouping. Example invocation: `docker run prom/alertmanager amtool alert add TestNotification alertname="DeviceOffline" instance="demo" job="audio-player"` to validate Slack flow.【F:infra/vps/README.md†L99-L115】
- Logs/metrics queries happen through Grafana Explore; share correlation IDs in Slack notifications so operators can pivot quickly.【F:docs/runbooks/logging.md†L74-L110】

## Alert sources to maintain

| Source       | Condition                                                                                           | Notification                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Prometheus   | `upstream_device_failures_total` spikes, `circuit_breaker_state=1`, `role_agent_last_run_success=0` | Slack #operations channel with remediation steps.                                   |
| Alertmanager | Blackbox failure for `/api/healthz`, `/`                                                            | Immediate Slack ping; escalate if persists >5 minutes.                              |
| API events   | `command.failed`, `audio.upload` errors                                                             | Surface in UI event feed; optionally send Slack message for high-severity failures. |
| Zigbee       | Coordinator offline, permit join left enabled > planned window                                      | Slack alert + runbook link.                                                         |

## Planned integrations

- **Slack MCP** – Provide Fleet data via Claude/Slack MCP integration. Map `/api/health/summary`, `/api/fleet/state`, `/api/logs` queries to slash commands. Ensure tokens scoped appropriately.
- **Escalation policies** – Implement paging (PagerDuty/OnCall) for critical alerts (fleet offline, API down). Mirror alert definitions to secondary channel.
- **Incident timeline** – Auto-post `/health/events/recent` snapshots to incident thread when alert fires; include correlation IDs and direct log links.

## Operational checklist

1. Keep `infra/vps/secrets/slack-webhook.url` out of version control; rotate when team membership changes.
2. Review Alertmanager routes during quarterly audits; ensure severity levels match operator expectations.
3. After adding new metrics or modules, extend alert rules and Grafana dashboards accordingly.
4. Document escalations in runbooks and update [25-future-roadmap](./25-future-roadmap.md) with automation goals.

See [13-logs-and-monitoring](./13-logs-and-monitoring.md) for metric/LogQL details and [15-error-recovery](./15-error-recovery.md) for follow-up actions after an alert triggers.
