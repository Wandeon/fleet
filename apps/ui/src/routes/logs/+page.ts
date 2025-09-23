import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:logs');

  try {
    const logs = await apiClient.fetchLogs({ fetch });
    return { logs, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load logs';
    return { logs: null, error: message };
  }
};
