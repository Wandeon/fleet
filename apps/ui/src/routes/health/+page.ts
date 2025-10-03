import type { PageLoad } from './$types';
import { rawRequest } from '$lib/api/client';

interface HealthSummaryDevice {
  id: string;
  status: 'online' | 'offline' | 'unknown';
  reason?: string;
}

interface HealthSummaryModule {
  module: string;
  total: number;
  online: number;
  devices: HealthSummaryDevice[];
}

interface HealthSummaryResponse {
  modules: HealthSummaryModule[];
  updatedAt: string;
}

export const load: PageLoad = async ({ parent, fetch }) => {
  const { layout } = await parent();

  let healthSummary: HealthSummaryResponse | null = null;
  let error: string | null = null;

  try {
    healthSummary = await rawRequest<HealthSummaryResponse>('/health/summary', { fetch });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load health summary';
  }

  return {
    layout,
    healthSummary,
    error,
  };
};
