import type { PageLoad } from './$types';
import { getFleetOverview } from '$lib/api/fleet-operations';
import type { FleetOverview } from '$lib/types';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:fleet-overview');

  try {
    const overview = await getFleetOverview({ fetch });

    // Null-safety: ensure overview has required structure
    const safeOverview: FleetOverview = {
      totals: overview?.totals ?? { devices: 0, online: 0, offline: 0, degraded: 0 },
      modules: overview?.modules ?? [],
      devices: overview?.devices ?? [],
      updatedAt: overview?.updatedAt ?? new Date().toISOString()
    };

    return { overview: safeOverview, error: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load fleet overview';
    return { overview: null, error: message };
  }
};
