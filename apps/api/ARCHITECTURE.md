# Architecture

## High-level flow

```
Client -> Express router -> Bearer auth -> Rate limiter ->
  Correlation + logging -> Metrics middleware -> Route handler ->
  Upstream device proxy (with timeout/retry/breaker)
```

1. Requests enter through Express and immediately pass the bearer-token
   authenticator. Missing or invalid tokens emit `401` responses with the
   unified error shape (`code`, `message`, `correlationId`).
2. A token-bucket limiter (per-IP plus global) protects the API. When exhausted it
   returns `429` and publishes standard `X-RateLimit-*` headers.
3. Correlation IDs propagate via `x-correlation-id` header or a generated UUID and
   are attached to logs, metrics, and error payloads.
4. `metricsMiddleware` records request counters and latency histograms per
   sanitized route.
5. Route handlers delegate to typed upstream adapters (e.g. `upstream/audio.ts`),
   which call the fetch wrapper in `upstream/http.ts`.

## Device proxy mechanics

- **Timeouts** – Each upstream request uses `AbortController` with
  `TIMEOUT_MS` (default 3s). Timeouts map to `504` with `code=upstream_timeout`.
- **Retries** – `GET` requests retry up to `RETRY_MAX` times using exponential
  backoff (`RETRY_BACKOFF_MS` with jitter). Only 5xx/transport errors trigger
  retries; non-idempotent verbs never retry.
- **Circuit breaker** – Failures per device accumulate. After
  `CIRCUIT_FAILURE_THRESHOLD` consecutive errors the device circuit opens for
  `CIRCUIT_OPEN_MS`. During the open window new requests fail fast with `503` and
  `code=circuit_open`. Gauge `circuit_breaker_state{deviceId}` exposes the state.
- **Metrics & events** – All upstream failures increment
  `upstream_device_failures_total{deviceId,reason}` and append to the in-memory
  events ring buffer consumed by `/health/events/recent`.

## Observability surface

- **Logs** – Pino structured logs with keys `msg`, `route`, `status`, `latency_ms`,
  `deviceId`, `correlationId`.
- **Prometheus** – `http_requests_total`, `http_request_duration_ms`,
  `upstream_device_failures_total`, `circuit_breaker_state`.
- **Health** – `/healthz` (liveness) and `/readyz` (registry readiness). The
  readiness check lazy-loads the device registry if it is not yet initialized.

## Device registry

`DEVICE_REGISTRY_JSON`/`DEVICE_REGISTRY_PATH` provides the source of truth for all
known devices. Each record is normalised to:

```
{
  id: string,
  name: string,
  role: string,
  module: string,
  baseUrl: string,
  authToken?: string,
  capabilities: string[]
}
```

The registry is cached in-memory and refreshed during readiness checks if it has
not loaded successfully.

## Error mapping

| Scenario                                | Response                   |
| --------------------------------------- | -------------------------- |
| Validation (Zod)                        | `422 validation_failed`    |
| Upstream timeout/Abort                  | `504 upstream_timeout`     |
| Network errors (ECONNREFUSED/ENOTFOUND) | `502 upstream_unreachable` |
| Upstream 5xx/unknown                    | `502 upstream_error`       |
| Upstream 409                            | `409 conflict`             |
| Circuit open                            | `503 circuit_open`         |

All error payloads include the correlation ID to simplify tracing across
services.
