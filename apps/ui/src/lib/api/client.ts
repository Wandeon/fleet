
import {
  AudioService,
  CameraService,
  FleetService,
  LogsService,
  OpenAPI,
  SettingsService,
  VideoService,
  ZigbeeService,
} from './gen';
import type {
  AllowedOriginsRequest,
  AudioMasterVolumeRequest,
  AudioPlaybackRequest,
  AudioPlaylist,
  AudioPlaylistTrack, // eslint-disable-line @typescript-eslint/no-unused-vars
  AudioSeekRequest,
  AudioVolumeRequest,
  CameraClipRequest,
  CameraSelectionRequest,
  InviteOperatorRequest,
  PairingClaimRequest,
  PairingStartRequest,
  ProxyUpdateRequest,
  VideoPreviewRequest,
  ZigbeeActionRequest,
  ZigbeePairingStartRequest,
} from './gen';

export type {
  AllowedOriginsRequest,
  AudioDeviceSnapshot,
  AudioLibraryTrack,
  AudioMasterVolumeRequest,
  AudioPlaybackAssignment,
  AudioPlaybackRequest,
  AudioPlaylist,
  AudioPlaylistTrack,
  AudioSeekRequest,
  AudioSession,
  AudioState,
  AudioVolumeRequest,
  CameraClip,
  CameraClipRequest,
  CameraClipResponse,
  CameraDevice,
  CameraEvent,
  CameraPreviewState,
  CameraSelectionRequest,
  CameraState,
  DeviceStatus,
  FleetDeviceAction,
  FleetDeviceAlert,
  FleetDeviceDetail,
  FleetDeviceMetric,
  FleetDeviceSummary,
  FleetOverview,
  LogEntry,
  LogSource,
  LogsSnapshot,
  OperatorAccount,
  OperatorRole,
  ProxySettings,
  ProxySettingsPatch,
  ProxyUpdateRequest,
  SettingsState,
  VideoPreviewRequest,
  VideoRecordingSegment,
  ZigbeeActionRequest,
  ZigbeePairingStartRequest,
  ZigbeePairingState,
  ZigbeeState,
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

export interface ApiRequestContext {
  fetch?: typeof fetch;
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
  getOverview: () => FleetService.getFleetOverview(),
  getDeviceDetail: (deviceId: string) => FleetService.getFleetDeviceDetail(deviceId),
  triggerDeviceAction: (deviceId: string, actionId: string) =>
    FleetService.triggerFleetDeviceAction(deviceId, actionId),
};

export const AudioApi = {
  getOverview: () => AudioService.getAudioOverview(),
  getDevice: (deviceId: string) => AudioService.getAudioDevice(deviceId),
  uploadAudioTrack: (formData: Parameters<typeof AudioService.uploadAudioTrack>[0]) =>
    AudioService.uploadAudioTrack(formData),
  createPlaylist: (payload: AudioPlaylist) => AudioService.createAudioPlaylist(payload),
  updatePlaylist: (playlistId: string, payload: AudioPlaylist) =>
    AudioService.updateAudioPlaylist(playlistId, payload),
  deletePlaylist: (playlistId: string) => AudioService.deleteAudioPlaylist(playlistId),
  startPlayback: (payload: AudioPlaybackRequest) => AudioService.startAudioPlayback(payload),
  pauseDevice: (deviceId: string) => AudioService.pauseAudioDevice(deviceId),
  resumeDevice: (deviceId: string) => AudioService.resumeAudioDevice(deviceId),
  stopDevice: (deviceId: string) => AudioService.stopAudioDevice(deviceId),
  seekDevice: (deviceId: string, payload: AudioSeekRequest) =>
    AudioService.seekAudioDevice(deviceId, payload),
  setDeviceVolume: (deviceId: string, payload: AudioVolumeRequest) =>
    AudioService.setAudioDeviceVolume(deviceId, payload),
  setMasterVolume: (payload: AudioMasterVolumeRequest) =>
    AudioService.setAudioMasterVolume(payload),
};

interface LegacyTvStatus {
  id: string;
  displayName: string;
  online?: boolean;
  power: 'on' | 'off';
  input: string;
  availableInputs?: string[];
  volume: number;
  mute: boolean;
  lastSeen: string;
}

export const VideoApi = {
  getOverview: () => VideoService.getVideoOverview(),
  getRecordings: () => VideoService.getVideoRecordings(),
  generatePreview: (payload?: VideoPreviewRequest) => VideoService.generateVideoPreview(payload),
  getTv: () => request<LegacyTvStatus>('/video/tv'),
  setPower: (payload: { on: boolean }) =>
    request<LegacyTvStatus>('/video/tv/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  setInput: (payload: { input: string }) =>
    request<LegacyTvStatus>('/video/tv/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  setVolume: (payload: { level: number }) =>
    request<LegacyTvStatus>('/video/tv/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  setMute: (payload: { mute: boolean }) =>
    request<LegacyTvStatus>('/video/tv/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

export const ZigbeeApi = {
  getOverview: () => ZigbeeService.getZigbeeOverview(),
  runAction: (deviceId: string, payload: ZigbeeActionRequest) =>
    ZigbeeService.runZigbeeAction(deviceId, payload),
  startPairing: (payload?: ZigbeePairingStartRequest) => ZigbeeService.startZigbeePairing(payload),
  stopPairing: () => ZigbeeService.stopZigbeePairing(),
  pollDiscovered: () => ZigbeeService.pollZigbeeDiscovered(),
  confirmPairing: (deviceId: string) => ZigbeeService.confirmZigbeePairing(deviceId),
};

export const CameraApi = {
  getOverview: () => CameraService.getCameraOverview(),
  selectCamera: (payload: CameraSelectionRequest) => CameraService.selectCamera(payload),
  acknowledgeEvent: (eventId: string) => CameraService.acknowledgeCameraEvent(eventId),
  requestClip: (eventId: string, payload: CameraClipRequest) =>
    CameraService.requestCameraClip(eventId, payload),
  refreshCamera: (cameraId: string) => CameraService.refreshCamera(cameraId),
};

export const LogsApi = {
  getSnapshot: (
    source?: string,
    level?: Parameters<typeof LogsService.getLogs>[1],
    q?: string,
    limit?: number,
    cursor?: string,
  ) => LogsService.getLogs(source, level, q, limit ?? 50, cursor),
  stream: (
    source?: string,
    level?: Parameters<typeof LogsService.streamLogs>[1],
    q?: string,
    accept?: string,
  ) => LogsService.streamLogs(source, level, q, accept),
};

export const SettingsApi = {
  getSettings: () => SettingsService.getSettings(),
  updateProxy: (payload: ProxyUpdateRequest) => SettingsService.updateProxySettings(payload),
  rotateApiToken: () => SettingsService.rotateApiToken(),
  updateAllowedOrigins: (payload: AllowedOriginsRequest) =>
    SettingsService.updateAllowedOrigins(payload),
  startPairing: (payload: PairingStartRequest) => SettingsService.startSettingsPairing(payload),
  cancelPairing: () => SettingsService.cancelSettingsPairing(),
  claimPairingCandidate: (candidateId: string, payload?: PairingClaimRequest) =>
    SettingsService.claimPairingCandidate(candidateId, payload),
  inviteOperator: (payload: InviteOperatorRequest) => SettingsService.inviteOperator(payload),
  removeOperator: (operatorId: string) => SettingsService.removeOperator(operatorId),
};

import { browser } from '$app/environment';
import { mockApi } from './mock';
import type {
  AudioState,
  CameraState,
  FleetOverviewState,
  LayoutData,
  VideoState,
  ZigbeeState
} from '$lib/types';

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
        return mockApi.logsSnapshot() as T;
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
  async fetchState(options?: RequestOptions): Promise<FleetOverviewState> {
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
  }
};

export type ApiClient = typeof apiClient;

export type LoadFetch = typeof fetch;

export { request as rawRequest };

export const API_BASE_URL = API_BASE;
