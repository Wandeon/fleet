import { browser } from '$app/environment';
import { API_BASE_URL, rawRequest, USE_MOCKS, UiApiError, type RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { CameraEvent, CameraState } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;
const jsonHeaders = { 'Content-Type': 'application/json' } as const;

export interface CameraQueryOptions {
  fetch?: typeof fetch;
}

export const getCameraOverview = async (options: CameraQueryOptions = {}): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.camera();
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<CameraState>('/camera/overview', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('Falling back to /camera snapshot', error);
    const fallback = await rawRequest<CameraState>('/camera', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
    });
    return fallback;
  }
};

export const loadCameraState = async (options: CameraQueryOptions = {}): Promise<CameraState> =>
  getCameraOverview(options);

export const selectCamera = async (cameraId: string, options: CameraQueryOptions = {}): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.cameraSelect(cameraId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/camera/active`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ cameraId }),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /camera/active endpoint', error);
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
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /camera/events/{id}/ack endpoint', error);
  }
  return getCameraOverview(options);
};

export const requestCameraClip = async (
  event: CameraEvent,
  options: CameraQueryOptions = {}
): Promise<string> => {
  if (USE_MOCKS) {
    const refreshed = mockApi.cameraRefreshPreview(event.cameraId);
    const match = refreshed.clips.find((clip) => clip.id === event.id || clip.cameraId === event.cameraId);
    if (match?.url) {
      return match.url;
    }
    if (event.clipUrl) {
      return event.clipUrl;
    }
    throw new UiApiError('Clip not available in mock data', 404);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const response = await fetchImpl(`${API_BASE_URL}/camera/events/${event.id}/clip`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ cameraId: event.cameraId })
  });

  if (!response.ok) {
    throw new UiApiError('Failed to request camera clip', response.status, await response.text());
  }

  const body = (await response.json()) as { url: string };
  return body.url;
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
  try {
    await rawRequest(`/camera/${cameraId ?? 'active'}/refresh`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /camera/{id}/refresh endpoint', error);
  }
  return getCameraOverview(options);
};
