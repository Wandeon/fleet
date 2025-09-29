import type { PageServerLoad } from './$types';
import { getAudioOverview } from '$lib/api/audio-operations';
import { getVideoOverview } from '$lib/api/video-operations';
import { getCameraOverview } from '$lib/api/camera-operations';
import { getZigbeeOverview } from '$lib/api/zigbee-operations';

interface LoadResult<T> {
  data: T | null;
  error: string | null;
}

const toResult = async <T>(promise: Promise<T>): Promise<LoadResult<T>> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { data: null, error: message };
  }
};

export const load: PageServerLoad = async ({ fetch, depends }) => {
  depends('app:dashboard');

  // Load data for all dashboard modules
  const [audio, video, zigbee, camera] = await Promise.all([
    toResult(getAudioOverview({ fetch })),
    toResult(getVideoOverview({ fetch })),
    toResult(getZigbeeOverview({ fetch })),
    toResult(getCameraOverview({ fetch }))
  ]);

  return {
    audio,
    video,
    zigbee,
    camera
  } satisfies {
    audio: LoadResult<any>;
    video: LoadResult<any>;
    zigbee: LoadResult<any>;
    camera: LoadResult<any>;
  };
};