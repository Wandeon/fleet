import type { LayoutLoad } from './$types';
import { version } from '$app/environment';
import { HealthApi, apiClient } from '$lib/api/client';

export const load: LayoutLoad = async ({ fetch, depends }) => {
  depends('app:layout');

  const envLabel = import.meta.env.MODE === 'development' ? 'Dev' : 'Prod';

  const toResult = async <T>(promise: Promise<T>) => {
    try {
      const value = await promise;
      return { value, error: null as null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      return { value: null as T | null, error: message };
    }
  };

  const [layoutResult, stateResult, healthResult] = await Promise.all([
    toResult(apiClient.fetchLayout({ fetch })),
    toResult(apiClient.fetchState({ fetch })),
    toResult(HealthApi.getSummary())
  ]);

  const layout = layoutResult.value ? { ...layoutResult.value } : null;
  if (layout && healthResult.value) {
    layout.health = healthResult.value;
  }

  const state = stateResult.value;
  const health = healthResult.value ?? layout?.health ?? null;

  return {
    version,
    envLabel,
    layout,
    layoutError: layoutResult.error,
    stateError: stateResult.error,
    healthError: healthResult.error,
    connection: state?.connection ?? { status: 'offline', latencyMs: 0 },
    build: state?.build ?? { commit: 'unknown', version: 'unknown' },
    lastUpdated: health?.updatedAt ?? new Date().toISOString()
  };
};
