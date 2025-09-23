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
    const extra = (await getAdditionalHeaders?.()) ?? {};
    const correlationId = correlationIdFactory?.();
    return {
      ...extra,
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    };
  };
};

// Configure defaults immediately so the client works out of the box.
configureApiClient();

export const FleetApi = {
  getLayout: () => FleetService.getFleetLayout(),
  getState: () => FleetService.getFleetState(),
};

export const AudioApi = {
  listDevices: (limit?: number, cursor?: string) => AudioService.getAudioDevices(limit, cursor),
  getDevice: (id: string) => AudioService.getAudio(id),
  play: (id: string, payload: Parameters<typeof AudioService.postAudioPlay>[1]) =>
    AudioService.postAudioPlay(id, payload),
  stop: (id: string) => AudioService.postAudioStop(id),
  setVolume: (id: string, payload: Parameters<typeof AudioService.postAudioVolume>[1]) =>
    AudioService.postAudioVolume(id, payload),
  updateConfig: (id: string, payload: Parameters<typeof AudioService.putAudioConfig>[1]) =>
    AudioService.putAudioConfig(id, payload),
};

export const VideoApi = {
  getTv: () => VideoService.getVideoTv(),
  setPower: (payload: Parameters<typeof VideoService.postVideoTvPower>[0]) =>
    VideoService.postVideoTvPower(payload),
  setInput: (payload: Parameters<typeof VideoService.postVideoTvInput>[0]) =>
    VideoService.postVideoTvInput(payload),
  setVolume: (payload: Parameters<typeof VideoService.postVideoTvVolume>[0]) =>
    VideoService.postVideoTvVolume(payload),
  setMute: (payload: Parameters<typeof VideoService.postVideoTvMute>[0]) =>
    VideoService.postVideoTvMute(payload),
};

export const ZigbeeApi = {
  listDevices: (limit?: number, cursor?: string) => ZigbeeService.getZigbeeDevices(limit, cursor),
  runAction: (id: string, payload: Parameters<typeof ZigbeeService.postZigbeeDevicesAction>[1]) =>
    ZigbeeService.postZigbeeDevicesAction(id, payload),
};

export const CameraApi = {
  getSummary: () => CameraService.getCameraSummary(),
  getEvents: (
    limit?: number,
    cursor?: string,
    since?: string,
  ) => CameraService.getCameraEvents(limit, cursor, since),
  getPreview: (id: string) => CameraService.getCameraPreview(id),
};

export const HealthApi = {
  getSummary: () => HealthService.getHealthSummary(),
  getRecentEvents: (limit?: number, cursor?: string) => HealthService.getEventsRecent(limit, cursor),
};
