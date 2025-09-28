import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getVideoOverview } from '$lib/api/video-operations';
import { isFeatureEnabled } from '$lib/config/features';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:video');

  if (!isFeatureEnabled('video')) {
    throw error(404, 'Video module disabled');
  }

  try {
    const video = await getVideoOverview({ fetch });
    return { video, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load video state';
    return { video: null, error: message };
  }
};
