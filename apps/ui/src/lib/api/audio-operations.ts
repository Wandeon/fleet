import { browser } from '$app/environment';
import {
  ApiError,
  AudioApi,
  USE_MOCKS,
  UiApiError,
  type AudioDeviceSnapshot as ApiAudioDeviceSnapshot,
  type AudioLibraryTrack as ApiAudioLibraryTrack,
  type AudioPlaylist as ApiAudioPlaylist,
  type AudioPlaylistTrack as ApiAudioPlaylistTrack,
  type AudioState as ApiAudioState,
} from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type {
  AudioDeviceSnapshot,
  AudioLibraryTrack,
  AudioPlaylist,
  AudioPlaylistTrack,
  AudioState,
  AudioSyncMode,
} from '$lib/types';

export interface UploadTrackOptions {
  file: File | Blob;
  title: string;
  artist?: string;
  tags?: string[];
  durationSeconds?: number;
}

export interface PlaylistDraft {
  name: string;
  description?: string | null;
  loop: boolean;
  syncMode: AudioSyncMode;
  tracks: AudioPlaylistTrack[];
}

export interface PlayAssignments {
  deviceId: string;
  trackId: string;
  startOffsetSeconds?: number;
}

export interface PlayDevicesOptions {
  deviceIds: string[];
  playlistId?: string | null;
  trackId?: string | null;
  assignments?: PlayAssignments[];
  syncMode: AudioSyncMode;
  resume?: boolean;
  startAtSeconds?: number;
  loop?: boolean;
}

const withScopedFetch = async <T>(fetchImpl: typeof fetch | undefined, callback: () => Promise<T>): Promise<T> => {
  if (!fetchImpl || fetchImpl === globalThis.fetch) {
    return callback();
  }

  const originalFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchImpl;
  try {
    return await callback();
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  }
};

const extractErrorMessage = (detail: unknown): string | undefined => {
  if (!detail) return undefined;
  if (typeof detail === 'string') {
    return detail.trim() || undefined;
  }
  if (typeof detail === 'object') {
    const payload = detail as { message?: unknown; error?: unknown; detail?: unknown };
    return (
      (typeof payload.message === 'string' && payload.message.trim()) ||
      (typeof payload.error === 'string' && payload.error.trim()) ||
      (typeof payload.detail === 'string' && payload.detail.trim()) ||
      undefined
    );
  }
  return undefined;
};

const normaliseApiError = (error: unknown, fallbackMessage: string): UiApiError => {
  if (error instanceof UiApiError) {
    return error;
  }
  if (error instanceof ApiError) {
    const message = extractErrorMessage(error.body) ?? fallbackMessage;
    return new UiApiError(message, error.status ?? 500, error.body);
  }
  if (error instanceof Error) {
    return new UiApiError(error.message || fallbackMessage, 500, error);
  }
  return new UiApiError(fallbackMessage, 500, error);
};

const callAudioApi = async <T>(
  options: { fetch?: typeof fetch },
  fallbackMessage: string,
  action: () => Promise<T>,
): Promise<T> => {
  return withScopedFetch(options.fetch, async () => {
    try {
      return await action();
    } catch (error) {
      throw normaliseApiError(error, fallbackMessage);
    }
  });
};

const normalisePlayback = (
  playback: ApiAudioDeviceSnapshot['playback'],
): AudioDeviceSnapshot['playback'] => ({
  state: playback.state,
  trackId: playback.trackId ?? null,
  trackTitle: playback.trackTitle ?? null,
  playlistId: playback.playlistId ?? null,
  positionSeconds: playback.positionSeconds ?? 0,
  durationSeconds: playback.durationSeconds ?? 0,
  startedAt: playback.startedAt ?? null,
  syncGroup: playback.syncGroup ?? null,
  lastError: playback.lastError ?? null,
});

const normaliseDevice = (device: ApiAudioDeviceSnapshot): AudioDeviceSnapshot => ({
  id: device.id,
  name: device.name,
  status: device.status,
  group: device.group ?? null,
  volumePercent: device.volumePercent,
  capabilities: device.capabilities ?? [],
  playback: normalisePlayback(device.playback),
  lastUpdated: device.lastUpdated,
});

const normaliseTrack = (track: ApiAudioLibraryTrack): AudioLibraryTrack => ({
  id: track.id,
  title: track.title,
  artist: track.artist ?? null,
  durationSeconds: track.durationSeconds,
  format: track.format,
  sizeBytes: track.sizeBytes ?? undefined,
  tags: track.tags ?? [],
  uploadedAt: track.uploadedAt,
});

const normalisePlaylistTrack = (
  track: ApiAudioPlaylistTrack,
): AudioPlaylistTrack => ({
  trackId: track.trackId,
  order: track.order,
  startOffsetSeconds: track.startOffsetSeconds ?? undefined,
  deviceOverrides: track.deviceOverrides ?? undefined,
});

const normalisePlaylist = (playlist: ApiAudioPlaylist): AudioPlaylist => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description ?? null,
  loop: playlist.loop,
  syncMode: playlist.syncMode,
  createdAt: playlist.createdAt,
  updatedAt: playlist.updatedAt,
  tracks: (playlist.tracks ?? []).map(normalisePlaylistTrack),
});

const normaliseState = (state: ApiAudioState): AudioState => ({
  masterVolume: state.masterVolume,
  devices: (state.devices ?? []).map(normaliseDevice),
  library: (state.library ?? []).map(normaliseTrack),
  playlists: (state.playlists ?? []).map(normalisePlaylist),
  sessions: (state.sessions ?? []).map((session) => ({
    ...session,
    playlistId: session.playlistId ?? null,
  })),
  message: state.message ?? undefined,
});

const toApiPlaylistTrack = (track: AudioPlaylistTrack): ApiAudioPlaylistTrack => ({
  trackId: track.trackId,
  order: track.order,
  startOffsetSeconds: track.startOffsetSeconds ?? null,
  deviceOverrides: track.deviceOverrides ?? null,
});

const toApiPlaylist = (
  draft: PlaylistDraft,
  overrides: Partial<ApiAudioPlaylist> = {},
): ApiAudioPlaylist => ({
  id: overrides.id ?? 'temp',
  name: draft.name,
  description: draft.description ?? null,
  loop: draft.loop,
  syncMode: draft.syncMode,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  tracks: draft.tracks.map(toApiPlaylistTrack),
});

const refreshDevice = async (
  deviceId: string,
  options: { fetch?: typeof fetch },
): Promise<AudioDeviceSnapshot> => {
  const snapshot = await callAudioApi(
    options,
    'Failed to load device snapshot',
    () => AudioApi.getDevice(deviceId),
  );
  return normaliseDevice(snapshot);
};

export const getAudioOverview = async (options: { fetch?: typeof fetch } = {}): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audio();
  }

  const state = await callAudioApi(options, 'Failed to load audio overview', () => AudioApi.getOverview());
  return normaliseState(state);
};

export const uploadTrack = async (options: UploadTrackOptions): Promise<AudioLibraryTrack> => {
  if (USE_MOCKS) {
    const isFile = typeof File !== 'undefined' && options.file instanceof File;
    const sourceFile = isFile ? (options.file as File) : undefined;
    const metadata = {
      title: options.title,
      artist: options.artist ?? null,
      tags: options.tags ?? [],
      fileName: sourceFile?.name ?? `upload-${Date.now()}`,
      fileSizeBytes: options.file.size ?? 4_194_304,
      mimeType: options.file.type || sourceFile?.type || 'audio/mpeg',
      durationSeconds: options.durationSeconds,
    };
    return mockApi.audioUpload(metadata);
  }

  if (!browser) {
    throw new UiApiError('Audio uploads must be initiated from the browser runtime', 400);
  }

  const track = await callAudioApi(
    {},
    'Failed to upload track',
    () =>
      AudioApi.uploadAudioTrack({
        file: options.file,
        title: options.title,
        artist: options.artist,
        tags: options.tags?.join(',') ?? undefined,
        durationSeconds: options.durationSeconds,
      }),
  );

  return normaliseTrack(track);
};

export const createPlaylist = async (
  draft: PlaylistDraft,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioPlaylist> => {
  if (USE_MOCKS) {
    return mockApi.audioCreatePlaylist(draft);
  }

  const playlist = await callAudioApi(options, 'Failed to create playlist', () => AudioApi.createPlaylist(toApiPlaylist(draft)));
  return normalisePlaylist(playlist);
};

export const updatePlaylist = async (
  playlistId: string,
  draft: PlaylistDraft,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioPlaylist> => {
  if (USE_MOCKS) {
    return mockApi.audioUpdatePlaylist(playlistId, draft);
  }

  const payload = toApiPlaylist(draft, { id: playlistId });
  const playlist = await callAudioApi(options, 'Failed to update playlist', () => AudioApi.updatePlaylist(playlistId, payload));
  return normalisePlaylist(playlist);
};

export const deletePlaylist = async (
  playlistId: string,
  options: { fetch?: typeof fetch } = {},
): Promise<void> => {
  if (USE_MOCKS) {
    mockApi.audioDeletePlaylist(playlistId);
    return;
  }

  await callAudioApi(options, 'Failed to delete playlist', () => AudioApi.deletePlaylist(playlistId));
};

export const playOnDevices = async (
  payload: PlayDevicesOptions,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audioPlay(payload);
  }

  await callAudioApi(options, 'Failed to start playback', () =>
    AudioApi.startPlayback({
      deviceIds: payload.deviceIds,
      playlistId: payload.playlistId ?? null,
      trackId: payload.trackId ?? null,
      assignments: payload.assignments
        ?.filter((assignment) => Boolean(assignment.trackId))
        .map((assignment) => ({
          deviceId: assignment.deviceId,
          trackId: assignment.trackId,
          startOffsetSeconds: assignment.startOffsetSeconds ?? null,
        })),
      syncMode: payload.syncMode,
      resume: payload.resume ?? false,
      startAtSeconds: payload.startAtSeconds,
      loop: payload.loop ?? false,
    }),
  );

  return getAudioOverview(options);
};

export const pauseDevice = async (
  deviceId: string,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioPause(deviceId);
  }

  await callAudioApi(options, 'Unable to pause device', () => AudioApi.pauseDevice(deviceId));
  return refreshDevice(deviceId, options);
};

export const resumeDevice = async (
  deviceId: string,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioResume(deviceId);
  }

  await callAudioApi(options, 'Unable to resume device', () => AudioApi.resumeDevice(deviceId));
  return refreshDevice(deviceId, options);
};

export const stopDevice = async (
  deviceId: string,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioStop(deviceId);
  }

  await callAudioApi(options, 'Unable to stop device', () => AudioApi.stopDevice(deviceId));
  return refreshDevice(deviceId, options);
};

export const seekDevice = async (
  deviceId: string,
  positionSeconds: number,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioSeek(deviceId, positionSeconds);
  }

  try {
    await callAudioApi(options, 'Unable to seek device', () =>
      AudioApi.seekDevice(deviceId, {
        positionSeconds,
      }),
    );
  } catch (error) {
    if (error instanceof UiApiError && [400, 409, 422].includes(error.status)) {
      throw new UiApiError('Seek request rejected by device. Check target position and retry.', error.status, error.detail);
    }
    throw error;
  }

  return refreshDevice(deviceId, options);
};

export const setDeviceVolume = async (
  deviceId: string,
  volumePercent: number,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioSetVolume(deviceId, volumePercent);
  }

  const normalised = Math.max(0, Math.min(2, volumePercent / 100));
  await callAudioApi(options, 'Unable to update volume', () =>
    AudioApi.setDeviceVolume(deviceId, {
      volume: Number.isFinite(normalised) ? normalised : 0,
    }),
  );

  return refreshDevice(deviceId, options);
};

export const setMasterVolume = async (
  masterPercent: number,
  options: { fetch?: typeof fetch } = {},
): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audioSetMasterVolume(masterPercent);
  }

  await callAudioApi(options, 'Unable to update master volume', () =>
    AudioApi.setMasterVolume({
      volumePercent: Math.round(masterPercent),
    }),
  );

  return getAudioOverview(options);
};
