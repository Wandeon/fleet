# Observability Runbook

This runbook explains how to monitor Fleet end-to-end: where to view dashboards, how to run PromQL queries, and the conventions behind the structured logs and metrics emitted by the API, role agents, and devices.

## Logging recap

All services emit JSON logs with a consistent schema (`ts`, `level`, `msg`, `service`, `host`, `role`, `commit`, `correlationId`, `durationMs`, `errorCode`). See [logging.md](./logging.md) for the full field reference and retrieval commands. Use the `correlationId` to jump between API requests, worker jobs, and device actions when diagnosing failures.

Example API entry:
```json
{
  "ts": "2025-04-03T21:18:09.984Z",
  "level": "warn",
  "msg": "HTTP request failed",
  "service": "fleet-api",
  "host": "vps-prod",
  "role": "control-plane",
  "commit": "7d3c4e1",
  "correlationId": "c5bf0b43-3f96-4bb9-9a02-210de48e6a2c",
  "durationMs": 421.55,
  "errorCode": "502",
  "route": "/api/devices/pi-audio-01/jobs",
  "status": 502
}
```

## Grafana dashboards

Grafana is provisioned automatically by `infra/vps/compose.prom-grafana-blackbox.yml`. Dashboards live in `grafana/dashboards/` and are mounted into the container so changes are version controlled.

* **Fleet Overview** (`uid: fleet-overview`) – API request volume, latency (p95), 4xx/5xx error rates, fleet device counts, and Icecast probe success.
* **Audio Player** (`uid: audio-player`) – Stream health, fallback activation, volume trends, and upstream device failure table.
* **Agent Convergence** (`uid: agent-convergence`) – Role-agent convergence duration, last run timestamp with deployed commit, and Loki-backed error code counts per host.

### Accessing Grafana

1. `cd /opt/fleet`
2. `docker compose -f infra/vps/compose.prom-grafana-blackbox.yml up -d grafana`
3. Visit `https://<vps-host>:3000` and authenticate with credentials from `infra/vps/monitoring.env`.
4. Dashboards auto-load under the **Fleet** folder. Use **Explore** for ad hoc Prometheus or Loki queries.

## Prometheus queries

* Recent API error rate: `sum(rate(http_requests_total{status=~"5.."}[5m]))`
* p95 latency per route: `histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[5m])) by (le, route))`
* Devices currently marked online: `sum(fleet_device_online)`
* Role agent last convergence age (seconds): `time() - role_agent_last_run_timestamp`
* Circuit breaker open devices: `circuit_breaker_state`
* Audio fallback activations in the last 6h: `sum(increase(upstream_device_failures_total[6h])) by (deviceId, reason)`

Use Prometheus directly (`http://<vps-host>:9090`) or run queries through Grafana panels for richer visualization.

## Metric definitions

* `http_requests_total{method,route,status}` – API request counter. Combine with `rate()` for throughput and filter by `status` for errors.
* `http_request_duration_ms{method,route}` – Histogram for API latency. Use `histogram_quantile` for percentiles.
* `upstream_device_failures_total{deviceId,reason}` – Counter incremented when the API or workers fail to reach a device.
* `circuit_breaker_state{deviceId}` – Gauge reporting whether communication with a device is suspended (`1` means open/broken).
* `fleet_device_online{device_id}` – Gauge that the API updates based on heartbeat/fleet metadata.
* `role_agent_last_run_duration_seconds{host,commit}` – Duration of the most recent role-agent convergence run.
* `role_agent_last_run_timestamp{host,commit}` – Epoch timestamp for the last convergence. Combine with `time()` to spot stale hosts.
* `role_agent_last_run_success{host,commit}` – `1` for the most recent run succeeding, `0` otherwise.
* Device metrics from `audio-control`:
  * `stream_up` – `1` when the primary stream is active.
  * `fallback_active` – `1` when the player switched to the fallback source.
  * `volume_level` – Current output volume (0-100).
  * `last_switch_timestamp` – Unix timestamp of the last stream/fallback change.

## Adding a new device to monitoring

1. **Register the device in inventory** – Add the host to `inventory/devices.yaml` with the correct `role`, `site`, and network details. Ensure the role agent is enabled and converges successfully.
2. **Expose metrics/health** – The audio-control container must publish `/metrics` and `/healthz` on port `8081`. Verify locally: `curl http://<device>:8081/metrics`.
3. **Add the device to Prometheus targets** – Update the appropriate file under `infra/vps/targets-*.json` (for audio players use `targets-audio.json`). Example:
   ```json
   [
     { "targets": ["pi-audio-03:8081"], "labels": { "role": "audio-player", "instance": "pi-audio-03" } }
   ]
   ```
   Keep the array sorted and commit the change.
4. **Run config validation** – Execute `node scripts/validate-device-registry.mjs` to ensure target files and inventory entries stay in sync.
5. **Reload Prometheus** – `docker compose -f infra/vps/compose.prom-grafana-blackbox.yml exec prometheus kill -HUP 1`
6. **Check dashboards** – Confirm the new device appears in the Audio Player dashboard and `fleet_device_online` exposes a sample for the host.

## Troubleshooting workflow

1. **Start with logs** – Filter by `correlationId` in Grafana Explore or journald to find the failing request/job.
2. **Pivot to Prometheus** – Inspect `http_requests_total`/`http_request_duration_ms` for API issues or `role_agent_last_run_success` for convergence problems.
3. **Confirm device health** – Check the Audio Player dashboard for `stream_up`/`fallback_active` spikes and query `/healthz` directly if required.
4. **Use the acceptance script** – `scripts/acceptance.sh` exercises connectivity to Icecast and verifies agent convergence across the fleet after remediation.
