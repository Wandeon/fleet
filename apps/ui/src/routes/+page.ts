import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';
import { getAudioOverview } from '$lib/api/audio-operations';
import { loadCameraState } from '$lib/api/camera-operations';
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

  const audioPromise = toResult(getAudioOverview({ fetch }));
  const videoPromise = featureFlags.video
    ? toResult(apiClient.fetchVideo({ fetch }))
    : Promise.resolve<ModuleResult<Awaited<ReturnType<typeof apiClient.fetchVideo>>>>({
        data: null,
        error: null,
      });
  const cameraPromise = featureFlags.camera
    ? toResult(loadCameraState({ fetch }))
    : Promise.resolve<ModuleResult<Awaited<ReturnType<typeof loadCameraState>>>>({
        data: null,
        error: null,
      });
  const fleetStatePromise = toResult(apiClient.fetchState({ fetch }));
  const healthEventsPromise = toResult(
    fetch('/ui/health/events/recent?limit=5').then((r) => {
      if (!r.ok) throw new Error('Failed to fetch health events');
      return r.json() as Promise<{ events: any[]; count: number }>;
    })
  );

  const [audio, video, camera, fleetState, healthEvents] = await Promise.all([
    audioPromise,
    videoPromise,
    cameraPromise,
    fleetStatePromise,
    healthEventsPromise,
  ]);

  return {
    audio,
    video,
    camera,
    fleetState,
    healthEvents,
  };
};
