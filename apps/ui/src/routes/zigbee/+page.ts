import type { PageLoad } from './$types';
import { getZigbeeOverview } from '$lib/api/zigbee-operations';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:zigbee');

  try {
    const zigbee = await getZigbeeOverview({ fetch });
    return { zigbee, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Zigbee state';
    return { zigbee: null, error: message };
  }
};
