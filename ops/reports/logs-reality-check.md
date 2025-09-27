# Logs Reality Check – 2025-09-26

## Scope & references
- **UI expectations:** The UX stories call for a real-time log table with level filters (error/warn/info), correlation/device search, a pause toggle, and context pane, plus export jobs that deliver download manifests for CSV/JSON.【F:docs/ux/operator-jobs-and-stories.md†L181-L202】
- **Doc claims:** Phase C audit notes the `/logs` page should already be wired to REST+SSE with severity/source/search filters and export support, while flagging missing backend level filtering as a blocker.【F:docs/ux/audit/phaseC-20250925.md†L13-L33】
- **Backend surface:** The API exposes `/logs`, `/logs/stream`, `/logs/query`, `/logs/export`, and `/logs/jobs/:id` with in-memory buffering, SSE, filtered queries, and mocked export jobs.【F:apps/api/src/routes/logs.ts†L69-L299】

## Observations
### Live stream (SSE)
The API emits `Content-Type: text/event-stream` and replays buffered entries before streaming new ones when the client advertises SSE. Example handshake and payloads:
```
$ curl -i -N -H 'Authorization: Bearer secret' -H 'Accept: text/event-stream' \
    'http://127.0.0.1:3015/logs/stream?limit=1&level=info'
HTTP/1.1 200 OK
Content-Type: text/event-stream
...
data: {"timestamp":"2025-09-26T20:57:42.141Z", ... "route":"/logs/query" ...}
```
【bc2d4d†L1-L29】
This matches the documented SSE contract and the UI helper that instantiates `EventSource` against `/logs/stream` (with mock fallback when not in the browser).【F:apps/api/src/routes/logs.ts†L69-L140】【F:apps/ui/src/lib/api/logs-operations.ts†L178-L216】

### Snapshot query & filtering
`GET /logs/query` respects numeric limits and level filters that map to the backend’s accepted levels (`trace|debug|info|warn|error|fatal`). A basic info-level query returns JSON along with cache-control headers:
```
$ curl -i -H 'Authorization: Bearer secret' \
    'http://127.0.0.1:3015/logs/query?limit=2&level=info'
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
...
{"items":[{"timestamp":"2025-09-26T20:57:33.755Z", ...}]}
```
【ceede2†L1-L27】
However, the UI presents a “Critical” option that maps to `level=critical`, which the API rejects with a validation error because the schema omits that value.【F:apps/ui/src/routes/logs/+page.svelte†L24-L142】【F:apps/ui/src/lib/api/logs-operations.ts†L54-L121】【1347ff†L1-L27】 This contradicts the expectation that severity filters are fully wired.

### Export flow
`POST /logs/export` enforces privileged roles/scopes and returns a queued job with a download URL, while `/logs/jobs/{id}` immediately responds with a mocked `completed` status:
```
$ curl -i -X POST -H 'Authorization: Bearer secret' -H 'x-operator-roles: admin' \
    -H 'Content-Type: application/json' \
    -d '{"level":"info","format":"json"}' http://127.0.0.1:3015/logs/export
HTTP/1.1 202 Accepted
{"exportId":"e80e5b1f-5364-44d8-a797-00ed019b6961", ...}

$ curl -i -H 'Authorization: Bearer secret' \
    http://127.0.0.1:3015/logs/jobs/e80e5b1f-5364-44d8-a797-00ed019b6961
HTTP/1.1 200 OK
{"exportId":"e80e5b1f-5364-44d8-a797-00ed019b6961","status":"completed", ...}
```
【be875b†L1-L29】【cddc4b†L1-L29】
The UI’s “Export TXT/JSON” buttons instead re-fetch the current snapshot client-side and generate a Blob download immediately, bypassing the export job lifecycle described in the UX story.【F:apps/ui/src/routes/logs/+page.svelte†L168-L265】【F:apps/ui/src/lib/api/logs-operations.ts†L165-L176】 That means operators never see a job status or server-generated artifact despite documentation promising download manifests.

### Authentication & proxying
Direct API access without a bearer token yields `401 Unauthorized` as expected, while the UI proxy (with `API_BEARER` configured) returns `200 OK` for `/ui/logs`, forwarding the API response with `cache-control: no-store`:
```
$ curl -i http://127.0.0.1:3015/logs            # no auth
HTTP/1.1 401 Unauthorized
...
{"code":"unauthorized","message":"Missing bearer token", ...}

$ curl -i http://127.0.0.1:4173/ui/logs         # via UI proxy
HTTP/1.1 200 OK
cache-control: no-store
...
{"message":"Logs API endpoint","status":"active", ...}
```
【cd45e3†L1-L27】【9c21a7†L1-L13】 The proxy always attaches the configured token and falls back to mock data only on upstream failure, as defined in `proxyFleetRequest`.【F:apps/ui/src/lib/server/proxy.ts†L1-L148】

## Notable mismatches & follow-ups
1. **Severity filter gap:** Selecting “Critical” triggers a 422 because the backend schema has no `critical` option. Update the API to accept the value or adjust the UI options/documentation accordingly.【F:apps/ui/src/routes/logs/+page.svelte†L24-L142】【F:apps/api/src/routes/logs.ts†L142-L198】【1347ff†L1-L27】
2. **Export workflow divergence:** UI exports run entirely client-side, so there is no progress indicator, authorization check, or audit of downloads, contrary to UX expectations for a server-managed job.【F:apps/ui/src/routes/logs/+page.svelte†L168-L265】【F:docs/ux/operator-jobs-and-stories.md†L193-L202】 Consider invoking `/logs/export` and polling `/logs/jobs/{id}` before presenting download links.
3. **Context pane/UI copy:** The UX story promises a context pane and correlation/device search; the current implementation offers inline `<details>` toggles and only filters correlation IDs by exact match, with the search input placeholder implying broader capabilities than the API provides (no full-text message search).【F:apps/ui/src/routes/logs/+page.svelte†L244-L315】【F:apps/ui/src/lib/api/logs-operations.ts†L104-L121】【F:docs/ux/operator-jobs-and-stories.md†L185-L202】 Align copy or expand search support.
4. **Backend backlog note outdated:** Documentation still claims backend level filtering is missing, but `/logs/query` already supports it (albeit with the level mismatch above). Update the audit notes or tighten validation to match UI terminology.【F:docs/ux/audit/phaseC-20250925.md†L13-L33】【F:apps/api/src/routes/logs.ts†L142-L198】

## Happy-path transcripts
1. **SSE stream:** `curl -i -N ... /logs/stream?limit=1&level=info` → `HTTP/1.1 200 OK`, `Content-Type: text/event-stream`, streaming buffered + live entries.【bc2d4d†L1-L29】
2. **Filtered snapshot:** `curl -i ... /logs/query?limit=2&level=info` → `HTTP/1.1 200 OK`, JSON payload of buffered entries, proving filter/limit semantics.【ceede2†L1-L27】
3. **Export lifecycle:** `curl -i -X POST ... /logs/export` (202 Accepted) followed by `curl -i ... /logs/jobs/{id}` (200 OK) showing queued→completed transition with download URL.【be875b†L1-L29】【cddc4b†L1-L29】

## Authentication snapshot
- `curl -i http://127.0.0.1:3015/logs` → `401 Unauthorized` with `WWW-Authenticate: Bearer`.【cd45e3†L1-L27】
- `curl -i http://127.0.0.1:4173/ui/logs` → `200 OK` from the UI proxy when `API_BEARER` is supplied.【9c21a7†L1-L13】

