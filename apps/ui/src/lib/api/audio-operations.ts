import { browser } from '$app/environment';
import {
  AudioApi,
  API_BASE_URL,
  rawRequest,
  USE_MOCKS,
  UiApiError
} from './client';
import type { RequestOptions } from './client';
import { mockApi } from './mock';
import type {
  AudioDeviceSnapshot as ApiAudioDeviceSnapshot,
  AudioLibraryTrack as ApiAudioLibraryTrack,
  AudioPlaylist as ApiAudioPlaylist,
  AudioSession as ApiAudioSession,
  AudioState as ApiAudioState
} from './gen';
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

const mapTrackFromApi = (track: ApiAudioLibraryTrack): AudioLibraryTrack => ({
  id: track.id,
  title: track.title,
  artist: track.artist ?? null,
  durationSeconds: track.durationSeconds,
  format: track.format,
  sizeBytes: track.sizeBytes ?? undefined,
  tags: track.tags ?? [],
  uploadedAt: track.uploadedAt
});

const mapPlaylistFromApi = (playlist: ApiAudioPlaylist): AudioPlaylist => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description ?? null,
  loop: playlist.loop,
  syncMode: playlist.syncMode,
  createdAt: playlist.createdAt,
  updatedAt: playlist.updatedAt,
  tracks: playlist.tracks.map((track) => ({
    trackId: track.trackId,
    order: track.order,
    startOffsetSeconds: track.startOffsetSeconds ?? undefined,
    deviceOverrides: track.deviceOverrides ?? undefined
  }))
});

const mapSessionFromApi = (session: ApiAudioSession): AudioState['sessions'][number] => ({
  id: session.id,
  playlistId: session.playlistId ?? null,
  deviceIds: session.deviceIds,
  syncMode: session.syncMode,
  state: session.state,
  startedAt: session.startedAt
});

const mapDeviceFromApi = (device: ApiAudioDeviceSnapshot): AudioDeviceSnapshot => ({
  id: device.id,
  name: device.name,
  status: device.status,
  group: device.group ?? null,
  volumePercent: Math.round(device.volumePercent ?? 0),
  capabilities: device.capabilities ?? [],
  playback: {
    state: device.playback.state,
    trackId: device.playback.trackId ?? null,
    trackTitle: device.playback.trackTitle ?? null,
    playlistId: device.playback.playlistId ?? null,
    positionSeconds: device.playback.positionSeconds ?? 0,
    durationSeconds: device.playback.durationSeconds ?? 0,
    startedAt: device.playback.startedAt ?? null,
    syncGroup: device.playback.syncGroup ?? null,
    lastError: device.playback.lastError ?? null
  },
  lastUpdated: device.lastUpdated
});

const mapAudioStateFromApi = (state: ApiAudioState): AudioState => ({
  masterVolume: state.masterVolume,
  devices: state.devices.map(mapDeviceFromApi),
  library: state.library.map(mapTrackFromApi),
  playlists: state.playlists.map(mapPlaylistFromApi),
  sessions: state.sessions.map(mapSessionFromApi),
  message: state.message ?? undefined
});

export const getAudioOverview = async (options: { fetch?: typeof fetch } = {}): Promise<AudioState> => {
  if (USE_MOCKS) {
    return mockApi.audio();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    const result = await rawRequest<ApiAudioState>('/audio/overview', {
      fetch: fetchImpl as RequestOptions['fetch']
    });
    if (result) {
      return mapAudioStateFromApi(result);
    }
  } catch (error) {
    console.warn('Falling back to AudioApi.getOverview()', error);
    try {
      const fallback = await AudioApi.getOverview();
      return mapAudioStateFromApi(fallback as ApiAudioState);
    } catch (fallbackError) {
      console.warn('Audio overview fallback failed', fallbackError);
    }
  }

  return {
    masterVolume: 100,
    devices: [],
    library: [],
    playlists: [],
    sessions: [],
    message: 'Audio overview unavailable'
  } satisfies AudioState;
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
      await AudioApi.play(deviceId, {
        playlistId: payload.playlistId ?? null,
        trackId: payload.trackId ?? null,
        resume: payload.resume ?? false,
        syncMode: payload.syncMode ?? 'independent'
      });
    }
  }

  return getAudioOverview({ fetch: fetchImpl });
};

export const pauseDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioPause(deviceId);
  }

  try {
    await rawRequest(`/audio/devices/${deviceId}/pause`, {
      method: 'POST',
      fetch: ensureFetch(options.fetch) as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/pause endpoint', error);
    await AudioApi.stop(deviceId);
  }

  return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
};

export const resumeDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioResume(deviceId);
  }

  try {
    await rawRequest(`/audio/devices/${deviceId}/resume`, {
      method: 'POST',
      fetch: ensureFetch(options.fetch) as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/resume endpoint', error);
    await AudioApi.play(deviceId, { resume: true, syncMode: 'independent' });
  }

  return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
};

export const stopDevice = async (deviceId: string, options: { fetch?: typeof fetch } = {}): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioStop(deviceId);
  }

  try {
    await rawRequest(`/audio/devices/${deviceId}/stop`, {
      method: 'POST',
      fetch: ensureFetch(options.fetch) as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/stop endpoint', error);
    await AudioApi.stop(deviceId);
  }

  return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
};

export const seekDevice = async (
  deviceId: string,
  positionSeconds: number,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioDeviceSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.audioSeek(deviceId, positionSeconds);
  }

  try {
    await rawRequest(`/audio/devices/${deviceId}/seek`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ positionSeconds }),
      fetch: ensureFetch(options.fetch) as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id}/seek endpoint', error);
  }

  return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
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
    await AudioApi.setVolume(deviceId, { volume: normalized });
    try {
      return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
    } catch (fallbackErr) {
      console.warn('Fallback getDevice failed after setVolume', fallbackErr);
      throw fallbackErr;
    }
  }

  // Read back latest status from control-plane; if that fails, fallback to legacy client.
  try {
    const latest = await rawRequest<ApiAudioDeviceSnapshot>(`/audio/devices/${deviceId}`, {
      fetch: fetchImpl as RequestOptions['fetch']
    });
    return mapDeviceFromApi(latest);
  } catch (error) {
    console.warn('TODO(backlog): implement /audio/devices/{id} endpoint', error);
    // Final fallback: legacy client read
    return mapDeviceFromApi(await AudioApi.getDevice(deviceId));
  }
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
