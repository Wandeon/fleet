# API latency and failure flow

This note describes how UI requests travel through the stack and how different
failure scenarios bubble back to the frontend. Use it to reason about loading
spinners, error messaging, and retries.

```
UI (SvelteKit fetch)
  ↓  Authorization: Bearer <token>
Fleet API (this project)
  ↓  HTTP proxy / device adapters (audio-player :8081, TV CEC bridge, Zigbee coordinator, camera service)
On-device control API
```

## Timeouts

- Fleet waits up to **4 seconds** for each device request.
- The mock server emulates this behaviour with `MOCK_UNSTABLE=1` (random 504s).
- When the timeout is hit the UI receives **504 Gateway Timeout** with
  module-specific error codes (e.g. `AUDIO_DEVICE_TIMEOUT`, `CAMERA_EVENTS_TIMEOUT`).
- UI should surface a non-blocking toast and allow retry; background polling can
  back off for 30 seconds to avoid hammering offline devices.

## Upstream connectivity failures

- DNS errors, connection refused, or TLS handshake failures are translated to
  **502 Bad Gateway** with code `UPSTREAM_UNAVAILABLE`.
- Suggested UX: show a banner (“backend temporarily unavailable”) and expose a
  retry button. Automatic retries should use exponential backoff starting at 5s.

## Validation & conflicts

- Invalid payloads and cursors yield **422 VALIDATION_FAILED**. The `details`
  field includes the offending property. Use this to highlight the form field in
  the UI.
- Device state conflicts (e.g. TV already processing another command) produce
  **409 RESOURCE_BUSY**. UI should keep the last known state and re-enable the
  control after a short delay.

## Rate limits

- A burst of calls beyond configured thresholds returns **429
  RATE_LIMIT_EXCEEDED**.
- Use the `retry-after` header to display a countdown or disable controls until
  the window resets.

## Correlation IDs

- Every request carries / receives `x-correlation-id`. Log this alongside UI
  error messages to line up frontend issues with backend traces.
- The generated client in `apps/ui/src/lib/api/client.ts` automatically provides
  a correlation ID per request. When debugging, pipe this into log entries.

## Mock server expectations

- `npm run mock` serves at <http://localhost:3015/api>.
- Responses include the same headers and error shapes as production.
- Use `x-mock-simulate: timeout` / `bad-gateway` / `rate-limit` to force the
  unhappy paths above and verify UI handling.
