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

export const API_CONFIG = {
  base: API_BASE,
  bearer: API_BEARER,
};
