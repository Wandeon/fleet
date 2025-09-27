import { API_BASE_URL, rawRequest, USE_MOCKS, UiApiError, VideoApi } from '$lib/api/client';
import { VideoService } from '$lib/api/gen';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { PowerState, VideoRecordingSegment, VideoState } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

// Primary video device ID from inventory
const PRIMARY_VIDEO_DEVICE_ID = 'pi-video-01';

const mapFallbackState = (status: Awaited<ReturnType<typeof VideoApi.getTv>>): VideoState => ({
  power: status.power,
  input: status.input,
  availableInputs: (status.availableInputs ?? []).map((input) => ({
    id: input,
    label: input,
    kind: input.toLowerCase().startsWith('hdmi') ? 'hdmi' : 'other',
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
      input: status.input,
    },
  ],
});

export const getVideoOverview = async (
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.video();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return await rawRequest<VideoState>('/video/overview', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /video/overview endpoint', error);
    const status = await VideoApi.getTv();
    return mapFallbackState(status);
  }
};

export const setVideoPower = async (
  power: PowerState,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetPower(power);
  }

  // Map generic PowerState to video-specific VideoPowerState
  const videoPower = power === 'off' ? 'standby' : power;
  await VideoService.setVideoPower(PRIMARY_VIDEO_DEVICE_ID, { power: videoPower });
  return getVideoOverview(options);
};

export const setVideoInput = async (
  inputId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetInput(inputId);
  }

  await VideoService.setVideoInput(PRIMARY_VIDEO_DEVICE_ID, { input: inputId });
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

  await VideoApi.setVolume({ level: safeVolume });
  return getVideoOverview(options);
};

export const setVideoMute = async (
  muted: boolean,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetMute(muted);
  }

  await VideoService.setVideoMute(PRIMARY_VIDEO_DEVICE_ID, { mute: muted });
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
      fetch: fetchImpl as RequestOptions['fetch'],
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
    body: JSON.stringify({ deviceId: 'tv-main-hall' }),
  });

  if (!response.ok) {
    throw new UiApiError('Failed to generate live preview', response.status, await response.text());
  }

  const body = (await response.json()) as { streamUrl: string };
  return body.streamUrl;
};
