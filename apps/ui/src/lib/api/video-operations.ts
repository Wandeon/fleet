import { USE_MOCKS, UiApiError } from '$lib/api/client';
import { VideoService } from '$lib/api/gen';
import { mockApi } from '$lib/api/mock';
import type { PowerState, VideoState } from '$lib/types';
import type { VideoRecordingSegment as ApiVideoRecordingSegment } from '$lib/api/gen';

// Primary video device ID from inventory
const PRIMARY_VIDEO_DEVICE_ID = 'pi-video-01';

const toPowerState = (power: 'on' | 'standby'): PowerState => (power === 'on' ? 'on' : 'off');

// Convert PowerState to VideoPowerState for API compatibility
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { fetch?: typeof fetch } = {}
): Promise<{ state: VideoState; jobId: string }> => {
  if (USE_MOCKS) {
    return { state: mockApi.videoSetPower(power), jobId: 'mock-job-123' };
  }

  const response = await fetch('/api/video/tv/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: power === 'on' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Power control failed' }));
    const apiError = new UiApiError(error.error || 'Power control failed', response.status);
    throw apiError;
  }

  const data = await response.json();
  const state = await getVideoOverview(options);
  return { state, jobId: data.correlationId };
};

export const setVideoInput = async (
  inputId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { fetch?: typeof fetch } = {}
): Promise<{ state: VideoState; jobId: string }> => {
  if (USE_MOCKS) {
    return { state: mockApi.videoSetInput(inputId), jobId: 'mock-job-124' };
  }

  const response = await fetch('/api/video/tv/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: inputId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Input control failed' }));
    const apiError = new UiApiError(error.error || 'Input control failed', response.status);
    throw apiError;
  }

  const data = await response.json();
  const state = await getVideoOverview(options);
  return { state, jobId: data.correlationId };
};

export const setVideoVolume = async (
  volume: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { fetch?: typeof fetch } = {}
): Promise<{ state: VideoState; jobId: string }> => {
  const safeVolume = Math.max(0, Math.min(100, Math.round(volume)));
  if (USE_MOCKS) {
    return { state: mockApi.videoSetVolume(safeVolume), jobId: 'mock-job-125' };
  }

  const response = await fetch('/api/video/tv/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volume: safeVolume }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Volume control failed' }));
    const apiError = new UiApiError(error.error || 'Volume control failed', response.status);
    throw apiError;
  }

  const data = await response.json();
  const state = await getVideoOverview(options);
  return { state, jobId: data.correlationId };
};

export const setVideoMute = async (
  muted: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { fetch?: typeof fetch } = {}
): Promise<{ state: VideoState; jobId: string }> => {
  if (USE_MOCKS) {
    return { state: mockApi.videoSetMute(muted), jobId: 'mock-job-126' };
  }

  const response = await fetch('/api/video/tv/mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mute: muted }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Mute control failed' }));
    const apiError = new UiApiError(error.error || 'Mute control failed', response.status);
    throw apiError;
  }

  const data = await response.json();
  const state = await getVideoOverview(options);
  return { state, jobId: data.correlationId };
};

const mapRecordingSegment = (segment: ApiVideoRecordingSegment): import('$lib/types').VideoRecordingSegment => ({
  id: segment.id,
  start: segment.startedAt,
  end: segment.endedAt,
  label: segment.id,
  url: `/api/video/recordings/${segment.id}/stream`,
});

export const fetchRecordingTimeline = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { fetch?: typeof fetch } = {}
): Promise<import('$lib/types').VideoRecordingSegment[]> => {
  if (USE_MOCKS) {
    return mockApi.video().recordings;
  }

  const response = await VideoService.getVideoRecordings();
  return response.items.map(mapRecordingSegment);
};

export const generateLivePreviewUrl = async (): Promise<string> => {
  if (USE_MOCKS) {
    const live = mockApi.video().livePreview;
    if (!live) throw new UiApiError('No live stream available', 404);
    return live.streamUrl;
  }

  const response = await VideoService.generateVideoPreview({
    deviceId: PRIMARY_VIDEO_DEVICE_ID
  });

  return response.streamUrl;
};

export interface VideoLibraryItem {
  filename: string;
  path: string;
  size: number;
}

export const fetchVideoLibrary = async (): Promise<VideoLibraryItem[]> => {
  if (USE_MOCKS) {
    return [];
  }

  const response = await fetch(`/ui/video/devices/${PRIMARY_VIDEO_DEVICE_ID}/library`);
  if (!response.ok) {
    throw new UiApiError(`Failed to fetch video library: ${response.statusText}`, response.status);
  }

  const data = await response.json();
  return data.videos ?? [];
};

export const uploadVideo = async (file: File): Promise<void> => {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/ui/video/devices/${PRIMARY_VIDEO_DEVICE_ID}/library/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new UiApiError(error.message ?? 'Upload failed', response.status);
  }
};

export const deleteVideo = async (filename: string): Promise<void> => {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  const response = await fetch(`/ui/video/devices/${PRIMARY_VIDEO_DEVICE_ID}/library/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new UiApiError(`Failed to delete video: ${response.statusText}`, response.status);
  }
};
