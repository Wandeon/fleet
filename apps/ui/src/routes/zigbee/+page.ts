import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:zigbee');

  try {
    const zigbee = await apiClient.fetchZigbee({ fetch });
    return { zigbee, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Zigbee state';
    return { zigbee: null, error: message };
  }
};
