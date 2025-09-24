# Fleet Backend API

This package provides the Fleet control-plane API. It authenticates callers with a
single bearer token, proxies audio device commands to Raspberry Pis, exposes
aggregated fleet status, and surfaces observability endpoints for Prometheus and
health probes.

## Getting started

```bash
npm install
npm run dev
```

The API listens on `HTTP_PORT` (default `3015`). Every request (except
`/healthz` and `/readyz`) must include `Authorization: Bearer <API_BEARER>`.

### Build & runtime notes

- Compile TypeScript with `npm run build` (outputs to `dist/`) and run the compiled server via `npm start`.
- Build the Docker image locally with `docker build -t fleet-api .` and run it using the documented environment variables.

### Required environment

| Variable | Description |
| --- | --- |
| `API_BEARER` | Shared secret required on all protected routes. |
| `DEVICE_REGISTRY_JSON` or `DEVICE_REGISTRY_PATH` | JSON map describing the devices the API proxies to. |

### Optional environment

| Variable | Default | Description |
| --- | --- | --- |
| `HTTP_PORT` | `3015` | HTTP listen port |
| `TIMEOUT_MS` | `3000` | Upstream request timeout |
| `RETRY_MAX` | `2` | Retry attempts for idempotent requests |
| `RETRY_BACKOFF_MS` | `250` | Base backoff (ms) between retries |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` | Failures before opening a circuit |
| `CIRCUIT_OPEN_MS` | `30000` | Duration to hold open circuits |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limiter window size |
| `RATE_LIMIT_MAX` | `120` | Tokens refilled per-IP per window |
| `RATE_LIMIT_BURST` | `40` | Per-IP burst capacity |
| `RATE_LIMIT_GLOBAL_MAX` | `600` | Global burst capacity |
| `CORS_ALLOWED_ORIGINS` | `https://app.headspamartina.hr` | Allowed origins (comma separated) |

### Running the worker

The background worker shares this codebase. Generate the Prisma client artifacts
before starting it locally so queue processing reflects the latest schema:

```bash
npm run db:generate
npm run worker
```

Run `npm run db:migrate` to apply pending migrations when preparing a new
environment.

### Data serialization

- Prisma models store structured fields (`Device.address`, `Device.capabilities`, `DeviceState.state`, `DeviceEvent.payload`,
  `Job.payload`) as `TEXT` to stay compatible with SQLite. Use the helpers in `src/lib/json.ts` (`stringifyJson`, `parseJson`,
  `parseJsonOr`) whenever reading from or writing to these columns so application code continues to work with plain objects.

### Device registry format

`DEVICE_REGISTRY_JSON` accepts the following structure:

```json
{
  "devices": [
    {
      "id": "pi-audio-01",
      "name": "Audio Player 01",
      "role": "audio",
      "module": "audio",
      "baseUrl": "http://pi-audio-01:8081",
      "tokenEnv": "AUDIO_PI_AUDIO_01_TOKEN",
      "capabilities": ["status", "play", "stop", "volume"]
    }
  ]
}
```

When `tokenEnv` is provided the API will resolve the token from that environment
variable; otherwise `token` can embed the literal credential.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with `tsx` watcher |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:generate` | Regenerate Prisma client artifacts |
| `npm run db:migrate` | Apply migrations in deploy mode |
| `npm run start` | Run the compiled server |
| `npm run lint` | ESLint with type information |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + integration suites |
| `npm run contract` | Spectral lint of `openapi.local.yaml` |
| `npm run ci` | End-to-end CI bundle (lint, typecheck, tests, contract, build) |

## Observability

- `GET /healthz` – liveness probe (no auth required)
- `GET /readyz` – readiness (validates device registry load)
- `GET /metrics` – Prometheus metrics including request counters, latency
  histograms, upstream failure totals, and circuit breaker gauges
- Structured JSON logs via Pino, keyed by correlation ID (from
  `x-correlation-id` header or generated UUID)

`/health/events/recent` exposes the latest 200 notable events (command
invocations, upstream errors) captured in memory.

## Testing

Vitest powers unit/integration tests and spins up an in-memory mock audio
control API to exercise timeout, retry, and error-mapping behaviour. Contract
validation is handled by the Spectral CLI against `openapi.local.yaml`.

## Docker

```
docker build -t fleet-api .
docker run --rm -p 3015:3015 \
  -e API_BEARER=secret \
  -e DEVICE_REGISTRY_JSON='{"devices":[{"id":"pi-audio-01","name":"Test","role":"audio","baseUrl":"http://pi-audio-01:8081"}]}' \
  fleet-api
```

A `healthcheck.js` script hits `/healthz` to support Docker healthchecks.
