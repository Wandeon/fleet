import {
  API_BASE_URL,
  rawRequest,
  USE_MOCKS,
  UiApiError
} from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type {
  PowerState,
  VideoRecordingSegment,
  VideoState
} from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const jsonHeaders = {
  'Content-Type': 'application/json'
};

interface LegacyTvStatus {
  id: string;
  displayName: string;
  online?: boolean;
  power: PowerState;
  input: string;
  availableInputs?: string[];
  volume: number;
  mute: boolean;
  lastSeen: string;
}

const mapFallbackState = (status: LegacyTvStatus): VideoState => ({
  power: status.power,
  input: status.input,
  availableInputs: (status.availableInputs ?? []).map((input) => ({
    id: input,
    label: input,
    kind: input.toLowerCase().startsWith('hdmi') ? 'hdmi' : 'other'
  })),
  livePreview: null,
  recordings: [],
  volume: status.volume,
  muted: status.mute,
  lastSignal: status.lastSeen,
  cecDevices: [
    {
      id: status.id,
      name: status.displayName,
      power: status.power,
      input: status.input
    }
  ]
});

export const getVideoOverview = async (options: { fetch?: typeof fetch } = {}): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.video();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return await rawRequest<VideoState>('/video/overview', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /video/overview endpoint', error);
    try {
      const status = await rawRequest<LegacyTvStatus>('/video', {
        method: 'GET',
        fetch: fetchImpl as RequestOptions['fetch']
      });
      return mapFallbackState(status);
    } catch (fallbackError) {
      console.warn('Legacy /video endpoint unavailable', fallbackError);
      return {
        power: 'off',
        input: 'HDMI1',
        availableInputs: [],
        livePreview: null,
        recordings: [],
        volume: 50,
        muted: false,
        lastSignal: new Date().toISOString(),
        cecDevices: []
      } satisfies VideoState;
    }
  }
};

export const setVideoPower = async (
  power: PowerState,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetPower(power);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/video/power', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ on: power === 'on' }),
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return getVideoOverview(options);
};

export const setVideoInput = async (
  inputId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetInput(inputId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/video/input', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ input: inputId }),
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return getVideoOverview(options);
};

export const setVideoVolume = async (
  volume: number,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  const safeVolume = Math.max(0, Math.min(100, Math.round(volume)));
  if (USE_MOCKS) {
    return mockApi.videoSetVolume(safeVolume);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/video/volume', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ level: safeVolume }),
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return getVideoOverview(options);
};

export const setVideoMute = async (
  muted: boolean,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetMute(muted);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/video/mute', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ mute: muted }),
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return getVideoOverview(options);
};

export const fetchRecordingTimeline = async (
  options: { fetch?: typeof fetch } = {}
): Promise<VideoRecordingSegment[]> => {
  if (USE_MOCKS) {
    return mockApi.video().recordings;
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return await rawRequest<VideoRecordingSegment[]>('/video/recordings', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /video/recordings backend endpoint', error);
    const fallback = await getVideoOverview(options);
    return fallback.recordings;
  }
};

export const generateLivePreviewUrl = async (): Promise<string> => {
  if (USE_MOCKS) {
    const live = mockApi.video().livePreview;
    if (!live) throw new UiApiError('No live stream available', 404);
    return live.streamUrl;
  }

  const response = await fetch(`${API_BASE_URL}/video/preview`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ deviceId: 'tv-main-hall' })
  });

  if (!response.ok) {
    throw new UiApiError('Failed to generate live preview', response.status, await response.text());
  }

  const body = (await response.json()) as { streamUrl: string };
  return body.streamUrl;
};
