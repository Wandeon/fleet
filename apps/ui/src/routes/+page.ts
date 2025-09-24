import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';
import { getAudioOverview } from '$lib/api/audio-operations';

interface ModuleResult<T> {
  data: T | null;
  error: string | null;
}

async function toResult<T>(promise: Promise<T>): Promise<ModuleResult<T>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:dashboard');
  const [audio, video, zigbee, camera] = await Promise.all([
    toResult(getAudioOverview({ fetch })),
    toResult(apiClient.fetchVideo({ fetch })),
    toResult(apiClient.fetchZigbee({ fetch })),
    toResult(apiClient.fetchCamera({ fetch }))
  ]);

  return {
    audio,
    video,
    zigbee,
    camera
  };
};
