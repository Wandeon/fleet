import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:audio');

  try {
    const audio = await apiClient.fetchAudio({ fetch });
    return { audio, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load audio state';
    return { audio: null, error: message };
  }
};
