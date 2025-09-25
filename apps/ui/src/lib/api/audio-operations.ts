import { browser } from '$app/environment';
import {
  API_BASE_URL,
  rawRequest,
  USE_MOCKS,
  UiApiError
} from './client';
import type { RequestOptions } from './client';
import { mockApi } from './mock';
import type {
  AudioDeviceSnapshot,
  AudioLibraryTrack,
  AudioPlaylist,
  AudioPlaylistTrack,
  AudioState,
  AudioSyncMode
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

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const jsonHeaders = {
  'Content-Type': 'application/json'
};

interface LegacyAudioPlayback {
  state?: string;
  trackId?: string | null;
  trackTitle?: string | null;
  playlistId?: string | null;
  positionSeconds?: number;
  durationSeconds?: number;
  since?: string | null;
  syncGroup?: string | null;
  errorMessage?: string | null;
}

interface LegacyAudioDevice {
  id: string;
  displayName?: string;
  online?: boolean;
  playback?: LegacyAudioPlayback;
  volume?: { level?: number };
  capabilities?: string[];
  lastSeen?: string;
}

const mapLegacyDevice = (device: LegacyAudioDevice): AudioDeviceSnapshot => {
  const playback = device.playback ?? {};
  const online = device.online ?? false;
  return {
    id: device.id,
    name: device.displayName ?? device.id,
    status: online ? 'online' : 'offline',
    group: null,
    volumePercent: Math.round(((device.volume?.level ?? 1) as number) * 100),
    capabilities: device.capabilities ?? [],
    playback: {
      state:
        (playback.state as AudioDeviceSnapshot['playback']['state'])
        ?? (online ? 'idle' : 'error'),
      trackId: playback.trackId ?? null,
      trackTitle: playback.trackTitle ?? null,
      playlistId: playback.playlistId ?? null,
      positionSeconds: playback.positionSeconds ?? 0,
      durationSeconds: playback.durationSeconds ?? 0,
      startedAt: playback.since ?? null,
      syncGroup: playback.syncGroup ?? null,
      lastError: playback.errorMessage ?? null
    },
    lastUpdated: device.lastSeen ?? new Date().toISOString()
  } satisfies AudioDeviceSnapshot;
};

const legacyListDevices = async (
  fetchImpl: typeof fetch
): Promise<LegacyAudioDevice[]> => {
  const response = await rawRequest<{ items?: LegacyAudioDevice[] }>(
    '/audio/devices',
    { fetch: fetchImpl as RequestOptions['fetch'] }
  );
  return response?.items ?? [];
};

const legacyPlayDevice = async (
  deviceId: string,
  payload: { source: 'file' | 'stream'; resume?: boolean },
  fetchImpl: typeof fetch
) => {
  await rawRequest(`/audio/${deviceId}/play`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
    fetch: fetchImpl as RequestOptions['fetch']
  });
};

const legacyStopDevice = async (deviceId: string, fetchImpl: typeof fetch) => {
  await rawRequest(`/audio/${deviceId}/stop`, {
    method: 'POST',
    fetch: fetchImpl as RequestOptions['fetch']
  });
};

const legacySetDeviceVolume = async (
  deviceId: string,
  volume: number,
  fetchImpl: typeof fetch
) => {
  await rawRequest(`/audio/${deviceId}/volume`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ volume }),
    fetch: fetchImpl as RequestOptions['fetch']
  });
};

const readDeviceSnapshot = async (
  deviceId: string,
  fetchImpl: typeof fetch
): Promise<AudioDeviceSnapshot> => {
  try {
    const snapshot = await rawRequest<AudioDeviceSnapshot>(`/audio/devices/${deviceId}`, {
      fetch: fetchImpl as RequestOptions['fetch']
    });
    if (snapshot) {
      return snapshot;
    }
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id} endpoint', error);
  }

  const legacy = await rawRequest<LegacyAudioDevice>(`/audio/${deviceId}`, {
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return mapLegacyDevice(legacy);
};

export const getAudioOverview = async (options: { fetch?: typeof fetch } = {}): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audio();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return (await rawRequest<AudioState>('/audio/overview', { fetch: fetchImpl })) ?? {
      masterVolume: 100,
      devices: [],
      library: [],
      playlists: [],
      sessions: []
    };
  } catch (error) {
    console.warn('Falling back to legacy /audio/devices endpoint', error);
    const fallback = await legacyListDevices(fetchImpl);
    return {
      masterVolume: 100,
      devices: fallback.map(mapLegacyDevice),
      library: [],
      playlists: [],
      sessions: []
    } satisfies AudioState;
  }
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
      durationSeconds: options.durationSeconds
    };
    return mockApi.audioUpload(metadata);
  }

  if (!browser) {
    throw new UiApiError('Audio uploads must be initiated from the browser runtime', 400);
  }

  const formData = new FormData();
  formData.append('file', options.file);
  formData.append('title', options.title);
  if (options.artist) formData.append('artist', options.artist);
  if (options.tags?.length) formData.append('tags', options.tags.join(','));
  if (options.durationSeconds) formData.append('durationSeconds', String(options.durationSeconds));

  const response = await fetch(`${API_BASE_URL}/audio/library`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new UiApiError('Failed to upload track', response.status, await response.text());
  }

  return (await response.json()) as AudioLibraryTrack;
};

export const createPlaylist = async (draft: PlaylistDraft, options: { fetch?: typeof fetch } = {}): Promise<AudioPlaylist> => {
  if (USE_MOCKS) {
    return mockApi.audioCreatePlaylist(draft);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<AudioPlaylist>('/audio/playlists', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(draft),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/playlists backend endpoint', error);
    return {
      id: `pl-local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft
    } satisfies AudioPlaylist;
  }
};

export const updatePlaylist = async (
  playlistId: string,
  patch: Partial<PlaylistDraft>,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioPlaylist> => {
  if (USE_MOCKS) {
    return mockApi.audioUpdatePlaylist(playlistId, patch);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<AudioPlaylist>(`/audio/playlists/${playlistId}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/playlists/{id} backend endpoint', error);
    return {
      id: playlistId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: patch.name ?? 'Untitled Playlist',
      description: patch.description ?? null,
      loop: patch.loop ?? false,
      syncMode: patch.syncMode ?? 'independent',
      tracks: patch.tracks ?? []
    } satisfies AudioPlaylist;
  }
};

export const deletePlaylist = async (playlistId: string, options: { fetch?: typeof fetch } = {}): Promise<void> => {
  if (USE_MOCKS) {
    mockApi.audioDeletePlaylist(playlistId);
    return;
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/audio/playlists/${playlistId}`, {
      method: 'DELETE',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement playlist deletion endpoint', error);
  }
};

export const playOnDevices = async (payload: PlayDevicesOptions, options: { fetch?: typeof fetch } = {}): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audioPlay(payload);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const requestBody = {
    deviceIds: payload.deviceIds,
    playlistId: payload.playlistId ?? null,
    trackId: payload.trackId ?? null,
    assignments: payload.assignments ?? [],
    syncMode: payload.syncMode,
    resume: payload.resume ?? false,
    startAtSeconds: payload.startAtSeconds ?? 0,
    loop: payload.loop ?? false
  };

  try {
    await rawRequest('/audio/playback', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(requestBody),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/playback endpoint', error);
    for (const deviceId of payload.deviceIds) {
      await legacyPlayDevice(deviceId, { source: 'file', resume: payload.resume ?? false }, fetchImpl);
    }
  }

  return getAudioOverview({ fetch: fetchImpl });
};

export const pauseDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioPause(deviceId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/audio/devices/${deviceId}/pause`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/pause endpoint', error);
    await legacyStopDevice(deviceId, fetchImpl);
  }

  return readDeviceSnapshot(deviceId, fetchImpl);
};

export const resumeDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioResume(deviceId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/audio/devices/${deviceId}/resume`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/resume endpoint', error);
    await legacyPlayDevice(deviceId, { source: 'file', resume: true }, fetchImpl);
  }

  return readDeviceSnapshot(deviceId, fetchImpl);
};

export const stopDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioStop(deviceId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/audio/devices/${deviceId}/stop`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/stop endpoint', error);
    await legacyStopDevice(deviceId, fetchImpl);
  }

  return readDeviceSnapshot(deviceId, fetchImpl);
};

export const seekDevice = async (
  deviceId: string,
  positionSeconds: number,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioSeek(deviceId, positionSeconds);
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/audio/devices/${deviceId}/seek`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ positionSeconds }),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/seek endpoint', error);
  }

  return readDeviceSnapshot(deviceId, fetchImpl);
};

export const setDeviceVolume = async (
  deviceId: string,
  volumePercent: number,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioSetVolume(deviceId, volumePercent);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const normalized = Math.max(0, Math.min(2, volumePercent / 100));

  // Try the control-plane endpoint first (preferred, aligns with OpenAPI).
  try {
    await rawRequest(`/audio/devices/${deviceId}/volume`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ volume: normalized }),
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    // Fallback path for environments where /audio/devices/{id}/volume isn't live yet.
    console.warn('TODO(backlog): implement /audio/devices/{id}/volume endpoint', error);
    await legacySetDeviceVolume(deviceId, normalized, fetchImpl);
  }

  // Read back latest status from control-plane; if that fails, fallback to legacy client.
  return readDeviceSnapshot(deviceId, fetchImpl);
};

export const setMasterVolume = async (
  masterPercent: number,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audioSetMasterVolume(masterPercent);
  }

  try {
    await rawRequest('/audio/master-volume', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ volumePercent: masterPercent }),
      fetch: ensureFetch(options.fetch) as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/master-volume endpoint', error);
  }

  return getAudioOverview(options);
};
