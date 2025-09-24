import type { PageLoad } from './$types';
import { getVideoOverview } from '$lib/api/video-operations';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:video');

  try {
    const video = await getVideoOverview({ fetch });
    return { video, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load video state';
    return { video: null, error: message };
  }
};
