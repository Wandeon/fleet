import { env } from '$env/dynamic/public';

const API_BASE = (env.PUBLIC_API_BASE || '/api').replace(/\/$/, '');
const API_BEARER = (env.PUBLIC_API_BEARER || '').trim();

function withLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${withLeadingSlash(path)}`;
}

export function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (API_BEARER) {
    headers.set('Authorization', `Bearer ${API_BEARER}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), { ...init, headers });
}

export function streamUrl() {
  const base = `${API_BASE}/stream`;
  if (!API_BEARER) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(API_BEARER)}`;
}

export function rememberSelected(ids: string[]) {
  localStorage.setItem('selectedDevices', JSON.stringify(ids));
}

export function loadSelected(): string[] {
  try {
    return JSON.parse(localStorage.getItem('selectedDevices') || '[]');
  } catch {
    return [];
  }
}

export function rememberTvSource(src: string) {
  localStorage.setItem('tvSource', src);
}

export function loadTvSource() {
  return localStorage.getItem('tvSource') || 'hdmi1';
}

// Fleet layout and state
export async function getFleetLayout() {
  const response = await apiFetch('/fleet/layout');
  if (!response.ok) {
    throw new Error(`Failed to fetch fleet layout: ${response.statusText}`);
  }
  return response.json();
}

export async function getFleetState() {
  const response = await apiFetch('/fleet/state');
  if (!response.ok) {
    throw new Error(`Failed to fetch fleet state: ${response.statusText}`);
  }
  return response.json();
}

// Group commands
export async function postGroup(groupId: string, action: string, body?: any) {
  const response = await apiFetch(`/groups/${groupId}/${action}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Failed to execute ${action} on group ${groupId}: ${response.statusText}`);
  }
  return response.json();
}

// Library management
export async function getLibraryFiles() {
  const response = await apiFetch('/library/files');
  if (!response.ok) {
    throw new Error(`Failed to fetch library files: ${response.statusText}`);
  }
  return response.json();
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/library/upload', {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type, let browser set it with boundary
    } as any,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteFile(fileId: string) {
  const response = await apiFetch(`/library/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
  return response.json();
}

// Playlists
export async function getPlaylists() {
  const response = await apiFetch('/playlists');
  if (!response.ok) {
    throw new Error(`Failed to fetch playlists: ${response.statusText}`);
  }
  return response.json();
}

export async function savePlaylist(playlist: { id?: string; name: string; items: { fileId: string }[] }) {
  const response = await apiFetch('/playlists', {
    method: 'POST',
    body: JSON.stringify(playlist),
  });
  if (!response.ok) {
    throw new Error(`Failed to save playlist: ${response.statusText}`);
  }
  return response.json();
}

// Kind-specific device status (for diagnostics only)
export async function getKindStatus(kind: 'audio' | 'video' | 'camera' | 'zigbee', deviceId: string) {
  const endpoints = {
    audio: `/audio/devices/${deviceId}/status`,
    video: `/video/devices/${deviceId}/status`,
    camera: `/camera/devices/${deviceId}/status`,
    zigbee: `/zigbee/hubs/${deviceId}/status`,
  };

  const response = await apiFetch(endpoints[kind]);
  if (!response.ok) {
    throw new Error(`Failed to get ${kind} device status: ${response.statusText}`);
  }
  return response.json();
}

// Health check
export async function getHealth() {
  const response = await apiFetch('/health');
  if (!response.ok) {
    throw new Error(`Failed to get health: ${response.statusText}`);
  }
  return response.json();
}

// Logs API
export async function getLogsSources() {
  const response = await apiFetch('/logs/sources');
  if (!response.ok) {
    throw new Error(`Failed to get logs sources: ${response.statusText}`);
  }
  return response.json();
}

export async function getLogs(params: {
  start?: string;
  end?: string;
  host?: string;
  level?: string;
  query?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const response = await apiFetch(`/logs?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to get logs: ${response.statusText}`);
  }
  return response.json();
}

export async function exportLogs(params: {
  start?: string;
  end?: string;
  host?: string;
  level?: string;
  query?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const response = await apiFetch(`/logs/export?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to export logs: ${response.statusText}`);
  }
  return response.blob();
}

export const API_CONFIG = {
  base: API_BASE,
  bearer: API_BEARER,
};
