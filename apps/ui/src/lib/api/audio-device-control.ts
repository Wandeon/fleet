import { API_BASE_URL, UiApiError } from './client';
import type { AudioDeviceSnapshot } from '$lib/types';

export interface AudioDeviceListResponse {
  devices: AudioDeviceSnapshot[];
  total: number;
}

export interface DeviceConfigPayload {
  stream_url?: string;
  volume?: number;
  mode?: 'auto' | 'manual';
  source?: 'stream' | 'file' | 'stop';
}

export interface DevicePlayPayload {
  source: 'stream' | 'file';
}

export interface DeviceVolumePayload {
  volume: number; // 0.0 - 2.0
}

/**
 * Fetch list of all audio devices
 */
export async function fetchAudioDevices(
  options: { fetch?: typeof fetch } = {}
): Promise<AudioDeviceSnapshot[]> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to fetch audio devices: ${response.statusText}`,
      response.status,
      await response.text()
    );
  }

  const data: AudioDeviceListResponse = await response.json();
  return data.devices;
}

/**
 * Fetch single device status/snapshot
 */
export async function fetchDeviceStatus(
  deviceId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<AudioDeviceSnapshot> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to fetch device status: ${response.statusText}`,
      response.status,
      await response.text()
    );
  }

  return response.json();
}

/**
 * Play stream or file on device (direct device control)
 */
export async function playDeviceSource(
  deviceId: string,
  source: 'stream' | 'file',
  options: { fetch?: typeof fetch } = {}
): Promise<DeviceConfigPayload> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source } satisfies DevicePlayPayload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UiApiError(
      response.status === 502 || response.status === 504
        ? 'Device offline or unreachable'
        : `Failed to play source: ${response.statusText}`,
      response.status,
      detail
    );
  }

  return response.json();
}

/**
 * Stop device playback
 */
export async function stopDevice(
  deviceId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UiApiError(
      response.status === 502 || response.status === 504
        ? 'Device offline or unreachable'
        : `Failed to stop device: ${response.statusText}`,
      response.status,
      detail
    );
  }
}

/**
 * Set device volume (0.0 - 2.0)
 */
export async function setDeviceVolume(
  deviceId: string,
  volume: number,
  options: { fetch?: typeof fetch } = {}
): Promise<void> {
  const fetcher = options.fetch ?? fetch;
  const normalizedVolume = Math.max(0, Math.min(2, volume));

  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/volume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volumePercent: Math.round(normalizedVolume * 50) }), // Convert 0-2 to 0-100%
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UiApiError(
      response.status === 502 || response.status === 504
        ? 'Device offline or unreachable'
        : `Failed to set volume: ${response.statusText}`,
      response.status,
      detail
    );
  }
}

/**
 * Get device configuration
 */
export async function getDeviceConfig(
  deviceId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<DeviceConfigPayload> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new UiApiError(
      `Failed to fetch device config: ${response.statusText}`,
      response.status,
      await response.text()
    );
  }

  return response.json();
}

/**
 * Update device configuration
 */
export async function updateDeviceConfig(
  deviceId: string,
  config: DeviceConfigPayload,
  options: { fetch?: typeof fetch } = {}
): Promise<DeviceConfigPayload> {
  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UiApiError(
      `Failed to update device config: ${response.statusText}`,
      response.status,
      detail
    );
  }

  return response.json();
}

/**
 * Upload fallback audio file to device
 */
export async function uploadDeviceFallback(
  deviceId: string,
  file: File | Blob,
  options: { fetch?: typeof fetch } = {}
): Promise<{ saved: boolean; path: string; fallbackExists: boolean }> {
  // Validate file size (50 MB limit)
  if (file.size > 50 * 1024 * 1024) {
    throw new UiApiError(
      'File too large. Maximum size is 50 MB.',
      400,
      { code: 'file_too_large', maxSize: 50 * 1024 * 1024, actualSize: file.size }
    );
  }

  const fetcher = options.fetch ?? fetch;
  const formData = new FormData();
  const filename = file instanceof File ? file.name : 'fallback.mp3';
  formData.append('file', file, filename);

  const response = await fetcher(`${API_BASE_URL}/audio/devices/${deviceId}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new UiApiError('Device offline. Check power or network and retry.', response.status, detail);
    }

    if (response.status === 400 && typeof detail === 'object' && detail?.code === 'file_too_large') {
      throw new UiApiError('File too large. Maximum size is 50 MB.', 400, detail);
    }

    throw new UiApiError(`Upload failed: ${response.statusText}`, response.status, detail);
  }

  return response.json();
}
