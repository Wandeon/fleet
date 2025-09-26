import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getFleetDeviceDetail } from '$lib/api/fleet-operations';
import type { FleetDeviceDetail } from '$lib/types';

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends(`app:fleet-device:${params.id}`);
  try {
    const device = await getFleetDeviceDetail(params.id, { fetch });
    return { device, error: null as string | null } satisfies {
      device: FleetDeviceDetail;
      error: string | null;
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Device not found';
    throw error(404, message);
  }
};
