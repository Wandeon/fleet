import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:video');

  try {
    const video = await apiClient.fetchVideo({ fetch });
    return { video, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load video state';
    return { video: null, error: message };
  }
};
