
# Fleet UI API client

This directory contains the generated TypeScript client used by the Fleet web UI
when talking to the mock or real backend API.

## Regenerating the client

```
npm run openapi:generate
```

The command reads `apps/api/openapi.yaml` and writes fresh types and services to
`apps/ui/src/lib/api/gen`. Generated files should always be committed so other
contributors work against the same contract.

## Using the wrapper

The `apps/ui/src/lib/api/client.ts` file wraps the generated services and sets a
default configuration (base URL `/api`, automatic `x-correlation-id`, and bearer
token wiring). Example usage inside the SvelteKit UI:

```ts
import { configureApiClient, FleetApi } from '$lib/api/client';

configureApiClient({
  getToken: () => window.localStorage.getItem('fleetToken') ?? '',
});

const layout = await FleetApi.getLayout();
const state = await FleetApi.getState();
```

Additional helpers (`AudioApi`, `VideoApi`, `ZigbeeApi`, `CameraApi`, and
`HealthApi`) expose the most common control operations with type safety.

# Fleet UI Shell

Operator-first control surface for Head Spa devices built with SvelteKit. The UI ships with a two-column layout, mocked data, and a
minimal design system so feature teams can wire live APIs without changing component contracts.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:5173](http://localhost:5173). The mock backend is bundled and enabled by default.

## Environment variables

### Local development (Vite)

| Name | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE` | Base path for Fleet API requests during development | `/api` |
| `VITE_FLEET_API_TOKEN` | Optional bearer token added to client requests | `CHANGEME` |
| `VITE_USE_MOCKS` | Serve mock JSON (`"1"`) instead of calling the live API | `1` |

Copy `.env.example` to `.env` to customise local settings before running `npm run dev`.

### Production runtime (Docker / SSR)

These values are injected by `infra/vps/compose.fleet.yml` and mirrored in `vps/fleet.env`.

| Name | Required | Description | Example |
| --- | --- | --- | --- |
| `HOST` | ✓ | Interface the Node adapter binds to | `0.0.0.0` |
| `PORT` | ✓ | Port exposed by the SvelteKit server | `3000` |
| `ORIGIN` | ✓ | Public HTTPS origin served via Caddy | `https://app.headspamartina.hr` |
| `FLEET_API_BASE` | ✓ | Internal API base URL for SSR fetches | `http://fleet-api:3015` |
| `FLEET_API_BEARER` | ✓ | Server-only bearer token for SSR API calls | `replace-with-admin-token` |
| `PUBLIC_API_URL` | ✓ | Browser-facing API URL routed through Caddy | `https://app.headspamartina.hr/api` |
| `PUBLIC_API_BASE` | ✓ | Path segment used by the browser client | `/api` |
| `PUBLIC_API_BEARER` | Optional | Public token exposed to the browser if required | `replace-with-public-token` |
| `VITE_API_BASE` | ✓ | Compile-time base path for client requests | `/api` |
| `VITE_FLEET_API_TOKEN` | Optional | Compile-time token bundled into the client | `replace-with-public-token` |
| `VITE_USE_MOCKS` | ✓ | Set to `0` in production to enable live data | `0` |

See `vps/fleet.env.example` for an up-to-date template of the production secrets/values required during deployment.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start SvelteKit in dev mode |
| `npm run build` | Build the production bundle |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | Run ESLint with Svelte + TypeScript rules |
| `npm run typecheck` | Run `svelte-check` over the project |
| `npm run test` | Execute Vitest unit tests |
| `npm run test:ui` | Run Playwright smoke tests |
| `npm run lighthouse` | Build, start preview, and run Lighthouse budgets |
| `npm run generate:openapi` | Generate typed API bindings when `apps/api/openapi.yaml` exists |
| `npm run check` | Lint + typecheck + unit test combo |

## Mock data & feature flags

The UI consumes JSON fixtures located in `src/lib/api/mocks` when `VITE_USE_MOCKS=1`. Use the “Mock states” control in the top bar to
simulate loading, empty, and error states per module. Toggle to live APIs by setting `VITE_USE_MOCKS=0` and providing a valid
`VITE_FLEET_API_TOKEN` if required.

## Generating OpenAPI types

1. Drop or symlink `apps/api/openapi.yaml` into the repo.
2. Run `npm run generate:openapi`.
3. The script writes strongly typed definitions to `src/lib/api/generated`. The API client will automatically pick up the generated
types on the next build.

## Project layout

- `src/lib/design` – design tokens and global styles.
- `src/lib/components` – reusable UI primitives.
- `src/lib/modules` – feature modules for audio, video, zigbee, and camera.
- `src/lib/api` – fetch client, mocks, and OpenAPI integration stubs.
- `src/lib/stores` – shared writable stores for connectivity, toasts, and mock states.
- `src/routes` – SvelteKit pages (dashboard + feature routes) sharing the two-column layout.
- `tests/e2e` – Playwright smoke coverage.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for deeper implementation notes and [`TESTING.md`](./TESTING.md) for quality checks.
