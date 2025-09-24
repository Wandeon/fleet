
import {
  AudioService,
  CameraService,
  FleetService,
  HealthService,
  OpenAPI,
  VideoService,
  ZigbeeService,
} from './gen';

export type {
  AudioConfigRequest,
  AudioConfigResponse,
  AudioConfigState,
  AudioDeviceList,
  AudioDeviceStatus,
  AudioPlaybackState,
  AudioPlayRequest,
  AudioStopResponse,
  AudioVolumeRequest,
  AudioVolumeResponse,
  AudioVolumeState,
  CameraEvent,
  CameraEvents,
  CameraStateSummary,
  CameraPreview,
  CameraSummary,
  CameraSummaryItem,
  CameraStorageSummary,
  FleetLayout,
  FleetState,
  HealthSummary,
  ModuleHealth,
  RecentEvent,
  RecentEvents,
  TvInputRequest,
  TvMuteRequest,
  TvPowerRequest,
  TvStatus,
  TvVolumeRequest,
  ZigbeeActionRequest,
  ZigbeeDeviceList,
  ZigbeeStateSummary,
} from './gen';

export { ApiError, CancelablePromise, CancelError } from './gen';

export interface ApiClientOptions {
  /** Base URL for API calls. Defaults to `/api`. */
  baseUrl?: string;
  /** Lazily resolves the bearer token for each request. */
  getToken?: () => string | Promise<string>;
  /** Generates a correlation identifier per request. */
  correlationIdFactory?: () => string;
  /** Additional headers to include with every request. */
  getAdditionalHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

const defaultCorrelationIdFactory = (): string => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return Math.random().toString(16).slice(2);
};

export const configureApiClient = (options: ApiClientOptions = {}): void => {
  const {
    baseUrl,
    getToken,
    correlationIdFactory = defaultCorrelationIdFactory,
    getAdditionalHeaders,
  } = options;

  OpenAPI.BASE = baseUrl ?? '/api';
  OpenAPI.TOKEN = getToken
    ? async () => {
        const value = await getToken();
        return value;
      }
    : undefined;

  OpenAPI.HEADERS = async () => {
    const extra = ((await getAdditionalHeaders?.()) ?? {}) as Record<string, string>;
    const correlationId = correlationIdFactory?.();
    const headers: Record<string, string> = { ...extra };
    if (correlationId) {
      headers['x-correlation-id'] = correlationId;
    }
    return headers;
  };
};

export const FleetApi = {
  getLayout: () => FleetService.getFleetLayout(),
  getState: () => FleetService.getFleetState(),
};

export const AudioApi = {
  listDevices: (limit?: number, cursor?: string) => AudioService.listAudioDevices(limit, cursor),
  getDevice: (id: string) => AudioService.getAudioDevice(id),
  play: (id: string, payload: Parameters<typeof AudioService.playAudioDevice>[1]) =>
    AudioService.playAudioDevice(id, payload),
  stop: (id: string) => AudioService.stopAudioDevice(id),
  setVolume: (id: string, payload: Parameters<typeof AudioService.setAudioDeviceVolume>[1]) =>
    AudioService.setAudioDeviceVolume(id, payload),
  updateConfig: (id: string, payload: Parameters<typeof AudioService.updateAudioDeviceConfig>[1]) =>
    AudioService.updateAudioDeviceConfig(id, payload),
};

export const VideoApi = {
  getTv: () => VideoService.getTvStatus(),
  setPower: (payload: Parameters<typeof VideoService.setTvPower>[0]) =>
    VideoService.setTvPower(payload),
  setInput: (payload: Parameters<typeof VideoService.setTvInput>[0]) =>
    VideoService.setTvInput(payload),
  setVolume: (payload: Parameters<typeof VideoService.setTvVolume>[0]) =>
    VideoService.setTvVolume(payload),
  setMute: (payload: Parameters<typeof VideoService.setTvMute>[0]) =>
    VideoService.setTvMute(payload),
};

export const ZigbeeApi = {
  listDevices: (limit?: number, cursor?: string) => ZigbeeService.listZigbeeDevices(limit, cursor),
  runAction: (id: string, payload: Parameters<typeof ZigbeeService.runZigbeeDeviceAction>[1]) =>
    ZigbeeService.runZigbeeDeviceAction(id, payload),
};

export const CameraApi = {
  getSummary: () => CameraService.getCameraSummary(),
  getEvents: (limit?: number, cursor?: string, since?: string) =>
    CameraService.listCameraEvents(limit, cursor, since),
  getPreview: (id: string) => CameraService.getCameraPreview(id),
};

export const HealthApi = {
  getSummary: () => HealthService.getHealthSummary(),
  getRecentEvents: (limit?: number, cursor?: string) => HealthService.getRecentEvents(limit, cursor),
};

import { browser } from '$app/environment';
import { mockApi } from './mock';
import type { AudioState, CameraState, LayoutData, LogsData, VideoState, ZigbeeState } from '$lib/types';
import type { ConnectionProbe } from '$lib/types';

const trimTrailingSlash = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.replace(/\/$/, '');
};

const resolveServerEnv = (): NodeJS.ProcessEnv => {
  if (browser) {
    return {} as NodeJS.ProcessEnv;
  }
  return (globalThis.process?.env ?? {}) as NodeJS.ProcessEnv;
};

const resolveServerBase = (): string => {
  const env = resolveServerEnv();
  const base = (env.API_BASE_URL ?? '').trim();
  return trimTrailingSlash(base);
};

const resolveServerAuth = (): string | null => {
  if (browser) {
    return null;
  }
  const env = resolveServerEnv();
  const raw = (env.API_BEARER ?? '').trim();
  if (!raw) {
    return null;
  }
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
};

const DEFAULT_RELATIVE_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE ?? '/api');
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === '1';
const API_BASE = browser ? '/ui' : resolveServerBase() || DEFAULT_RELATIVE_BASE || '/api';

configureApiClient({
  baseUrl: API_BASE,
  getAdditionalHeaders: async () => {
    const headers: Record<string, string> = {};
    if (USE_MOCKS) {
      return headers;
    }
    const auth = resolveServerAuth();
    if (auth) {
      headers.Authorization = auth;
    }
    return headers;
  },
});

export class UiApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown = undefined) {
    super(message);
    this.name = 'UiApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends RequestInit {
  method?: HttpMethod;
  fetch?: typeof fetch;
}

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
  if (!headers.has('Authorization')) {
    const auth = resolveServerAuth();
    if (!USE_MOCKS && auth) {
      headers.set('Authorization', auth);
    }
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  try {
    const body = await response.json();
    return body as T;
  } catch {
    return undefined as T;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (USE_MOCKS) {
    await wait(browser ? 200 : 20);
    switch (path) {
      case '/fleet/layout':
        return mockApi.layout() as T;
      case '/fleet/state':
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
        throw new UiApiError(`Mock endpoint ${path} not implemented`, 501);
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

    // Clone response before reading body to prevent "Body has already been read" error
    const responseClone = response.clone();
    let detail: unknown;
    try {
      detail = await responseClone.json();
    } catch {
      detail = await responseClone.text();
    }

    throw new UiApiError(response.statusText || 'Request failed', response.status, detail);
  }

  throw new UiApiError('Max retries exceeded', 500);
}

export const apiClient = {
  async fetchLayout(options?: RequestOptions): Promise<LayoutData> {
    return request<LayoutData>('/fleet/layout', options);
  },
  async fetchState(options?: RequestOptions): Promise<{ connection: ConnectionProbe; build: { commit: string; version: string } }> {
    return request('/fleet/state', options);
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

export { request as rawRequest };

export const API_BASE_URL = API_BASE;
