# Unified Logging Runbook

The fleet now ships logs from every Raspberry Pi and the VPS into a single Loki instance. Use this guide to verify the pipeline and troubleshoot noisy nodes.

## Components

- **Promtail on devices** – added to the baseline compose file so every Pi tails Docker stdout/stderr and the systemd journal. The agent exports environment variables from `/etc/fleet/agent.env`, which must include `LOKI_ENDPOINT` (and optionally `LOG_SITE`).
- **Promtail on the VPS** – part of `vps/compose.prom-grafana-blackbox.yml`; scrapes host-level containers and journals so the control plane and monitoring stack are captured too.
- **Loki** – runs in the same VPS stack with a 7-day retention window (`vps/loki-config.yml`). Data is stored under the `loki-data` Docker volume.
- **Grafana Explore** – pre-provisioned Loki data source (`vps/grafana/provisioning/datasources/loki.yml`) exposes logs through the Grafana UI.

## Provisioning checklist

1. Ensure `/etc/fleet/agent.env` exists on each node:
   ```bash
   cat /etc/fleet/agent.env
   # LOKI_ENDPOINT should resolve (Tailscale DNS or IP)
   ```
2. Restart or force a convergence so the updated baseline launches promtail:
   ```bash
   sudo systemctl start role-agent.service
   docker ps --filter name=promtail
   ```
3. On the VPS, start/restart the monitoring stack including Loki + promtail:
   ```bash
   docker compose -f vps/compose.prom-grafana-blackbox.yml up -d alertmanager loki promtail
   docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus grafana blackbox
   ```

## Verifying ingestion

- Grafana → Explore → Loki → run `{host="pi-audio-01"}` to confirm the device is forwarding logs.
- Use `logcli` locally on the VPS for quick CLI checks:
  ```bash
  docker run --rm -it grafana/logcli:2.9.1 \
    --addr=http://loki:3100 \
    query '{host="pi-audio-01"}'
  ```
- Prometheus scrapes `loki:3100` and `promtail:9080`; alert on `up{job="loki"} == 0` to detect outages.

## Common issues

| Symptom | Action |
| ------- | ------ |
| No logs from a Pi | Check `/etc/fleet/agent.env` for a valid `LOKI_ENDPOINT` and that the promtail container is running (`docker ps | grep promtail`). |
| Loki up but Grafana shows empty results | Verify promtail labels; search for `{environment="device"}` to broaden filters. |
| High cardinality | Add `match` stages in `logging/promtail-config.yaml` to drop noisy services or extra labels, then commit the change and let the agent converge. |

## Retention and storage

- Loki retention defaults to 7 days (`table_manager.retention_period`). Adjust in `vps/loki-config.yml` if you need longer history.
- The `loki-data` volume can grow quickly; monitor disk usage and prune with `docker volume rm` after stopping the stack if you need to reclaim space.

## Extending

- Add additional labels by editing `logging/promtail-config.yaml` (for example, include `role` or `job` labels sourced from host environment variables).
- To ingest logs from external services, deploy another promtail instance and point it at the same `LOKI_ENDPOINT`/tenant. Remember to tag with a unique `site`.
