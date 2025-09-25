import type { LayoutLoad } from './$types';
import { version } from '$app/environment';
import { HealthApi, apiClient } from '$lib/api/client';
import type { HealthSummary, ModuleHealth } from '$lib/api/client';
import type { HealthData, LayoutData } from '$lib/types';

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

  const formatModuleLabel = (id: string) =>
    id
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (segment) => segment.toUpperCase());

  const toTileStatus = (status: ModuleHealth['status']): 'ok' | 'warn' | 'error' => {
    if (status === 'healthy') return 'ok';
    if (status === 'degraded') return 'warn';
    return 'error';
  };

  const toHealthData = (summary: HealthSummary, fallback?: HealthData | null): HealthData => {
    const metrics = summary.modules.length
      ? summary.modules.map((module) => ({
          id: module.id,
          label: formatModuleLabel(module.id),
          value:
            module.status === 'healthy'
              ? 'Healthy'
              : module.status === 'degraded'
                ? 'Degraded'
                : 'Down',
          status: toTileStatus(module.status),
          hint: module.message ?? undefined
        }))
      : fallback?.metrics ?? [];

    return {
      updatedAt: summary.updatedAt,
      uptime: fallback?.uptime ?? '—',
      metrics
    } satisfies HealthData;
  };

  const [layoutResult, stateResult, healthResult] = await Promise.all([
    toResult(apiClient.fetchLayout({ fetch })),
    toResult(apiClient.fetchState({ fetch })),
    toResult(HealthApi.getSummary())
  ]);

  const layoutSource = layoutResult.value ?? null;
  let layout: LayoutData | null = layoutSource ? { ...layoutSource } : null;

  const existingHealth = layout?.health ?? null;
  const normalizedHealth = healthResult.value
    ? toHealthData(healthResult.value, existingHealth)
    : existingHealth;

  if (layout) {
    if (normalizedHealth) {
      layout.health = normalizedHealth;
    }
  } else if (normalizedHealth) {
    layout = { health: normalizedHealth } satisfies LayoutData;
  }

  const state = stateResult.value;
  const health = layout?.health ?? null;

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
