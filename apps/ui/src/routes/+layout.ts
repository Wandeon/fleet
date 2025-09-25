import type { LayoutLoad } from './$types';
import { version } from '$app/environment';
import { apiClient, rawRequest } from '$lib/api/client';
import type { FleetOverview } from '$lib/api/client';
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

  const toTileStatus = (module: FleetOverview['modules'][number]): 'ok' | 'warn' | 'error' => {
    if (module.degraded > 0) return 'warn';
    if (module.offline > 0) return 'error';
    return 'ok';
  };

  const toHealthData = (overview: FleetOverview, fallback?: HealthData | null): HealthData => {
    const metrics = overview.modules.length
      ? overview.modules.map((module) => {
          const total = module.online + module.degraded + module.offline;
          const label = module.label || formatModuleLabel(module.id);
          const status = toTileStatus(module);
          let hint: string | undefined;
          if (module.degraded > 0) {
            hint = `${module.degraded} degraded`;
          } else if (module.offline > 0) {
            hint = `${module.offline} offline`;
          }
          const value = total > 0 ? `${module.online}/${total} online` : 'No devices';
          return {
            id: module.id,
            label,
            value,
            status,
            hint
          } satisfies HealthData['metrics'][number];
        })
      : fallback?.metrics ?? [];

    return {
      updatedAt: overview.updatedAt,
      uptime: fallback?.uptime ?? '—',
      metrics
    } satisfies HealthData;
  };

  const [layoutResult, stateResult, overviewResult] = await Promise.all([
    toResult(apiClient.fetchLayout({ fetch })),
    toResult(apiClient.fetchState({ fetch })),
    toResult(rawRequest<FleetOverview>('/fleet/overview', { fetch }))
  ]);

  const layoutSource = layoutResult.value ?? null;
  let layout: LayoutData | null = layoutSource ? { ...layoutSource } : null;

  const existingHealth = layout?.health ?? null;
  const normalizedHealth = overviewResult.value
    ? toHealthData(overviewResult.value, existingHealth)
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
    healthError: overviewResult.error,
    connection: state?.connection ?? { status: 'offline', latencyMs: 0 },
    build: state?.build ?? { commit: 'unknown', version: 'unknown' },
    lastUpdated: health?.updatedAt ?? new Date().toISOString()
  };
};
