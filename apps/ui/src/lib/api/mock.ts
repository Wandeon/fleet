import type {
  AudioDeviceSnapshot,
  AudioPlaylist,
  AudioPlaylistTrack,
  AudioSession,
  AudioState,
  CameraState,
  ConnectionProbe,
  LayoutData,
  LogsData,
  PowerState,
  VideoState,
  ZigbeeState
} from '$lib/types';

interface StateMock {
  connection: ConnectionProbe;
  build: {
    commit: string;
    version: string;
  };
}

const mockModules = import.meta.glob('./mocks/*.json', { eager: true }) as Record<string, { default: unknown }>;

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

const findTrackTitle = (state: AudioState, trackId: string | null): string | null => {
  if (!trackId) return null;
  const track = state.library.find((item) => item.id === trackId);
  return track ? track.title : null;
};

const refreshSessions = (state: AudioState) => {
  const activeIds = new Set(state.devices.filter((device) => device.playback.state === 'playing').map((device) => device.id));
  state.sessions = state.sessions.filter((session) => session.deviceIds.some((deviceId) => activeIds.has(deviceId)));
};

export const mockApi = {
  layout(): LayoutData {
    return readMock<LayoutData>('layout');
  },
  state(): StateMock {
    return readMock<StateMock>('state');
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
    const trackId = payload.fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + uuid().slice(0, 6);
    const duration = payload.durationSeconds ?? Math.max(120, Math.min(420, Math.round(payload.fileSizeBytes / 40960)));

    const track = {
      id: trackId,
      title: payload.title,
      artist: payload.artist ?? null,
      durationSeconds: duration,
      format: payload.mimeType?.split('/').pop() ?? 'mp3',
      sizeBytes: payload.fileSizeBytes,
      tags: payload.tags ?? [],
      uploadedAt: nowIso()
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
      tracks: payload.tracks
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
    assignments?: Array<{ deviceId: string; trackId: string; startOffsetSeconds?: number }>;
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
      device.playback.positionSeconds = payload.startAtSeconds ?? assignment?.startOffsetSeconds ?? 0;
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
      startedAt: timestamp
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
        startedAt: nowIso()
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
        streamUrl: state.livePreview.streamUrl.replace(/(input=)[^&]*/, `$1${encodeURIComponent(inputId)}`)
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
  zigbeeStartPairing(durationSeconds: number = 60) {
    const state = clone(getZigbeeState());
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    state.pairing = {
      active: true,
      expiresAt,
      discovered: []
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
      signal: Math.floor(50 + Math.random() * 40)
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
      battery: 100
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
  camera(): CameraState {
    return readMock<CameraState>('camera');
  },
  logs(): LogsData {
    return readMock<LogsData>('logs');
  }
};
