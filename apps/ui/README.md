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
