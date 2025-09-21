# Unified Logging Runbook

The fleet now ships logs from every Raspberry Pi and the VPS into a single Loki instance. Use this guide to verify the pipeline and troubleshoot noisy nodes.

## Components

- **Promtail on devices** – added to the baseline compose file so every Pi tails Docker stdout/stderr and the systemd journal. The agent exports environment variables from `/etc/fleet/agent.env`, which must include `LOKI_ENDPOINT` (and optionally `LOG_SITE`).
- **Promtail on the VPS** – launched via `vps/compose.promtail.yml`; scrapes host-level containers and syslog so the control plane and monitoring stack are captured too.
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
3. Update `inventory/devices.yaml` so each managed node has `logs: true` and `loki_source: <hostname>`; the API and UI use these labels when building Loki queries.
4. On the VPS, start/restart the monitoring stack including Loki + promtail:
   ```bash
   docker compose -f vps/compose.prom-grafana-blackbox.yml -f vps/compose.promtail.yml up -d alertmanager loki promtail
   docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus grafana blackbox
   ```

5. Verify VPS ingestion in Grafana or `logcli`:
   ```bash
   docker run --rm -it grafana/logcli:2.9.1 \
     --addr=http://loki:3100 \
     query '{job="docker", host="vps"}'
   ```

## Device-side promtail quick start

Follow these steps on each Raspberry Pi (audio, video, camera, etc.) so container and journal logs stream into Loki:

1. Set the Loki endpoint and optional labels:
   ```bash
   sudo tee /etc/fleet/agent.env >/dev/null <<'EOF'
LOKI_ENDPOINT=http://<vps-host-or-tailscale-ip>:3100/loki/api/v1/push
LOG_SITE=primary
EOF
   ```
2. Pull the latest baseline and restart the role agent (or compose manually):
   ```bash
   cd /opt/fleet
   git pull
   sudo systemctl restart role-agent.service
   # or: docker compose -f baseline/docker-compose.yml up -d promtail
   ```
3. Confirm the promtail container is healthy:
   ```bash
   docker ps --filter name=promtail
   docker logs promtail | tail
   ```
4. Validate in Grafana → Explore with `{host="pi-audio-01"}` (replace host label per node).

## Verifying ingestion

- Grafana → Explore → Loki → run `{job="docker", host="vps"}` for the VPS and `{host="pi-audio-01"}` (or other Pi hostnames) to confirm device forwarding.
- Use `logcli` locally on the VPS for quick CLI checks (see example above).
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
