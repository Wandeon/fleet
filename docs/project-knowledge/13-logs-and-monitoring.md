# Logs & Monitoring

Fleet uses Prometheus, Grafana, Loki, and Blackbox to monitor device health and control-plane activity. This document summarises log schema, metrics, dashboards, and alerting configuration.

## Logging pipeline

- Devices run Promtail from `baseline/docker-compose.yml`, shipping journald and Docker logs to the VPS Loki endpoint defined in `/etc/fleet/agent.env`. Each log line includes `ts`, `level`, `msg`, `service`, `host`, `role`, `commit`, `correlationId`, `durationMs`, `errorCode`.【F:baseline/docker-compose.yml†L21-L49】【F:docs/runbooks/logging.md†L1-L42】
- Control plane containers (`fleet-api`, `fleet-worker`, `fleet-ui`) log structured JSON via Pino/SvelteKit. The API routes feed into `/api/logs` ring buffer for UI consumption, and Promtail on the VPS collects container logs via `/var/lib/docker/containers`.【F:apps/api/src/routes/logs.ts†L1-L107】【F:infra/vps/compose.promtail.yml†L1-L12】
- Use Grafana Explore with Loki datasource to query logs. Common queries: `{service="fleet-api", correlationId="..."}` for tracing requests; `{service="role-agent", level="error"}` for convergence failures.【F:docs/runbooks/logging.md†L74-L110】

## Metrics stack

- Prometheus, Grafana, Loki, Alertmanager, and Blackbox run via `infra/vps/compose.prom-grafana-blackbox.yml`. Grafana credentials come from `infra/vps/monitoring.env`, and dashboards ship from `infra/vps/grafana`.【F:infra/vps/compose.prom-grafana-blackbox.yml†L1-L55】【F:infra/vps/README.md†L5-L32】
- Device targets live in `infra/vps/targets-audio.json`, `targets-hdmi-media.json`, and `targets-camera.json` generated from `inventory/device-interfaces.yaml`. Restart Prometheus after updating these files.【F:infra/vps/README.md†L33-L74】
- Key metrics:
  - API: `http_requests_total`, `http_request_duration_ms`, `upstream_device_failures_total`, `circuit_breaker_state`, `jobs_success`, `jobs_fail`.【F:apps/api/ARCHITECTURE.md†L17-L49】【F:apps/api/src/workers/executor.ts†L1-L55】
  - Audio: `audio_stream_up`, `audio_fallback_active`, `audio_status_age_seconds` from device exporters.【F:roles/audio-player/README.md†L18-L40】
  - Camera: `camera_stream_online`, `camera_last_probe_timestamp_seconds` via control API metrics endpoint.【F:roles/camera/README.md†L25-L40】
  - Zigbee: Monitor Mosquitto/Zigbee2MQTT logs until dedicated metrics are added; plan exporters to surface coordinator health.

## Dashboards & alerts

- Import `infra/vps/grafana-dashboard-audio.json` for audio playback visibility (stream status, fallback activations, volume levels). Extend with panels for circuit breaker metrics and job queues.【F:infra/vps/README.md†L33-L74】
- Configure Alertmanager Slack notifications using webhook stored in `infra/vps/secrets/slack-webhook.url`. Alerts group by `alertname` + `instance` to avoid bundling unrelated devices. Test via `amtool alert add`.【F:infra/vps/README.md†L75-L115】
- Planned dashboards: HDMI signal quality, Zigbee coordinator uptime, camera motion timeline. Coordinate with [17-ux-gaps-and-priorities](./17-ux-gaps-and-priorities.md) to reflect operator needs.

## Operational playbook

1. **Triaging incidents** – Start with Grafana dashboard to identify failing module, then use Loki query with correlation ID to correlate API/device logs.
2. **Validating deployments** – After `deploy-vps.yml`, confirm `/api/healthz`, `/health/events/recent`, and new logs via `/api/logs`. Review `.deploy/last-acceptance.log` for audio smoke tests.【F:scripts/vps-deploy.sh†L1-L200】
3. **Device-specific checks** – Use `journalctl -u role-agent.service` on Pis, `docker logs` for containers, and `curl http://<device>:8081/metrics` to spot anomalies.
4. **Retention** – Loki keeps seven days of logs (default). Adjust `infra/vps/loki-config.yml` if retention policies change.

For alert routing details, see [23-alerting-and-integrations](./23-alerting-and-integrations.md); for recovery patterns, reference [15-error-recovery](./15-error-recovery.md).
