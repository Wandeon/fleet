# UI Structure

The SvelteKit UI provides the operator console for Fleet. It uses a shared two-column layout, SSR fetches through a proxy, and module components for audio, video, zigbee, and camera pages.

## Layout & routing

- `src/routes/+layout.svelte` renders the persistent shell (top bar, status banner, sidebar navigation, right-rail health feed). Layout data (`+layout.ts`) fetches app metadata and connection status once per navigation, exposing `parent()` data to child routes.【F:apps/ui/ARCHITECTURE.md†L3-L15】
- `src/routes/console` hosts the feature-flagged single-page console. While `VITE_FEATURE_CONSOLE=0`, it remains hidden from operators but can be loaded directly for development. The scaffold renders shared panel shells and a health summary placeholder without altering legacy module routes.【F:apps/ui/src/routes/console/+page.svelte†L1-L197】
- Primary routes live under `src/routes/<module>` with matching `+page.svelte` files. Each page consumes the mock/API client via `apiClient` and renders module-specific Svelte components from `src/lib/modules`.【F:apps/ui/src/routes/+page.svelte†L1-L80】【F:apps/ui/src/lib/modules/AudioModule.svelte†L1-L40】
- Server-only API routes under `src/routes/api/fleet/*` call `proxyFleetRequest` to fetch `/fleet/layout` and `/fleet/state`, providing SSR data to the dashboard and list pages.【F:apps/ui/src/routes/api/fleet/state/+server.ts†L1-L7】【F:apps/ui/src/lib/server/proxy.ts†L59-L103】

### Route map

| Path          | Purpose                                                                                                  | Data source                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`           | Dashboard cards summarizing module health, recent errors, and event feed.                                | `mockApi` during development, `/api/fleet/state` in production via proxy.                                    |
| `/console`    | Feature-flagged single-page console scaffold (panel placeholders + health summary).                     | `/health` ping via `apiClient.fetchSystemHealth()`; remaining data static placeholders.                        |
| `/audio`      | Playback controls (play/pause, upload fallback) with mock data until live API integration.               | `AudioModule` + `mockApi.audio()`.                                                                           |
| `/video`      | HDMI/CEC control layout with power, input, volume cards.                                                 | `VideoModule` + `mockApi.video()`.                                                                           |
| `/zigbee`     | Device table skeleton for Zigbee endpoints.                                                              | `ZigbeeModule` + `mockApi.zigbee()`.                                                                         |
| `/camera`     | Camera summary card with placeholder preview/log link.                                                   | `CameraModule` + `mockApi.camera()`.                                                                         |
| `/fleet`      | Fleet overview list linking to per-device detail pages.                                                  | Client-side fetch to `/ui/fleet/state` (proxy).【F:apps/ui/src/routes/fleet/+page.svelte†L1-L78】            |
| `/fleet/[id]` | Device detail view (status grid, log excerpts, actions). Currently mock driven.                          | `data.device` from `+page.server.ts` (mock).【F:apps/ui/src/routes/fleet/[id]/+page.svelte†L1-L160】         |
| `/logs`       | Filterable log viewer reading `/ui/logs` SSE/JSON. Shows search, severity/time filters, export controls. | `mockApi.logs()` fallback until API wired.【F:apps/ui/src/routes/logs/+page.svelte†L1-L120】                 |
| `/settings`   | Settings form for API bearer, proxy timeout, debug logging toggle, system info panel.                    | Mocked state with future API integration hooks.【F:apps/ui/src/routes/settings/+page.svelte†L1-L140】        |
| `/health`     | Placeholder health route flagged in UX audit (currently errors due to missing backend).                  | Should consume `/ui/health/summary` once implemented.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L40】 |

## Proxy & data fetching

- `src/lib/server/proxy.ts` handles SSR fetches. When `VITE_USE_MOCKS=1`, it returns mock data; otherwise it constructs target URLs relative to `FLEET_API_BASE`, injects bearer token headers, forwards correlation IDs, and clones responses while preserving caching headers.【F:apps/ui/src/lib/server/proxy.ts†L1-L87】
- `/ui/[...proxy]` route forwards arbitrary API paths (e.g., `/fleet/state`, `/logs`) through the proxy with mock fallbacks defined per path. Missing mocks trigger Svelte errors so tests catch unsupported routes.【F:apps/ui/src/routes/ui/[...proxy]/+server.ts†L1-L29】
- Client-side API usage goes through `src/lib/api/client.ts`, which configures fetch wrappers, attaches bearer tokens from local storage, and routes to mocks when `VITE_USE_MOCKS=1`. OpenAPI-generated types live in `src/lib/api/generated`.【F:apps/ui/ARCHITECTURE.md†L25-L45】

## Key modules & stores

- Design tokens and primitives (`src/lib/design/tokens.css`, `src/lib/components`) provide consistent theming and UI controls such as `Button`, `Card`, `StatusPill`, and `Toast`. Modules compose these primitives to render feature-specific states.【F:apps/ui/ARCHITECTURE.md†L17-L30】
- Global stores in `src/lib/stores/app.ts` expose connectivity status, toast queue, and module mock states. The top-level layout includes mock-state toggles for designers.
- Module components (Audio/Video/Zigbee/Camera) accept data + state props, so the same components render on the dashboard and dedicated pages without duplication.【F:apps/ui/src/lib/modules/AudioModule.svelte†L1-L80】

## UX considerations

- Several routes (`/health`, `/settings`, `/fleet/*`) currently rely on mock data and were flagged in the September 2025 UX audit as incomplete or erroring. Use [17-ux-gaps-and-priorities](./17-ux-gaps-and-priorities.md) to prioritize fixes before enabling live API calls.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】
- When enabling live mode (`VITE_USE_MOCKS=0`), ensure `API_BEARER` is populated in UI runtime env (`vps/fleet.env`) so SSR proxies can reach the API. UI fetches should flow through `/ui/*` to reuse correlation IDs and error handling.

Cross-reference [04-api-surface](./04-api-surface.md) for matching endpoints and [18-device-detail-pages](./18-device-detail-pages.md) for device view expectations.
