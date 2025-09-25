import type { PageLoad } from './$types';
import { getCameraOverview } from '$lib/api/camera-operations';
import type { CameraState } from '$lib/types';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:camera');

  try {
    const camera = await getCameraOverview({ fetch });
    return { camera, error: null as string | null } satisfies { camera: CameraState; error: string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load camera state';
    return { camera: null, error: message };
  }
};
