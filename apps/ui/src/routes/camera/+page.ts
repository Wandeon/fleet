import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:camera');

  try {
    const camera = await apiClient.fetchCamera({ fetch });
    return { camera, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load camera state';
    return { camera: null, error: message };
  }
};
