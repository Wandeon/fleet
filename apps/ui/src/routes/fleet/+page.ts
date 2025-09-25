import type { PageLoad } from './$types';
import { getFleetOverview } from '$lib/api/fleet-operations';
import type { FleetOverview } from '$lib/types';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:fleet-overview');

  try {
    const overview = await getFleetOverview({ fetch });
    return { overview, error: null as string | null } satisfies { overview: FleetOverview; error: string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load fleet overview';
    return { overview: null, error: message };
  }
};
