import { API_BASE_URL, UiApiError } from './client';

export interface IcecastMount {
  mount: string;
  listeners: number;
  streamStart: string;
  bitrate: number;
  serverName: string;
}

export interface IcecastStatus {
  online: boolean;
  serverStart: string | null;
  location: string | null;
  mounts: IcecastMount[];
  totalListeners: number;
}

export interface LiquidsoapStatus {
  online: boolean;
  libraryFiles: number;
  librarySize: number;
  playing: boolean;
  currentTrack: string | null;
}

export interface SnapcastStatus {
  online: boolean;
  connectedClients: number;
  totalClients: number;
  listeningClients: number;
  streamStatus: 'idle' | 'playing' | 'unknown';
}

export interface StreamingSystemStatus {
  icecast: IcecastStatus;
  liquidsoap: LiquidsoapStatus;
  snapcast: SnapcastStatus;
  streamUrl: string;
}

export interface MusicLibraryFile {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
}

export interface MusicLibraryResponse {
  files: MusicLibraryFile[];
  total: number;
}

/**
 * Get streaming system status (Ice cast + Liquidsoap)
 */
export async function getStreamingStatus(
  options: { fetch?: typeof fetch } = {}
): Promise<StreamingSystemStatus> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to fetch streaming status: ${response.statusText}`,
      response.status,
      await response.text()
    );
  }

  return response.json();
}

/**
 * List files in Liquidsoap music library
 */
export async function getMusicLibrary(
  options: { fetch?: typeof fetch } = {}
): Promise<MusicLibraryFile[]> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/library`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to fetch music library: ${response.statusText}`,
      response.status,
      await response.text()
    );
  }

  const data: MusicLibraryResponse = await response.json();
  return data.files;
}

/**
 * Upload a music file to Liquidsoap library
 */
export async function uploadMusicFile(
  file: File,
  options: { fetch?: typeof fetch } = {}
): Promise<MusicLibraryFile> {
  const fetcher = options.fetch ?? fetch;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetcher(`${API_BASE_URL}/audio/stream/library`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new UiApiError(error.message ?? 'Upload failed', response.status);
  }

  return response.json();
}

/**
 * Delete a music file from Liquidsoap library
 */
export async function deleteMusicFile(
  filename: string,
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/library/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to delete music file: ${response.statusText}`,
      response.status
    );
  }
}

/**
 * Start Liquidsoap playback
 */
export async function playLiquidsoap(
  filename?: string,
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: filename ? JSON.stringify({ filename }) : undefined,
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to start playback: ${response.statusText}`,
      response.status
    );
  }
}

/**
 * Stop Liquidsoap playback
 */
export async function stopLiquidsoap(
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to stop playback: ${response.statusText}`,
      response.status
    );
  }
}

/**
 * Skip to next track in Liquidsoap
 */
export async function skipLiquidsoapTrack(
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to skip track: ${response.statusText}`,
      response.status
    );
  }
}

/**
 * Start Snapcast server
 */
export async function startSnapcastServer(
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/snapcast/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to start Snapcast server: ${response.statusText}`,
      response.status
    );
  }
}

/**
 * Stop Snapcast server
 */
export async function stopSnapcastServer(
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/stream/snapcast/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to stop Snapcast server: ${response.statusText}`,
      response.status
    );
  }
}
