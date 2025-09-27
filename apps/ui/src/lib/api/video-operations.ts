import { API_BASE_URL, USE_MOCKS, UiApiError } from '$lib/api/client';
import { VideoService } from '$lib/api/gen';
import { mockApi } from '$lib/api/mock';
import type { PowerState, VideoRecordingSegment, VideoState } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

// Primary video device ID from inventory
const PRIMARY_VIDEO_DEVICE_ID = 'pi-video-01';

const toPowerState = (power: 'on' | 'standby'): PowerState => (power === 'on' ? 'on' : 'off');

const toVideoPowerState = (power: PowerState): 'on' | 'standby' => (power === 'off' ? 'standby' : 'on');

const toInputOption = (inputId: string) => {
  const normalized = inputId.toUpperCase();
  const lower = inputId.toLowerCase();
  let kind: 'hdmi' | 'cast' | 'app' | 'other' = 'other';
  if (lower.startsWith('hdmi')) {
    kind = 'hdmi';
  } else if (lower.includes('cast')) {
    kind = 'cast';
  }
  return { id: normalized, label: normalized, kind };
};

const mapDeviceStateToVideo = (device: {
  id: string;
  name: string;
  power: 'on' | 'standby';
  mute: boolean;
  input: string;
  volumePercent?: number;
  availableInputs?: string[];
  lastUpdated: string;
}): VideoState => ({
  power: toPowerState(device.power),
  input: device.input.toUpperCase(),
  availableInputs: (device.availableInputs ?? []).map(toInputOption),
  livePreview: null,
  recordings: [],
  volume: device.volumePercent ?? 0,
  muted: device.mute,
  lastSignal: device.lastUpdated,
  cecDevices: [
    {
      id: device.id,
      name: device.name,
      power: toPowerState(device.power),
      input: device.input.toUpperCase(),
    },
  ],
});

export const getVideoOverview = async (
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.video();
  }

  const devices = await VideoService.listVideoDevices();
  if (!devices.devices.length) {
    throw new UiApiError('No video devices registered', 404);
  }

  const primary =
    devices.devices.find((device) => device.id === PRIMARY_VIDEO_DEVICE_ID) ?? devices.devices[0];

  return mapDeviceStateToVideo(primary);
};

export const setVideoPower = async (
  power: PowerState,
  options: { fetch?: typeof fetch } = {}
): Promise<VideoState> => {
  if (USE_MOCKS) {
    return mockApi.videoSetPower(power);
  }

  await VideoService.setVideoPower(PRIMARY_VIDEO_DEVICE_ID, { power: toVideoPowerState(power) });
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

  await VideoService.setVideoVolume(PRIMARY_VIDEO_DEVICE_ID, { volumePercent: safeVolume });
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

  const response = await fetchImpl(`${API_BASE_URL}/video/recordings`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError('Failed to load recording timeline', response.status, await response.text());
  }

  const { items } = (await response.json()) as { items: VideoRecordingSegment[] };
  return items;
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
