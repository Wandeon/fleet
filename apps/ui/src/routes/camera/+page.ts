import type { PageLoad } from './$types';
import { loadCameraState } from '$lib/api/camera-operations';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:camera');

  try {
    const camera = await loadCameraState({ fetch });
    return { camera, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load camera state';
    return { camera: null, error: message };
  }
};
