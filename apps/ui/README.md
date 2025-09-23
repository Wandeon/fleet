
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

| Name | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE` | Base path for live Fleet API requests | `/api` |
| `VITE_FLEET_API_TOKEN` | Bearer token forwarded as `Authorization` header (if provided) | `CHANGEME` |
| `VITE_USE_MOCKS` | Force the UI to serve local mock JSON (`"1"`) | `1` |

Copy `.env.example` to `.env` to customise local settings.

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

