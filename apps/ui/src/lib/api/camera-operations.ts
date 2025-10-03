import { browser } from '$app/environment';
import { rawRequest, USE_MOCKS, UiApiError, type RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { CameraEvent, CameraState } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

export interface CameraQueryOptions {
  fetch?: typeof fetch;
}

export const getCameraOverview = async (options: CameraQueryOptions = {}): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.camera();
  }

  const fetchImpl = ensureFetch(options.fetch);
  return rawRequest<CameraState>('/camera/summary', {
    method: 'GET',
    fetch: fetchImpl as RequestOptions['fetch'],
  });
};

export const loadCameraState = async (options: CameraQueryOptions = {}): Promise<CameraState> =>
  getCameraOverview(options);

export const selectCamera = async (
  cameraId: string,
  options: CameraQueryOptions = {}
): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.cameraSelect(cameraId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest('/camera/active', {
      method: 'POST',
      body: { cameraId },
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status?: number }).status!
        : 422;
    const detail = error instanceof Error ? error.message : error;
    throw new UiApiError('Unable to select camera', status, detail);
  }

  return getCameraOverview(options);
};

export const acknowledgeCameraEvent = async (
  eventId: string,
  options: CameraQueryOptions = {}
): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.cameraAcknowledge(eventId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/camera/events/${eventId}/ack`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status?: number }).status!
        : 422;
    const detail = error instanceof Error ? error.message : error;
    throw new UiApiError('Unable to acknowledge camera event', status, detail);
  }

  return getCameraOverview(options);
};

export const requestCameraClip = async (
  event: CameraEvent,
  options: CameraQueryOptions = {}
): Promise<string> => {
  if (USE_MOCKS) {
    const refreshed = mockApi.cameraRefreshPreview(event.cameraId);
    const match = refreshed.clips.find(
      (clip) => clip.id === event.id || clip.cameraId === event.cameraId
    );
    if (match?.url) {
      return match.url;
    }
    if (event.clipUrl) {
      return event.clipUrl;
    }
    throw new UiApiError('Clip not available in mock data', 404);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchImpl = ensureFetch(options.fetch);
  throw new UiApiError('Camera clip export unavailable while hardware is offline', 503);
};

export const refreshCameraPreview = async (
  cameraId: string | undefined,
  options: CameraQueryOptions = {}
): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.cameraRefreshPreview(cameraId);
  }

  if (!browser) {
    return getCameraOverview(options);
  }

  const fetchImpl = ensureFetch(options.fetch);

  if (!cameraId) {
    return getCameraOverview(options);
  }

  try {
    await rawRequest(`/camera/${cameraId}/refresh`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status?: number }).status!
        : 422;
    const detail = error instanceof Error ? error.message : error;
    throw new UiApiError('Unable to refresh camera preview', status, detail);
  }

  return getCameraOverview(options);
};

export interface CameraProbeResult {
  cameraId?: string;
  probedAt: string;
  status?: 'reachable' | 'unreachable';
  reason?: string;
  result?: {
    rtsp_reachable: boolean;
    hls_available: boolean;
    preview_available: boolean;
    last_success: string | null;
    cached: boolean;
  } | null;
  cameras?: Array<{
    cameraId: string;
    name: string;
    status: 'reachable' | 'unreachable';
    reason: string;
    rtsp_reachable: boolean;
    hls_available: boolean;
  }>;
  summary?: {
    total: number;
    reachable: number;
    unreachable: number;
  };
}

export const probeCameraStream = async (
  cameraId?: string | null,
  options: CameraQueryOptions = {}
): Promise<CameraProbeResult> => {
  if (USE_MOCKS) {
    // Return mock probe result
    return {
      probedAt: new Date().toISOString(),
      cameras: [
        {
          cameraId: 'cam-001',
          name: 'Front Door',
          status: 'unreachable',
          reason: 'Camera hardware not attached',
          rtsp_reachable: false,
          hls_available: false,
        },
      ],
      summary: {
        total: 1,
        reachable: 0,
        unreachable: 1,
      },
    };
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return rawRequest<CameraProbeResult>('/camera/probe', {
      method: 'POST',
      body: cameraId ? { cameraId } : {},
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status?: number }).status!
        : 503;
    const detail = error instanceof Error ? error.message : error;
    throw new UiApiError('Unable to probe camera stream', status, detail);
  }
};
