import type { Device } from './devices';
import { httpRequest, httpRequestJson } from './http';

export type AudioSource = 'stream' | 'file' | 'stop';
export type AudioMode = 'auto' | 'manual';

export interface AudioConfigPayload {
  stream_url?: string;
  volume?: number;
  mode?: AudioMode;
  source?: AudioSource;
}

export interface AudioStatus {
  stream_url: string;
  volume: number;
  mode: AudioMode;
  source: AudioSource;
  fallback_exists: boolean;
}

export interface UploadResult {
  saved: boolean;
  path: string;
}

export async function fetchStatus(device: Device, correlationId?: string): Promise<AudioStatus> {
  return httpRequestJson<AudioStatus>(device, '/status', {
    method: 'GET',
    correlationId
  });
}

export async function fetchConfig(device: Device, correlationId?: string): Promise<AudioConfigPayload> {
  return httpRequestJson<AudioConfigPayload>(device, '/config', {
    method: 'GET',
    correlationId
  });
}

export async function updateConfig(
  device: Device,
  payload: AudioConfigPayload,
  correlationId?: string
): Promise<AudioConfigPayload> {
  return httpRequestJson<AudioConfigPayload>(device, '/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
    correlationId
  });
}

export async function setVolume(
  device: Device,
  volume: number,
  correlationId?: string
): Promise<AudioConfigPayload> {
  return httpRequestJson<AudioConfigPayload>(device, '/volume', {
    method: 'POST',
    body: JSON.stringify({ volume }),
    correlationId
  });
}

export async function play(
  device: Device,
  payload: { source: AudioSource; mode?: AudioMode; stream_url?: string },
  correlationId?: string
): Promise<AudioConfigPayload> {
  return httpRequestJson<AudioConfigPayload>(device, '/play', {
    method: 'POST',
    body: JSON.stringify(payload),
    correlationId
  });
}

export async function stop(device: Device, correlationId?: string): Promise<AudioConfigPayload> {
  return httpRequestJson<AudioConfigPayload>(device, '/stop', {
    method: 'POST',
    correlationId
  });
}

export interface UploadFileOptions {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}

export async function uploadFallback(
  device: Device,
  file: UploadFileOptions,
  correlationId?: string
): Promise<UploadResult> {
  const form = new FormData();
  const blobSource = Uint8Array.from(file.buffer);
  const blob = new Blob([blobSource], { type: file.mimetype ?? 'application/octet-stream' });
  form.append('file', blob, file.filename);

  return httpRequestJson<UploadResult>(device, '/upload', {
    method: 'POST',
    body: form,
    correlationId
  });
}

export async function triggerHealth(device: Device, correlationId?: string): Promise<string> {
  const response = await httpRequest(device, '/healthz', {
    method: 'GET',
    correlationId
  });

  return response.text();
}
