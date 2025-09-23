# Architecture

## Routing & layout

- `src/routes/+layout.svelte` implements the persistent top bar and two-column shell. The right column shows health tiles, errors, and
event feed by default but can be overridden via a named slot.
- Layout data (`src/routes/+layout.ts`) fetches app metadata, connection probe, and health feed once per navigation. Pages can call
`parent()` to reuse this data.
- Feature routes (`/audio`, `/video`, `/zigbee`, `/camera`, `/health`, `/logs`) sit under `src/routes/<feature>`. Each route loads only
its required data and reuses the same module components as the dashboard.

## Stores & global state

- `src/lib/stores/app.ts` exposes writable stores for connectivity status, global toasts, mock usage flag, and per-module UI state
(`success`, `loading`, `empty`, `error`).
- `createModuleStateStore` returns derived stores for module-specific controls. The layout hosts “Mock states” controls that mutate
these stores so designers can preview skeleton, error, and empty states without backend involvement.
- Toast helpers (`addToast`, `removeToast`) push transient notifications rendered by `src/lib/components/Toast.svelte`.

## Design system

- Tokens live in `src/lib/design/tokens.css` and drive spacing, typography, color, shadows, and radii. `global.css` wires resets and
focus rings.
- UI primitives in `src/lib/components` (Button, Card, Slider, StatusPill, DeviceTile, Skeleton, EmptyState, Toast) avoid external UI
libraries while standardising semantics and interactions.
- Feature modules (`src/lib/modules`) compose primitives for each subsystem so pages stay declarative.

## API client & mocks

- `src/lib/api/client.ts` centralises fetch logic, automatically injects the bearer token, retries idempotent `GET`s, and routes to
mock data when `VITE_USE_MOCKS=1`.
- `scripts/generate-openapi.mjs` writes types to `src/lib/api/generated` when `apps/api/openapi.yaml` exists. A placeholder is created
otherwise to keep imports type-safe.
- JSON fixtures in `src/lib/api/mocks` drive all modules. The mock loader clones data to avoid accidental mutation between tests.

## Feature flagging & states

- `VITE_USE_MOCKS` forces mock usage regardless of backend availability. A toggle in the mock control panel lets engineers flip this
at runtime.
- Module states are decoupled from network fetches. Even when data loads successfully, designers can switch a module into `loading`,
`empty`, or `error` mode to validate copy and visuals. When the network fails the component automatically falls back to the error
state.

## Testing & quality gates

- ESLint + Prettier enforce TypeScript/Svelte style guides (see `eslint.config.js` & `.prettierrc`).
- Vitest covers component contracts (rendering, variant props, accessibility attributes).
- Playwright (`tests/e2e`) performs smoke verification that the dashboard renders and mocks show expected content.
- `npm run lighthouse` builds the project, runs `vite preview`, and enforces performance (≥90), accessibility (≥95), and best
practices (≥95) budgets via Lighthouse.
