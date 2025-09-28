# UI Structure & Reliability Gates

## Route Contracts
Each first-render must hydrate data exclusively through generated OpenAPI clients. The table below maps critical routes to their contract tests.

| Route | Loader Module | Primary Client Call | Test File |
| --- | --- | --- | --- |
| `/` | `apps/ui/src/routes/+page.ts` | `client.fleet.getOverview()` | `tests/first-render/home.spec.ts` |
| `/console` | `apps/ui/src/routes/console/+page.server.ts` | `apiClient.fetchSystemHealth()` | Flagged - add contract test when feature flag flips |
| `/fleet/overview` | `apps/ui/src/routes/fleet/overview/+page.ts` | `client.fleet.getOverview()` | `tests/first-render/fleet-overview.spec.ts` |
| `/logs` | `apps/ui/src/routes/logs/+page.ts` | `client.logs.stream()` | `tests/first-render/logs.spec.ts` |
| `/settings` | `apps/ui/src/routes/settings/+page.ts` | `client.settings.list()` | `tests/first-render/settings.spec.ts` |
| `/audio/overview` | `apps/ui/src/routes/audio/overview/+page.ts` | `client.audio.getOverview()` | `tests/first-render/audio-overview.spec.ts` |
| `/video/overview` | `apps/ui/src/routes/video/overview/+page.ts` | `client.video.getOverview()` | `tests/first-render/video-overview.spec.ts` |
| `/zigbee` | `apps/ui/src/routes/zigbee/+page.ts` | `client.zigbee.getStatus()` | `tests/first-render/zigbee.spec.ts` |
| `/camera` | `apps/ui/src/routes/camera/+page.ts` | `client.camera.getStatus()` | `tests/first-render/camera.spec.ts` |

If any route adds a new API dependency, extend the contract test suite and update this table.

## SSR Safety Rules
- Never access `window`, `document`, or browser-only APIs inside `+layout.server.ts`, `+page.server.ts`, or module-level code. Use `browser` from `$app/environment` and guard appropriately.
- Loader functions must return null-safe payloads. Use explicit defaults when optional data is missing.
- Direct network calls are forbidden. Use the generated OpenAPI client or backend endpoints via server-side helpers.

## Feature Flags
- Flags live in `apps/ui/src/lib/config/features.ts` and are accessed with `isFeatureEnabled(flag)`.
- Defaults: video, zigbee, and camera features are **disabled** in production. Audio and fleet overview are **enabled**.
- Playwright smoke tests assert OFF states hide controls and ON states exercise happy paths.
- Document any new flag in `/docs/24-repo-discipline.md#feature-flag-discipline` and add toggling instructions for ops.

## Adapters & Data Stores
- Centralized API client: `apps/ui/src/lib/api/client.ts`.
- Derived stores: `apps/ui/src/lib/stores/app.ts` and route-specific stores under `apps/ui/src/lib/stores/**`.
- Use SvelteKit `load` to resolve async data. Avoid running adapters inside components on initial render.

## Test Strategy
- Unit tests cover SSR loaders with mock clients to ensure null-safe defaults.
- First-render contract tests (`npm run test:first-render`) validate the UI uses generated clients and expects the correct shapes.
- Playwright smokes (`npm run test:playwright -- --project smoke`) cover operator-critical flows with feature flags toggled.

## When Adding a New Route
1. Add the route under `apps/ui/src/routes/...`.
2. Define a loader that uses the generated client.
3. Add feature flag gates if the module is not production-ready.
4. Extend contract tests and Playwright smokes.
5. Update this document and `/docs/runbooks/ui-stabilization.md`.
