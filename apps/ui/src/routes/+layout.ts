import type { LayoutLoad } from './$types';
import { version } from '$app/environment';
import { apiClient } from '$lib/api/client';

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

  const [layoutResult, stateResult] = await Promise.all([
    toResult(apiClient.fetchLayout({ fetch })),
    toResult(apiClient.fetchState({ fetch }))
  ]);

  const layout = layoutResult.value;
  const state = stateResult.value;

  return {
    version,
    envLabel,
    layout,
    layoutError: layoutResult.error,
    stateError: stateResult.error,
    connection: state?.connection ?? { status: 'offline', latencyMs: 0 },
    build: state?.build ?? { commit: 'unknown', version: 'unknown' },
    lastUpdated: layout?.health?.updatedAt ?? new Date().toISOString()
  };
};
