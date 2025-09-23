# Fleet API mock server

A lightweight Express + `express-openapi-validator` server that mirrors the
public Fleet API contract. The mock server loads fixtures from
`apps/api-mock/fixtures` and honours the OpenAPI spec at `apps/api/openapi.yaml`.

## Installation

```
npm install
npm install --prefix apps/api-mock
```

The first command installs the monorepo tooling (Spectral, generator). The
second installs the mock server dependencies.

## Running the mock

```
npm run mock
```

The server starts on <http://localhost:3015/api>. Every response includes
`x-correlation-id` and the error payload defined in the contract.

### Environment variables

| Variable         | Description                                                  | Default |
| ---------------- | ------------------------------------------------------------ | ------- |
| `PORT`           | Port to bind the mock server.                                | `3015`  |
| `MOCK_DELAY_MS`  | Artificial latency injected before every response (ms).      | `120`   |
| `MOCK_UNSTABLE`  | When set to `1`, ~10% of device requests return a 504 error. | unset   |

### Simulating unhappy paths

Add the `x-mock-simulate` header to force error responses for a request:

| Header value    | Response                          |
| --------------- | --------------------------------- |
| `timeout`       | 504 `UPSTREAM_TIMEOUT`            |
| `bad-gateway`   | 502 `UPSTREAM_UNAVAILABLE`        |
| `conflict`      | 409 `RESOURCE_BUSY`               |
| `rate-limit`    | 429 `RATE_LIMIT_EXCEEDED` + RL headers |

The mock still enforces bearer auth. Send `Authorization: Bearer demo` (or any
non-empty string) for happy-path calls. Tokens ending in `:ro` simulate a
read-only scope and block write operations with a 403.

### Example probes

```
curl -i -H 'Authorization: Bearer demo' http://localhost:3015/api/fleet/state
curl -i -H 'Authorization: Bearer demo' http://localhost:3015/api/audio/devices
curl -i -H 'Authorization: Bearer demo' -H 'x-mock-simulate: timeout' \
  http://localhost:3015/api/audio/pi-audio-01
```

Each call returns JSON fixtures that align with the contract so the frontend can
be developed without live hardware.
