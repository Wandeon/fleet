# Logging Runbook

Fleet now emits **structured JSON logs** from every service so that operators and developers can pivot on correlation IDs, hosts, and error codes without fighting free-form text. This runbook explains the log schema, how the API and agents populate the fields, and the quickest ways to retrieve events from journald, Docker, or Grafana/Loki.

> All JSON lines share the same top-level fields: `ts`, `level`, `msg`, `service`, `host`, `role`, `commit`, `correlationId`, `durationMs`, and `errorCode`. Additional key/value pairs may appear depending on the message.

## Field reference

| Field | Description |
| ----- | ----------- |
| `ts` | RFC3339 timestamp emitted in UTC. |
| `level` | `debug`, `info`, `warn`, or `error`. |
| `msg` | Human readable message for dashboards / alerts. |
| `service` | Logical service name (`fleet-api`, `fleet-worker`, `role-agent`, `audio-control`, etc.). |
| `host` | Hostname of the node that produced the log (Pi or VPS). |
| `role` | Device role (`audio-player`, `camera`, `control-plane`, …). |
| `commit` | Git SHA the process is running (injected via `FLEET_LOG_COMMIT`). |
| `correlationId` | Request/operation correlation identifier propagated across HTTP and worker jobs. |
| `durationMs` | Request/operation duration when available. |
| `errorCode` | Machine readable failure code (HTTP status, upstream reason, etc.). |

### Generating correlation IDs

* Incoming HTTP requests use `X-Correlation-Id` if provided; otherwise the API generates one and echoes it back.
* Worker jobs and downstream device calls reuse the request-scoped ID via AsyncLocalStorage. When the API invokes an audio player, the correlation ID is forwarded as the `X-Correlation-Id` header so device logs can be joined with backend traces.
* Shell helpers (`agent/logging.sh`) accept `FLEET_LOG_CORRELATION_ID` to participate in the same flow when invoked from automation.

### Service specific behaviour

* **API (`apps/api`)** – Uses Pino HTTP middleware. Structured logs live in the `fleet-api` container (`docker logs fleet-api`) and are shipped to journald + Loki via promtail. Middleware automatically records `route`, `method`, `status`, and timing fields.
* **Worker (`fleet-worker`)** – Shares the same logger as the API but sets `service=fleet-worker`. Long running jobs add custom fields such as `deviceId`, `jobId`, or `errorCode` describing upstream failures.
* **role-agent** – All Bash utilities load `agent/logging.sh`. Logs are written to stdout (captured by systemd) and include the host, role, and commit labels for every convergence run. Use `journalctl -u role-agent.service -o json-pretty` for pretty output.
* **audio-control** – Flask application logs requests and stream state changes via the same JSON helper. Every audio event includes `stream`, `deviceId`, and fallback indicators so dashboards can pivot on playback behaviour.

### Samples

#### API request
```json
{
  "ts": "2025-04-03T21:18:09.984Z",
  "level": "info",
  "msg": "HTTP request completed",
  "service": "fleet-api",
  "host": "vps-prod",
  "role": "control-plane",
  "commit": "7d3c4e1",
  "correlationId": "5c2d0c94-ecfe-4a5a-8f6d-5c6a7f5b21ea",
  "durationMs": 142.31,
  "errorCode": null,
  "method": "POST",
  "route": "/api/devices/pi-audio-01/jobs",
  "status": 200
}
```

#### role-agent convergence
```json
{
  "ts": "2025-04-03T21:19:12.102Z",
  "level": "error",
  "msg": "git update failed after retries",
  "service": "role-agent",
  "host": "pi-audio-02",
  "role": "audio-player",
  "commit": "7d3c4e1",
  "correlationId": null,
  "durationMs": null,
  "errorCode": "GIT_FETCH",
  "attempts": 3
}
```

#### Audio-control playback switch
```json
{
  "ts": "2025-04-03T21:20:52.771Z",
  "level": "warn",
  "msg": "Stream fallback engaged",
  "service": "audio-control",
  "host": "pi-audio-01",
  "role": "audio-player",
  "commit": "7d3c4e1",
  "correlationId": "5c2d0c94-ecfe-4a5a-8f6d-5c6a7f5b21ea",
  "durationMs": null,
  "errorCode": "STREAM_DOWN",
  "stream": "icecast",
  "fallback": "file://fallback.mp3"
}
```

## Retrieving logs

### Journald (system services)
```bash
# Follow agent convergence logs on a Pi
sudo journalctl -u role-agent.service -o json-pretty -f

# Show the last failed convergence and include error metadata
sudo journalctl -u role-agent.service -o json-pretty --grep '"level":"error"' | tail
```

### Docker (VPS containers)
```bash
# Backend API / worker
cd /opt/fleet
docker compose -f infra/vps/compose.fleet.yml logs -f fleet-api

# Audio control container on a Pi
docker logs --tail=200 -f audio-control
```

### Grafana → Explore (Loki)

1. Open Grafana at `https://<vps-host>:3000` (credentials from `infra/vps/monitoring.env`).
2. Navigate to **Explore → Loki**.
3. Query examples:
   * `{service="fleet-api", correlationId="5c2d0c94-ecfe-4a5a-8f6d-5c6a7f5b21ea"}` – trace a request across API and device logs.
   * `{service="role-agent", level="error"} |= "GIT_FETCH"` – surface Git failures during convergence.
   * `{service="audio-control"} |= "fallback"` – inspect fallback activations.

Use the **Log context** feature in Grafana to pull surrounding entries when investigating multi-step failures.

## Operational tips

* Always include `X-Correlation-Id` when calling the API from scripts. This guarantees the value flows to workers, device control planes, and the logging helpers.
* When diagnosing device drift, start with logs filtered by `correlationId` and then pivot to the new **Agent Convergence** dashboard to confirm the last deployment commit and runtime of the agent.
* Promtail continues to ship logs into Loki from both the VPS and Raspberry Pis. If logs disappear, verify the promtail containers defined in `infra/vps/compose.promtail.yml` and on the devices are running before blaming application code.
* The acceptance workflow (`scripts/acceptance.sh`) is invaluable after incident response—run it to validate that every audio player can reach Icecast and that the role agents completed a fresh convergence.

## Extending logging

* **New Bash utilities** should `source agent/logging.sh` and rely on `log_info`/`log_error`. Export `FLEET_LOG_*` variables to enrich the output when the script knows the host, role, or correlation ID ahead of time.
* **Node/TypeScript services** should import the shared Pino logger from `apps/api/src/observability/logging.ts` to inherit the same format and correlation context.
* If you need to add a new error taxonomy, prefer structured `errorCode` values (e.g., `GIT_FETCH`, `STREAM_DOWN`, `DEVICE_UNREACHABLE`) so alerts and dashboards can group failures without fragile substring matches.
