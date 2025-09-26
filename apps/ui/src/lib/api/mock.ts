import type {
  AudioDeviceSnapshot,
  AudioPlaylist,
  AudioPlaylistTrack,
  AudioSession,
  AudioState,
  CameraEvent,
  CameraState,
  DeviceStatus,
  FleetDeviceDetail,
  FleetOverview,
  FleetOverviewState,
  LayoutData,
  LogEntry,
  LogSeverity,
  LogsFilterState,
  LogsSnapshot,
  LogSource,
  PowerState,
  SettingsState,
  VideoState,
  ZigbeeState,
} from '$lib/types';

const mockModules = import.meta.glob('./mocks/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

function readMock<T>(name: string): T {
  const module = mockModules[`./mocks/${name}.json`];
  if (!module) {
    throw new Error(`Mock data for ${name} not found`);
  }

  return clone(module.default as T);
}

const uuid = (): string => {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return Math.random().toString(16).slice(2);
};

const nowIso = () => new Date().toISOString();

let audioStateCache: AudioState | null = null;
let videoStateCache: VideoState | null = null;
let zigbeeStateCache: ZigbeeState | null = null;
let cameraStateCache: CameraState | null = null;
let logsStateCache: { entries: LogEntry[]; sources: LogSource[]; lastUpdated: string } | null =
  null;
let settingsStateCache: SettingsState | null = null;
let fleetOverviewCache: FleetOverview | null = null;
const fleetDeviceCache = new Map<string, FleetDeviceDetail>();

const getAudioState = (): AudioState => {
  if (!audioStateCache) {
    audioStateCache = readMock<AudioState>('audio');
  }
  return audioStateCache;
};

const commitAudioState = (next: AudioState): AudioState => {
  audioStateCache = next;
  return clone(next);
};

const getVideoState = (): VideoState => {
  if (!videoStateCache) {
    videoStateCache = readMock<VideoState>('video');
  }
  return videoStateCache;
};

const commitVideoState = (next: VideoState): VideoState => {
  videoStateCache = next;
  return clone(next);
};

const getZigbeeState = (): ZigbeeState => {
  if (!zigbeeStateCache) {
    zigbeeStateCache = readMock<ZigbeeState>('zigbee');
  }
  return zigbeeStateCache;
};

const commitZigbeeState = (next: ZigbeeState): ZigbeeState => {
  zigbeeStateCache = next;
  return clone(next);
};

const getCameraState = (): CameraState => {
  if (!cameraStateCache) {
    cameraStateCache = readMock<CameraState>('camera');
  }
  return cameraStateCache;
};

const commitCameraState = (next: CameraState): CameraState => {
  cameraStateCache = next;
  return clone(next);
};

const getLogsState = () => {
  if (!logsStateCache) {
    const { entries, sources, lastUpdated } = readMock<{
      entries: LogEntry[];
      sources: LogSource[];
      lastUpdated: string;
    }>('logs');
    logsStateCache = {
      entries,
      sources,
      lastUpdated,
    };
  }
  return logsStateCache;
};

const commitLogsState = (next: {
  entries: LogEntry[];
  sources: LogSource[];
  lastUpdated: string;
}) => {
  logsStateCache = {
    entries: clone(next.entries),
    sources: clone(next.sources),
    lastUpdated: next.lastUpdated,
  };
  return clone(logsStateCache);
};

const getSettingsState = (): SettingsState => {
  if (!settingsStateCache) {
    settingsStateCache = readMock<SettingsState>('settings');
  }
  return settingsStateCache;
};

const commitSettingsState = (next: SettingsState): SettingsState => {
  settingsStateCache = next;
  return clone(next);
};

const getFleetOverview = (): FleetOverview => {
  if (!fleetOverviewCache) {
    fleetOverviewCache = readMock<FleetOverview>('fleet');
  }
  return fleetOverviewCache;
};

const commitFleetOverview = (next: FleetOverview): FleetOverview => {
  fleetOverviewCache = next;
  return clone(next);
};

const getFleetDevice = (deviceId: string): FleetDeviceDetail => {
  if (fleetDeviceCache.has(deviceId)) {
    return fleetDeviceCache.get(deviceId)!;
  }
  const safeDeviceId = deviceId.replace(/[^a-z0-9\-]/gi, '-');
  const key = `fleet-device-${safeDeviceId}`;
  let detail: FleetDeviceDetail;
  try {
    detail = readMock<FleetDeviceDetail>(key);
  } catch {
    const overview = getFleetOverview();
    const summary =
      overview.devices.find((device) => device.id === deviceId) ?? overview.devices[0];
    detail = {
      summary,
      metrics: [],
      alerts: [],
      logs: [],
      actions: [],
      connections: [],
    } satisfies FleetDeviceDetail;
  }
  fleetDeviceCache.set(deviceId, detail);
  return detail;
};

const commitFleetDevice = (deviceId: string, next: FleetDeviceDetail): FleetDeviceDetail => {
  fleetDeviceCache.set(deviceId, next);
  return clone(next);
};

const findTrackTitle = (state: AudioState, trackId: string | null): string | null => {
  if (!trackId) return null;
  const track = state.library.find((item) => item.id === trackId);
  return track ? track.title : null;
};

const refreshSessions = (state: AudioState) => {
  const activeIds = new Set(
    state.devices.filter((device) => device.playback.state === 'playing').map((device) => device.id)
  );
  state.sessions = state.sessions.filter((session) =>
    session.deviceIds.some((deviceId) => activeIds.has(deviceId))
  );
};

const severityRank: Record<LogSeverity, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  info: 1,
  debug: 0,
};

const normalizeSeverity = (value: unknown): LogSeverity => {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'warn') return 'warning';
    if (lower === 'err') return 'error';
    if (lower === 'crit' || lower === 'fatal') return 'critical';
    if (lower in severityRank) {
      return lower as LogSeverity;
    }
  }
  if (typeof value === 'number') {
    if (value <= 0) return 'debug';
    if (value === 1) return 'info';
    if (value === 2) return 'warning';
    if (value === 3) return 'error';
    if (value >= 4) return 'critical';
  }
  return 'info';
};

const filterLogs = (entries: LogEntry[], filters: Partial<LogsFilterState>): LogEntry[] => {
  return entries.filter((entry) => {
    const severity = normalizeSeverity(entry.severity);
    if (filters.severity && filters.severity !== 'all') {
      const desired = filters.severity;
      if (severityRank[severity] < severityRank[desired as LogSeverity]) {
        return false;
      }
    }

    if (filters.sourceId && filters.sourceId !== 'all') {
      if (entry.source !== filters.sourceId && entry.deviceId !== filters.sourceId) {
        return false;
      }
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      const values = [
        entry.message,
        entry.source,
        entry.deviceId ?? '',
        entry.module ?? '',
        entry.correlationId ?? '',
      ];
      if (!values.some((value) => value?.toLowerCase().includes(term))) {
        return false;
      }
    }

    return true;
  });
};

const sortLogsDesc = (entries: LogEntry[]): LogEntry[] =>
  [...entries].sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));

const mockApiBase = {
  layout(): LayoutData {
    return readMock<LayoutData>('layout');
  },
  state(): FleetOverviewState {
    return readMock<FleetOverviewState>('state');
  },
  audio(): AudioState {
    return clone(getAudioState());
  },
  audioUpload(payload: {
    title: string;
    artist?: string | null;
    tags?: string[];
    fileName: string;
    fileSizeBytes: number;
    mimeType?: string;
    durationSeconds?: number;
  }) {
    const state = clone(getAudioState());
    const trackId =
      payload.fileName
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') +
      '-' +
      uuid().slice(0, 6);
    const duration =
      payload.durationSeconds ??
      Math.max(120, Math.min(420, Math.round(payload.fileSizeBytes / 40960)));

    const track = {
      id: trackId,
      title: payload.title,
      artist: payload.artist ?? null,
      durationSeconds: duration,
      format: payload.mimeType?.split('/').pop() ?? 'mp3',
      sizeBytes: payload.fileSizeBytes,
      tags: payload.tags ?? [],
      uploadedAt: nowIso(),
    } satisfies AudioState['library'][number];

    state.library.push(track);
    commitAudioState(state);
    return clone(track);
  },
  audioCreatePlaylist(payload: {
    name: string;
    description?: string | null;
    loop: boolean;
    syncMode: AudioPlaylist['syncMode'];
    tracks: AudioPlaylistTrack[];
  }) {
    const state = clone(getAudioState());
    const playlist: AudioPlaylist = {
      id: `pl-${uuid()}`,
      name: payload.name,
      description: payload.description ?? null,
      loop: payload.loop,
      syncMode: payload.syncMode,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      tracks: payload.tracks,
    };

    state.playlists.push(playlist);
    commitAudioState(state);
    return clone(playlist);
  },
  audioUpdatePlaylist(id: string, payload: Partial<Omit<AudioPlaylist, 'id' | 'createdAt'>>) {
    const state = clone(getAudioState());
    const playlist = state.playlists.find((item) => item.id === id);
    if (!playlist) {
      throw new Error(`Playlist ${id} not found`);
    }

    if (payload.name !== undefined) playlist.name = payload.name;
    if (payload.description !== undefined) playlist.description = payload.description;
    if (payload.loop !== undefined) playlist.loop = payload.loop;
    if (payload.syncMode !== undefined) playlist.syncMode = payload.syncMode;
    if (payload.tracks !== undefined) playlist.tracks = payload.tracks;
    playlist.updatedAt = nowIso();

    commitAudioState(state);
    return clone(playlist);
  },
  audioDeletePlaylist(id: string) {
    const state = clone(getAudioState());
    state.playlists = state.playlists.filter((playlist) => playlist.id !== id);
    commitAudioState(state);
  },
  audioPlay(payload: {
    deviceIds: string[];
    playlistId?: string | null;
    assignments?: { deviceId: string; trackId: string; startOffsetSeconds?: number }[];
    trackId?: string | null;
    syncMode: AudioSession['syncMode'];
    resume?: boolean;
    startAtSeconds?: number;
    loop?: boolean;
  }): AudioState {
    const state = clone(getAudioState());
    const timestamp = nowIso();

    for (const deviceId of payload.deviceIds) {
      const device = state.devices.find((item) => item.id === deviceId);
      if (!device) continue;

      const assignment = payload.assignments?.find((item) => item.deviceId === deviceId);
      const trackId = assignment?.trackId ?? payload.trackId ?? null;
      device.playback.state = 'playing';
      device.playback.playlistId = payload.playlistId ?? null;
      device.playback.trackId = trackId;
      device.playback.trackTitle = findTrackTitle(state, trackId);
      device.playback.positionSeconds =
        payload.startAtSeconds ?? assignment?.startOffsetSeconds ?? 0;
      if (trackId) {
        const duration = state.library.find((item) => item.id === trackId)?.durationSeconds ?? 0;
        device.playback.durationSeconds = duration;
      }
      device.playback.startedAt = timestamp;
      device.playback.syncGroup = payload.syncMode !== 'independent' ? payload.syncMode : null;
      device.lastUpdated = timestamp;
    }

    const session: AudioSession = {
      id: `session-${uuid()}`,
      playlistId: payload.playlistId ?? null,
      deviceIds: payload.deviceIds,
      syncMode: payload.syncMode,
      state: 'playing',
      startedAt: timestamp,
    };

    state.sessions.push(session);
    refreshSessions(state);
    return commitAudioState(state);
  },
  audioPause(deviceId: string): AudioDeviceSnapshot {
    const state = clone(getAudioState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    device.playback.state = 'paused';
    device.lastUpdated = nowIso();
    return commitAudioState(state).devices.find((item) => item.id === deviceId)!;
  },
  audioResume(deviceId: string): AudioDeviceSnapshot {
    const state = clone(getAudioState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    device.playback.state = 'playing';
    device.playback.startedAt = nowIso();
    device.lastUpdated = device.playback.startedAt;
    return commitAudioState(state).devices.find((item) => item.id === deviceId)!;
  },
  audioStop(deviceId: string): AudioDeviceSnapshot {
    const state = clone(getAudioState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    device.playback.state = 'idle';
    device.playback.trackId = null;
    device.playback.trackTitle = null;
    device.playback.playlistId = null;
    device.playback.positionSeconds = 0;
    device.playback.durationSeconds = 0;
    device.playback.startedAt = null;
    device.playback.syncGroup = null;
    device.lastUpdated = nowIso();
    refreshSessions(state);
    return commitAudioState(state).devices.find((item) => item.id === deviceId)!;
  },
  audioSeek(deviceId: string, positionSeconds: number): AudioDeviceSnapshot {
    const state = clone(getAudioState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    device.playback.positionSeconds = Math.max(0, Math.round(positionSeconds));
    device.lastUpdated = nowIso();
    return commitAudioState(state).devices.find((item) => item.id === deviceId)!;
  },
  audioSetVolume(deviceId: string, volumePercent: number): AudioDeviceSnapshot {
    const state = clone(getAudioState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    device.volumePercent = Math.max(0, Math.min(200, Math.round(volumePercent)));
    device.lastUpdated = nowIso();
    return commitAudioState(state).devices.find((item) => item.id === deviceId)!;
  },
  audioSetMasterVolume(volumePercent: number): AudioState {
    const state = clone(getAudioState());
    state.masterVolume = Math.max(0, Math.min(200, Math.round(volumePercent)));
    return commitAudioState(state);
  },
  video(): VideoState {
    return clone(getVideoState());
  },
  videoSetPower(power: PowerState): VideoState {
    const state = clone(getVideoState());
    state.power = power;
    if (state.livePreview) {
      state.livePreview = {
        ...state.livePreview,
        status: power === 'on' ? 'ready' : 'connecting',
        startedAt: nowIso(),
      };
    }
    state.lastSignal = nowIso();
    return commitVideoState(state);
  },
  videoSetInput(inputId: string): VideoState {
    const state = clone(getVideoState());
    state.input = inputId;
    if (state.livePreview) {
      state.livePreview = {
        ...state.livePreview,
        status: 'connecting',
        startedAt: nowIso(),
        streamUrl: state.livePreview.streamUrl.replace(
          /(input=)[^&]*/,
          `$1${encodeURIComponent(inputId)}`
        ),
      };
    }
    state.lastSignal = nowIso();
    return commitVideoState(state);
  },
  videoSetVolume(volume: number): VideoState {
    const state = clone(getVideoState());
    state.volume = Math.max(0, Math.min(100, Math.round(volume)));
    return commitVideoState(state);
  },
  videoSetMute(muted: boolean): VideoState {
    const state = clone(getVideoState());
    state.muted = muted;
    return commitVideoState(state);
  },
  zigbee(): ZigbeeState {
    return clone(getZigbeeState());
  },
  zigbeeStartPairing(durationSeconds = 60) {
    const state = clone(getZigbeeState());
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    state.pairing = {
      active: true,
      expiresAt,
      discovered: [],
    };
    return commitZigbeeState(state).pairing;
  },
  zigbeeStopPairing() {
    const state = clone(getZigbeeState());
    if (state.pairing) {
      state.pairing.active = false;
    }
    return commitZigbeeState(state).pairing;
  },
  zigbeeDiscoverCandidate() {
    const state = clone(getZigbeeState());
    if (!state.pairing || !state.pairing.active) {
      return commitZigbeeState(state).pairing;
    }
    const id = `zigbee-${Math.random().toString(16).slice(2, 8)}`;
    state.pairing.discovered.push({
      id,
      name: `Discovered ${id.slice(-3).toUpperCase()}`,
      type: Math.random() > 0.5 ? 'Sensor' : 'Dimmer',
      signal: Math.floor(50 + Math.random() * 40),
    });
    return commitZigbeeState(state).pairing;
  },
  zigbeeConfirmPairing(deviceId: string) {
    const state = clone(getZigbeeState());
    if (!state.pairing) {
      throw new Error('Pairing session not active');
    }
    const index = state.pairing.discovered.findIndex((item) => item.id === deviceId);
    if (index === -1) {
      throw new Error(`Discovered device ${deviceId} not found`);
    }
    const candidate = state.pairing.discovered.splice(index, 1)[0];
    state.devices.push({
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      state: 'inactive',
      lastSeen: nowIso(),
      battery: 100,
    });
    state.pairing.active = false;
    return commitZigbeeState(state);
  },
  zigbeeRunAction(deviceId: string, actionId: string) {
    const state = clone(getZigbeeState());
    const device = state.devices.find((item) => item.id === deviceId);
    if (device) {
      if (actionId === 'open') {
        device.state = 'open';
      } else if (actionId === 'close') {
        device.state = 'closed';
      } else {
        device.state = 'active';
      }
      device.lastSeen = nowIso();
    }
    return commitZigbeeState(state);
  },
};

interface MockApiExtensions {
  camera(): CameraState;
  cameraSummary(): {
    status: 'online' | 'offline' | 'degraded';
    updatedAt: string;
    reason: string | null;
    cameras: {
      id: string;
      name: string;
      status: 'online' | 'offline' | 'degraded';
      lastSeen?: string | null;
      reason?: string | null;
    }[];
  };
  cameraEvents(): {
    items: {
      id: string;
      ts: string;
      message: string;
      severity: 'info' | 'warn' | 'error';
      cameraId?: string | null;
      snapshotUrl?: string | null;
    }[];
    updatedAt: string;
  };
  cameraPreview(cameraId: string): {
    cameraId: string | null;
    status: 'ready' | 'pending' | 'unavailable';
    posterUrl: string | null;
    streamUrl: string | null;
    reason?: string | null;
    updatedAt: string;
  };
  cameraSelect(cameraId: string): CameraState;
  cameraAcknowledge(eventId: string): CameraState;
  cameraAddEvent(
    event: Omit<CameraEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): CameraEvent;
  cameraRefreshPreview(cameraId?: string): CameraState;
  logsSnapshot(
    filters?: Partial<LogsFilterState> & { limit?: number; cursor?: string | null }
  ): LogsSnapshot;
  logs(): LogsSnapshot;
  logsAppend(
    entry: Partial<LogEntry> & { message: string; severity?: LogSeverity; source?: string }
  ): LogEntry;
  logsStream(filters: Partial<LogsFilterState>, onEvent: (entry: LogEntry) => void): () => void;
  settings(): SettingsState;
  settingsUpdate(partial: Partial<SettingsState>): SettingsState;
  settingsUpdateApi(partial: Partial<SettingsState['api']>): SettingsState;
  settingsUpdateProxy(partial: Partial<SettingsState['proxy']>): SettingsState;
  settingsRotateToken(): SettingsState;
  settingsStartPairing(
    method: SettingsState['pairing']['method'],
    durationSeconds?: number
  ): SettingsState;
  settingsCancelPairing(): SettingsState;
  settingsClaimDiscovered(
    candidateId: string,
    overrides?: { deviceId?: string; note?: string; status?: 'success' | 'error' }
  ): SettingsState;
  fleetOverview(): FleetOverview;
  fleetDevice(deviceId: string): FleetDeviceDetail;
  fleetExecuteAction(deviceId: string, actionId: string): FleetDeviceDetail;
}

type MockApi = typeof mockApiBase & MockApiExtensions;

export const mockApi = mockApiBase as MockApi;

const mockApiExtensions: MockApiExtensions = {
  camera(): CameraState {
    return clone(getCameraState());
  },
  cameraSummary() {
    const state = clone(getCameraState());
    const updatedAt = state.overview.updatedAt ?? nowIso();
    const normaliseStatus = (status: DeviceStatus): 'online' | 'offline' | 'degraded' => {
      if (status === 'online') return 'online';
      if (status === 'error') return 'offline';
      return 'degraded';
    };

    const cameras = state.devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: normaliseStatus(device.status),
      lastSeen: device.lastHeartbeat,
      reason: device.status === 'error' ? 'Device offline' : null,
    }));

    const status = (() => {
      if (cameras.every((camera) => camera.status === 'offline')) return 'offline';
      if (cameras.some((camera) => camera.status === 'degraded')) return 'degraded';
      if (cameras.some((camera) => camera.status === 'online')) return 'online';
      return 'offline';
    })();

    const reason =
      status === 'online'
        ? null
        : state.overview.health === 'error'
          ? 'Camera bridge offline'
          : state.overview.health === 'offline'
            ? 'No camera heartbeat received'
            : state.overview.health === 'online'
              ? null
              : 'Camera health degraded';

    return { status, updatedAt, reason, cameras };
  },
  cameraEvents() {
    const state = clone(getCameraState());
    const updatedAt = state.overview.updatedAt ?? nowIso();
    const mapSeverity = (severity: CameraEvent['severity']): 'info' | 'warn' | 'error' => {
      if (severity === 'alert' || severity === 'error') return 'error';
      if (severity === 'warning') return 'warn';
      return 'info';
    };

    const items = state.events.map((event) => ({
      id: event.id,
      ts: event.timestamp,
      message: event.description,
      severity: mapSeverity(event.severity),
      cameraId: event.cameraId,
      snapshotUrl: event.snapshotUrl ?? null,
    }));

    return { items, updatedAt };
  },
  cameraPreview(cameraId: string) {
    const state = clone(getCameraState());
    const updatedAt = state.overview.updatedAt ?? nowIso();
    const activeId = cameraId || state.activeCameraId;
    const device = activeId ? state.devices.find((item) => item.id === activeId) : null;
    if (!device) {
      return {
        cameraId: activeId ?? null,
        status: 'unavailable',
        posterUrl: state.overview.previewImage,
        streamUrl: state.overview.streamUrl,
        reason: 'Camera not found',
        updatedAt,
      };
    }

    const streamUrl = device.streamUrl ?? state.overview.streamUrl;
    const hasStream = Boolean(streamUrl);

    return {
      cameraId: device.id,
      status: hasStream ? 'ready' : 'pending',
      posterUrl: device.stillUrl ?? state.overview.previewImage,
      streamUrl,
      reason: hasStream ? null : 'Stream unavailable in mock data',
      updatedAt,
    };
  },
  cameraSelect(cameraId: string): CameraState {
    const state = clone(getCameraState());
    if (!state.devices.some((device) => device.id === cameraId)) {
      return clone(state);
    }
    state.activeCameraId = cameraId;
    const active = state.devices.find((device) => device.id === cameraId)!;
    state.overview = {
      ...state.overview,
      streamUrl: active.streamUrl ?? state.overview.streamUrl,
      previewImage: active.stillUrl ?? state.overview.previewImage,
      health: active.status,
      updatedAt: nowIso(),
      lastMotion:
        state.events.find((event) => event.cameraId === cameraId)?.timestamp ??
        state.overview.lastMotion,
    };
    return commitCameraState(state);
  },
  cameraAcknowledge(eventId: string): CameraState {
    const state = clone(getCameraState());
    const event = state.events.find((item) => item.id === eventId);
    if (event) {
      event.acknowledged = true;
    }
    return commitCameraState(state);
  },
  cameraAddEvent(
    event: Omit<CameraEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): CameraEvent {
    const state = clone(getCameraState());
    const entry: CameraEvent = {
      id: event.id ?? `cam-evt-${uuid().slice(0, 6)}`,
      timestamp: event.timestamp ?? nowIso(),
      acknowledged: false,
      tags: [],
      ...event,
    };
    state.events.unshift(entry);
    state.overview.lastMotion = entry.timestamp;
    state.overview.updatedAt = nowIso();
    commitCameraState(state);
    return clone(entry);
  },
  cameraRefreshPreview(cameraId?: string): CameraState {
    const state = clone(getCameraState());
    const activeId = cameraId ?? state.activeCameraId;
    if (activeId) {
      const device = state.devices.find((item) => item.id === activeId);
      if (device) {
        state.overview.streamUrl = device.streamUrl ?? state.overview.streamUrl;
        state.overview.previewImage = device.stillUrl ?? state.overview.previewImage;
        state.overview.health = device.status;
      }
    }
    state.overview.updatedAt = nowIso();
    return commitCameraState(state);
  },
  logs(): LogsSnapshot {
    const state = getLogsState();
    return {
      entries: clone(state.entries),
      sources: clone(state.sources),
      lastUpdated: state.lastUpdated,
      cursor: state.entries.at(-1)?.id ?? null,
    } satisfies LogsSnapshot;
  },
  logsSnapshot(
    filters: Partial<LogsFilterState> & { limit?: number; cursor?: string | null } = {}
  ): LogsSnapshot {
    const state = getLogsState();
    const filtered = filterLogs(sortLogsDesc(state.entries), filters);
    const limited =
      typeof filters.limit === 'number' ? filtered.slice(0, Math.max(filters.limit, 0)) : filtered;
    const snapshot: LogsSnapshot = {
      entries: clone(limited),
      sources: clone(state.sources),
      cursor: limited.at(-1)?.id ?? null,
      lastUpdated: nowIso(),
    };
    commitLogsState({
      entries: state.entries,
      sources: state.sources,
      lastUpdated: snapshot.lastUpdated ?? nowIso(),
    });
    return snapshot;
  },
  logsAppend(
    entry: Partial<LogEntry> & { message: string; severity?: LogSeverity; source?: string }
  ): LogEntry {
    const state = getLogsState();
    const source = entry.source ?? 'control-plane';
    const severity = normalizeSeverity(entry.severity ?? 'info');
    const record: LogEntry = {
      id: entry.id ?? `log-${uuid().slice(0, 8)}`,
      timestamp: entry.timestamp ?? nowIso(),
      severity,
      message: entry.message,
      source,
      module: entry.module ?? 'system',
      deviceId: entry.deviceId ?? null,
      correlationId: entry.correlationId ?? null,
      context: entry.context ?? null,
    };
    const nextEntries = [...state.entries, record];
    commitLogsState({ entries: nextEntries, sources: state.sources, lastUpdated: nowIso() });
    return clone(record);
  },
  logsStream(filters: Partial<LogsFilterState>, onEvent: (entry: LogEntry) => void): () => void {
    const interval = setInterval(() => {
      const generated: Partial<LogEntry> & {
        message: string;
        severity?: LogSeverity;
        source?: string;
      } = {
        message: 'Mock heartbeat ok',
        severity:
          filters.severity && filters.severity !== 'all'
            ? (filters.severity as LogSeverity)
            : undefined,
        source: filters.sourceId && filters.sourceId !== 'all' ? filters.sourceId : 'control-plane',
        module: filters.sourceId && filters.sourceId?.startsWith('pi-') ? 'device' : 'system',
      };
      const newEntry = mockApi.logsAppend(generated);
      if (!filters.search) {
        onEvent(newEntry);
        return;
      }
      const matches = filterLogs([newEntry], filters);
      if (matches.length) {
        onEvent(matches[0]!);
      }
    }, 5000);
    return () => clearInterval(interval);
  },
  settings(): SettingsState {
    return clone(getSettingsState());
  },
  settingsUpdate(partial: Partial<SettingsState>): SettingsState {
    const current = clone(getSettingsState());
    const next: SettingsState = {
      ...current,
      ...partial,
      api: { ...current.api, ...(partial.api ?? {}) },
      proxy: { ...current.proxy, ...(partial.proxy ?? {}) },
      pairing: { ...current.pairing, ...(partial.pairing ?? {}) },
      operators: partial.operators ? clone(partial.operators) : current.operators,
      roles: partial.roles ? clone(partial.roles) : current.roles,
      pendingRestart: partial.pendingRestart ?? current.pendingRestart,
      lastSavedAt: nowIso(),
    };
    return commitSettingsState(next);
  },
  settingsUpdateApi(partial: Partial<SettingsState['api']>): SettingsState {
    return mockApi.settingsUpdate({ api: { ...getSettingsState().api, ...partial } });
  },
  settingsUpdateProxy(partial: Partial<SettingsState['proxy']>): SettingsState {
    return mockApi.settingsUpdate({ proxy: { ...getSettingsState().proxy, ...partial } });
  },
  settingsRotateToken(): SettingsState {
    const rotated = `sk_live_${uuid().slice(0, 4)}****${uuid().slice(-4)}`;
    const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    return mockApi.settingsUpdate({
      api: {
        ...getSettingsState().api,
        bearerTokenMasked: rotated,
        lastRotatedAt: nowIso(),
        expiresAt: expires,
      },
      pendingRestart: true,
    });
  },
  settingsStartPairing(
    method: SettingsState['pairing']['method'],
    durationSeconds = 120
  ): SettingsState {
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const candidates = getSettingsState().pairing.discovered ?? [];
    return mockApi.settingsUpdate({
      pairing: {
        ...getSettingsState().pairing,
        active: true,
        method,
        expiresAt,
        discovered: clone(candidates),
      },
    });
  },
  settingsCancelPairing(): SettingsState {
    return mockApi.settingsUpdate({
      pairing: {
        ...getSettingsState().pairing,
        active: false,
        expiresAt: null,
      },
    });
  },
  settingsClaimDiscovered(
    candidateId: string,
    overrides: { deviceId?: string; note?: string; status?: 'success' | 'error' } = {}
  ): SettingsState {
    const current = clone(getSettingsState());
    const remaining = current.pairing.discovered.filter((item) => item.id !== candidateId);
    const candidate = current.pairing.discovered.find((item) => item.id === candidateId);
    const history = [...current.pairing.history];
    if (candidate) {
      history.unshift({
        id: `pair-${uuid().slice(0, 6)}`,
        completedAt: nowIso(),
        deviceId: overrides.deviceId ?? candidate.id,
        status: overrides.status ?? 'success',
        note: overrides.note ?? `Paired ${candidate.name}`,
      });
    }
    return mockApi.settingsUpdate({
      pairing: {
        ...current.pairing,
        active: false,
        expiresAt: null,
        discovered: remaining,
        history,
      },
    });
  },
  fleetOverview(): FleetOverview {
    return clone(getFleetOverview());
  },
  fleetDevice(deviceId: string): FleetDeviceDetail {
    return clone(getFleetDevice(deviceId));
  },
  fleetExecuteAction(deviceId: string, actionId: string): FleetDeviceDetail {
    const detail = clone(getFleetDevice(deviceId));
    detail.logs.unshift({
      id: `action-${uuid().slice(0, 6)}`,
      timestamp: nowIso(),
      severity: actionId === 'reboot' ? 'warning' : 'info',
      message: `Executed ${actionId}`,
      source: deviceId,
      module: detail.summary.module,
      deviceId,
      correlationId: uuid(),
      context: { actionId },
    });
    if (actionId === 'reboot') {
      detail.alerts.unshift({
        id: `alert-${uuid().slice(0, 6)}`,
        message: 'Device reboot initiated from control plane',
        severity: 'warning',
        createdAt: nowIso(),
        acknowledged: false,
      });
      detail.summary.status = 'online';
    }
    commitFleetDevice(deviceId, detail);
    const overview = clone(getFleetOverview());
    overview.devices = overview.devices.map((device) =>
      device.id === deviceId
        ? { ...device, status: detail.summary.status, lastSeen: nowIso() }
        : device
    );
    commitFleetOverview(overview);
    return clone(detail);
  },
};

Object.assign(mockApi, mockApiExtensions);
