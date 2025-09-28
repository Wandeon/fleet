# Proxy header scan

## Route header summary

| Route | Response status | Content-Type | Cache-Control | Notes |
| --- | --- | --- | --- | --- |
| `/` | 200 (SSR shell) | `text/html; charset=utf-8` (SvelteKit default) | Not overridden; inherits SvelteKit defaults | Caddy forwards `/` and other UI paths to the SvelteKit node service without changing headers, and our server hooks only add `x-request-id`, so the framework-managed HTML response headers go through unchanged.【F:infra/vps/caddy.fleet.Caddyfile†L1-L35】【F:apps/ui/src/hooks.server.ts†L20-L55】 |
| `/ui/fleet/overview` | Mirrors upstream status (typically 200) | `application/json` enforced by `json(...)` helper | Upstream value forwarded if present, otherwise forced to `no-store` | `/ui/[...proxy]` routes call `proxyFleetRequest`, which fetches `/fleet/overview`, parses JSON, and forwards only selected headers—ensuring JSON content with no-store caching when the API omits it.【F:apps/ui/src/routes/ui/[...proxy]/+server.ts†L165-L200】【F:apps/ui/src/lib/server/proxy.ts†L149-L208】 |
| `/ui/logs/stream` | Mirrors upstream status (expected 200) | Upstream `Content-Type` (e.g., `text/event-stream`) is copied through | Upstream `Cache-Control` is forwarded when present; otherwise none | Production traffic is proxied directly by Caddy to the API with `Accept: text/event-stream`, while the SvelteKit fallback uses the streaming branch of `proxyFleetRequest` to pass through the SSE body and headers unchanged.【F:infra/vps/caddy.fleet.Caddyfile†L13-L18】【F:apps/ui/src/routes/ui/logs/stream/+server.ts†L1-L6】【F:apps/ui/src/lib/server/proxy.ts†L193-L214】 |

## Risks & suggested guardrails

1. **SSE requests advertise the wrong Accept header.** Even in streaming mode we send `Accept: application/json` to the upstream API, relying on the backend to ignore it. An API that honors `Accept` could downgrade the payload, leading browsers to treat the stream as a download.【F:apps/ui/src/lib/server/proxy.ts†L149-L167】  \
   _Guardrail:_ Allow `proxyFleetRequest` callers to override the `Accept` header (or switch to `text/event-stream` automatically when `stream: true`).
2. **Streaming fallbacks change MIME type.** If the upstream logs stream fails, `respondWithMock()` converts the mock payload into a JSON response (`application/json`), so SSE clients stop receiving events and may try to download the payload instead.【F:apps/ui/src/lib/server/proxy.ts†L123-L143】【F:apps/ui/src/routes/ui/logs/stream/+server.ts†L1-L6】  \
   _Guardrail:_ Provide a streaming-compatible mock (e.g., an SSE generator) or gate the fallback so SSE routes only ever return SSE content.
3. **Missing upstream headers propagate silently.** The streaming branch only copies through headers that exist; if the backend omits `Content-Type`, the proxied response also lacks it, triggering the browser “download .txt” behavior.【F:apps/ui/src/lib/server/proxy.ts†L193-L201】  \
   _Guardrail:_ After copying headers, default `content-type` to `text/event-stream` (or another explicit value) whenever `stream: true`.
