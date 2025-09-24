import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';
import { getAudioOverview } from '$lib/api/audio-operations';
import { featureFlags } from '$lib/config/features';


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
  const audioPromise = toResult(apiClient.fetchAudio({ fetch }));
  const videoPromise = featureFlags.video
    ? toResult(apiClient.fetchVideo({ fetch }))
    : Promise.resolve<ModuleResult<Awaited<ReturnType<typeof apiClient.fetchVideo>>>>({ data: null, error: null });
  const zigbeePromise = featureFlags.zigbee
    ? toResult(apiClient.fetchZigbee({ fetch }))
    : Promise.resolve<ModuleResult<Awaited<ReturnType<typeof apiClient.fetchZigbee>>>>({ data: null, error: null });
  const cameraPromise = featureFlags.camera
    ? toResult(apiClient.fetchCamera({ fetch }))
    : Promise.resolve<ModuleResult<Awaited<ReturnType<typeof apiClient.fetchCamera>>>>({ data: null, error: null });

  const [audio, video, zigbee, camera] = await Promise.all([

    toResult(getAudioOverview({ fetch })),
    toResult(apiClient.fetchVideo({ fetch })),
    toResult(apiClient.fetchZigbee({ fetch })),
    toResult(apiClient.fetchCamera({ fetch }))
    audioPromise,
    videoPromise,
    zigbeePromise,
    cameraPromise
  ]);

  return {
    audio,
    video,
    zigbee,
    camera
  };
};
