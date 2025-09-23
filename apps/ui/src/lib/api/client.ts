import { browser } from '$app/environment';
import { mockApi } from './mock';
import type { AudioState, CameraState, LayoutData, LogsData, VideoState, ZigbeeState } from '$lib/types';
import type { ConnectionProbe } from '$lib/types';

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends RequestInit {
  method?: HttpMethod;
  fetch?: typeof fetch;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TOKEN = import.meta.env.VITE_FLEET_API_TOKEN;
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === '1';
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createHeaders(existing?: HeadersInit): Headers {
  const headers = new Headers(existing ?? {});
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && existing && typeof existing === 'object') {
    // keep caller choice
  }
  if (TOKEN) {
    headers.set('Authorization', `Bearer ${TOKEN}`);
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return undefined as T;
  }
  const body = await response.json();
  return body as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (USE_MOCKS) {
    await wait(browser ? 200 : 20);
    switch (path) {
      case '/layout':
        return mockApi.layout() as T;
      case '/state':
        return mockApi.state() as T;
      case '/audio':
        return mockApi.audio() as T;
      case '/video':
        return mockApi.video() as T;
      case '/zigbee':
        return mockApi.zigbee() as T;
      case '/camera':
        return mockApi.camera() as T;
      case '/logs':
        return mockApi.logs() as T;
      default:
        throw new ApiError(`Mock endpoint ${path} not implemented`, 501);
    }
  }

  const method = options.method ?? 'GET';
  const fetcher = options.fetch ?? fetch;
  const headers = createHeaders(options.headers);
  const init: RequestInit = { ...options, method, headers };
  let attempt = 0;

  while (attempt <= 2) {
    const response = await fetcher(`${API_BASE}${path}`, init);
    if (response.ok) {
      return handleResponse<T>(response);
    }

    if (method === 'GET' && RETRYABLE_STATUS.has(response.status) && attempt < 2) {
      attempt += 1;
      await wait(150 * attempt);
      continue;
    }

    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    throw new ApiError(response.statusText || 'Request failed', response.status, detail);
  }

  throw new ApiError('Max retries exceeded', 500);
}

export const apiClient = {
  async fetchLayout(options?: RequestOptions): Promise<LayoutData> {
    return request<LayoutData>('/layout', options);
  },
  async fetchState(options?: RequestOptions): Promise<{ connection: ConnectionProbe; build: { commit: string; version: string } }> {
    return request('/state', options);
  },
  async fetchAudio(options?: RequestOptions): Promise<AudioState> {
    return request('/audio', options);
  },
  async fetchVideo(options?: RequestOptions): Promise<VideoState> {
    return request('/video', options);
  },
  async fetchZigbee(options?: RequestOptions): Promise<ZigbeeState> {
    return request('/zigbee', options);
  },
  async fetchCamera(options?: RequestOptions): Promise<CameraState> {
    return request('/camera', options);
  },
  async fetchLogs(options?: RequestOptions): Promise<LogsData> {
    return request('/logs', options);
  }
};

export type ApiClient = typeof apiClient;

export type LoadFetch = typeof fetch;
