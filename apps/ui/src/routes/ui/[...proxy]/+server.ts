import { error, json, type RequestHandler } from '@sveltejs/kit';
import { mockApi } from '$lib/api/mock';
import { proxyFleetRequest, type ProxyFallbackContext } from '$lib/server/proxy';

type ProxyFallback = (context: ProxyFallbackContext) => Promise<Response | unknown> | Response | unknown;
import type { AudioDeviceSnapshot, AudioState, SettingsState } from '$lib/types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RouteHandler = (context: ProxyFallbackContext, match: RegExpMatchArray) => Promise<Response | unknown> | Response | unknown;

interface RouteDefinition {
  pattern: RegExp;
  handlers: Partial<Record<HttpMethod, RouteHandler>>;
}

const normalisePath = (segment: string): string => {
  if (!segment) return '/';
  const collapsed = `/${segment}`.replace(/\/{2,}/g, '/');
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) || '/' : collapsed;
};

const decode = (value: string) => decodeURIComponent(value);

const nowIso = () => new Date().toISOString();

const toAudioDeviceStatus = (snapshot: AudioDeviceSnapshot) => {
  const online = snapshot.status === 'online';
  const basePlayback = snapshot.playback ?? ({} as AudioDeviceSnapshot['playback']);
  const source = (basePlayback as { source?: string }).source ?? 'stream';

  return {
    id: snapshot.id,
    displayName: snapshot.name,
    online,
    playback: {
      state: basePlayback.state,
      source,
      trackTitle: basePlayback.trackTitle,
      trackId: basePlayback.trackId,
      playlistId: basePlayback.playlistId,
      positionSeconds: basePlayback.positionSeconds,
      durationSeconds: basePlayback.durationSeconds,
      since: basePlayback.startedAt,
      errorMessage: basePlayback.lastError ?? null,
      syncGroup: basePlayback.syncGroup ?? null
    },
    volume: {
      level: online ? Math.max(0, snapshot.volumePercent / 100) : 0,
      locked: false,
      lastChangedBy: online ? 'mock' : null
    },
    lastSeen: snapshot.lastUpdated,
    capabilities: snapshot.capabilities,
    config: {
      streamUrl: null,
      mode: 'mock',
      defaultSource: source
    }
  };
};

const listAudioDevices = () => {
  const state = mockApi.audio();
  return {
    items: state.devices.map(toAudioDeviceStatus),
    nextCursor: null
  };
};

const ensureAudioDeviceSnapshot = (deviceId: string): AudioDeviceSnapshot => {
  const state = mockApi.audio();
  const snapshot = state.devices.find((device) => device.id === deviceId);
  if (!snapshot) {
    throw error(404, { message: `Audio device ${deviceId} not found` });
  }
  return snapshot;
};

const audioStateResponse = (): AudioState => mockApi.audio();

const buildHealthSummary = () => {
  const modules: { id: string; status: 'healthy' | 'degraded' | 'down'; message: string | null }[] = [];
  const audio = mockApi.audio();
  const totalAudio = audio.devices.length;
  const onlineAudio = audio.devices.filter((device) => device.status === 'online');
  const erroredAudio = audio.devices.filter((device) => device.status === 'error');

  if (totalAudio === 0) {
    modules.push({ id: 'audio', status: 'down', message: 'No audio devices registered' });
  } else if (onlineAudio.length === 0) {
    modules.push({ id: 'audio', status: 'down', message: `All ${totalAudio} audio devices offline` });
  } else if (erroredAudio.length) {
    modules.push({
      id: 'audio',
      status: 'degraded',
      message: `Devices with errors: ${erroredAudio.map((device) => device.id).join(', ')}`
    });
  } else {
    modules.push({ id: 'audio', status: 'healthy', message: null });
  }

  const layout = mockApi.layout();
  const otherModules = new Set((layout.modules ?? []).map((module) => module.module).filter((name) => name && name !== 'audio'));
  for (const moduleId of otherModules) {
    modules.push({ id: moduleId, status: 'degraded', message: 'Awaiting backend integration' });
  }

  const status = modules.some((module) => module.status === 'down')
    ? 'down'
    : modules.some((module) => module.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  return {
    status,
    updatedAt: nowIso(),
    modules
  };
};

const buildHealthEvents = () => ({ events: [], count: 0 });

const getCameraStreams = () => {
  const state = mockApi.camera();
  return {
    streams: state.devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: device.status,
      module: 'camera'
    })),
    total: state.devices.length,
    updatedAt: nowIso()
  };
};

const getCameraStreamStatus = (cameraId: string) => {
  const state = mockApi.camera();
  const device = state.devices.find((item) => item.id === cameraId);
  if (!device) {
    throw error(404, { message: `Camera ${cameraId} not found` });
  }
  return {
    id: device.id,
    name: device.name,
    status: device.status,
    reason: device.status === 'offline' ? 'Camera offline in mock data' : null,
    timestamp: nowIso()
  };
};

const buildRoutes = (): RouteDefinition[] => [
  {
    pattern: /^\/health\/summary$/,
    handlers: {
      GET: () => buildHealthSummary()
    }
  },
  {
    pattern: /^\/health\/events\/recent$/,
    handlers: {
      GET: () => buildHealthEvents()
    }
  },
  {
    pattern: /^\/logs$/,
    handlers: {
      GET: () => mockApi.logsSnapshot()
    }
  },
  {
    pattern: /^\/fleet\/layout$/,
    handlers: {
      GET: () => mockApi.layout()
    }
  },
  {
    pattern: /^\/fleet\/state$/,
    handlers: {
      GET: () => mockApi.state()
    }
  },
  {
    pattern: /^\/fleet\/overview$/,
    handlers: {
      GET: () => mockApi.fleetOverview()
    }
  },
  {
    pattern: /^\/fleet\/devices\/([^/]+)$/,
    handlers: {
      GET: (_, match) => mockApi.fleetDevice(decode(match[1]))
    }
  },
  {
    pattern: /^\/fleet\/devices\/([^/]+)\/actions\/([^/]+)$/,
    handlers: {
      POST: (_, match) => mockApi.fleetExecuteAction(decode(match[1]), decode(match[2]))
    }
  },
  {
    pattern: /^\/audio$/,
    handlers: {
      GET: () => audioStateResponse()
    }
  },
  {
    pattern: /^\/audio\/overview$/,
    handlers: {
      GET: () => audioStateResponse()
    }
  },
  {
    pattern: /^\/audio\/devices$/,
    handlers: {
      GET: () => listAudioDevices()
    }
  },
  {
    pattern: /^\/audio\/(?:devices\/)?([^/]+)$/,
    handlers: {
      GET: (_, match) => toAudioDeviceStatus(ensureAudioDeviceSnapshot(decode(match[1])))
    }
  },
  {
    pattern: /^\/audio\/(?:devices\/)?([^/]+)\/volume$/,
    handlers: {
      POST: async (ctx, match) => {
        const deviceId = decode(match[1]);
        const body = (await ctx.json()) as { volume?: number } | null;
        const volumeValue = typeof body?.volume === 'number' ? body.volume : 1;
        const percent = Math.round(Math.max(0, Math.min(2, volumeValue)) * 100);
        const snapshot = mockApi.audioSetVolume(deviceId, percent);
        return toAudioDeviceStatus(snapshot);
      }
    }
  },
  {
    pattern: /^\/audio\/(?:devices\/)?([^/]+)\/(pause|resume|stop|seek)$/,
    handlers: {
      POST: async (ctx, match) => {
        const deviceId = decode(match[1]);
        const action = match[2];
        if (action === 'pause') {
          return toAudioDeviceStatus(mockApi.audioPause(deviceId));
        }
        if (action === 'resume') {
          return toAudioDeviceStatus(mockApi.audioResume(deviceId));
        }
        if (action === 'stop') {
          return toAudioDeviceStatus(mockApi.audioStop(deviceId));
        }
        const body = (await ctx.json()) as { positionSeconds?: number } | null;
        const position = typeof body?.positionSeconds === 'number' ? body.positionSeconds : 0;
        return toAudioDeviceStatus(mockApi.audioSeek(deviceId, position));
      }
    }
  },
  {
    pattern: /^\/audio\/(?:devices\/)?([^/]+)\/play$/,
    handlers: {
      POST: async (ctx, match) => {
        const deviceId = decode(match[1]);
        const payload = (await ctx.json()) as {
          playlistId?: string | null;
          trackId?: string | null;
          resume?: boolean;
          startAtSeconds?: number;
        } | null;
        const state = mockApi.audioPlay({
          deviceIds: [deviceId],
          playlistId: payload?.playlistId ?? null,
          trackId: payload?.trackId ?? null,
          assignments: [],
          syncMode: 'independent',
          resume: payload?.resume ?? false,
          startAtSeconds: payload?.startAtSeconds ?? 0,
          loop: false
        });
        const snapshot = state.devices.find((device) => device.id === deviceId) ?? ensureAudioDeviceSnapshot(deviceId);
        return toAudioDeviceStatus(snapshot);
      }
    }
  },
  {
    pattern: /^\/audio\/playback$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as {
          deviceIds?: string[];
          playlistId?: string | null;
          trackId?: string | null;
          assignments?: { deviceId: string; trackId: string; startOffsetSeconds?: number }[];
          syncMode?: string;
          resume?: boolean;
          startAtSeconds?: number;
          loop?: boolean;
        } | null;
        if (!payload?.deviceIds?.length) {
          return audioStateResponse();
        }
        mockApi.audioPlay({
          deviceIds: payload.deviceIds,
          playlistId: payload.playlistId ?? null,
          trackId: payload.trackId ?? null,
          assignments: payload.assignments ?? [],
          syncMode: (payload.syncMode ?? 'independent') as AudioState['sessions'][number]['syncMode'],
          resume: payload.resume ?? false,
          startAtSeconds: payload.startAtSeconds ?? 0,
          loop: payload.loop ?? false
        });
        return audioStateResponse();
      }
    }
  },
  {
    pattern: /^\/audio\/master-volume$/,
    handlers: {
      POST: async (ctx) => {
        const body = (await ctx.json()) as { volume?: number } | null;
        const volumeValue = typeof body?.volume === 'number' ? body.volume : 1;
        const percent = Math.round(Math.max(0, Math.min(2, volumeValue)) * 100);
        return mockApi.audioSetMasterVolume(percent);
      }
    }
  },
  {
    pattern: /^\/audio\/playlists$/,
    handlers: {
      GET: () => mockApi.audio().playlists,
      POST: async (ctx) => {
        const payload = (await ctx.json()) as {
          name?: string;
          description?: string | null;
          loop?: boolean;
          syncMode?: 'independent' | 'synced' | 'grouped';
          tracks?: { trackId: string; order: number; startOffsetSeconds?: number; deviceOverrides?: Record<string, string> }[];
        } | null;

        const draft = {
          name: payload?.name ?? 'Untitled Playlist',
          description: payload?.description ?? null,
          loop: payload?.loop ?? false,
          syncMode: payload?.syncMode ?? 'independent',
          tracks: payload?.tracks ?? []
        };
        return mockApi.audioCreatePlaylist(draft);
      }
    }
  },
  {
    pattern: /^\/audio\/playlists\/([^/]+)$/,
    handlers: {
      PUT: async (ctx, match) => {
        const playlistId = decode(match[1]);
        const patch = (await ctx.json()) ?? {};
        return mockApi.audioUpdatePlaylist(playlistId, patch);
      },
      DELETE: (_, match) => {
        mockApi.audioDeletePlaylist(decode(match[1]));
        return new Response(null, { status: 204 });
      },
      GET: (_, match) => mockApi.audio().playlists.find((playlist) => playlist.id === decode(match[1]))
    }
  },
  {
    pattern: /^\/audio\/library$/,
    handlers: {
      POST: () => json({ message: 'Audio uploads are mocked only in UI' }, { status: 501 })
    }
  },
  {
    pattern: /^\/video\/overview$/,
    handlers: {
      GET: () => mockApi.video()
    }
  },
  {
    pattern: /^\/video$/,
    handlers: {
      GET: () => mockApi.video(),
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { power?: 'on' | 'off' } | null;
        const next = payload?.power ?? 'on';
        return mockApi.videoSetPower(next === 'on' ? 'on' : 'off');
      }
    }
  },
  {
    pattern: /^\/video\/recordings$/,
    handlers: {
      GET: () => mockApi.video().recordings
    }
  },
  {
    pattern: /^\/video\/power$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { on?: boolean } | null;
        return mockApi.videoSetPower(payload?.on ? 'on' : 'off');
      }
    }
  },
  {
    pattern: /^\/video\/input$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { input?: string } | null;
        return mockApi.videoSetInput(payload?.input ?? 'hdmi-1');
      }
    }
  },
  {
    pattern: /^\/video\/volume$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { level?: number } | null;
        const level = typeof payload?.level === 'number' ? payload.level : 50;
        return mockApi.videoSetVolume(level);
      }
    }
  },
  {
    pattern: /^\/video\/mute$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { mute?: boolean } | null;
        return mockApi.videoSetMute(Boolean(payload?.mute));
      }
    }
  },
  {
    pattern: /^\/video\/preview$/,
    handlers: {
      POST: () => {
        const preview = mockApi.video().livePreview;
        if (!preview?.streamUrl) {
          throw error(404, { message: 'Live preview unavailable in mock data' });
        }
        return { streamUrl: preview.streamUrl };
      }
    }
  },
  {
    pattern: /^\/zigbee$/,
    handlers: {
      GET: () => mockApi.zigbee()
    }
  },
  {
    pattern: /^\/zigbee\/overview$/,
    handlers: {
      GET: () => mockApi.zigbee()
    }
  },
  {
    pattern: /^\/zigbee\/devices\/([^/]+)\/action$/,
    handlers: {
      POST: async (ctx, match) => {
        const payload = (await ctx.json()) as { actionId?: string } | null;
        return mockApi.zigbeeRunAction(decode(match[1]), payload?.actionId ?? 'toggle');
      }
    }
  },
  {
    pattern: /^\/zigbee\/pairing$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { durationSeconds?: number; method?: string } | null;
        mockApi.zigbeeStartPairing(payload?.durationSeconds ?? 60);
        return mockApi.zigbee();
      },
      DELETE: () => mockApi.zigbeeStopPairing()
    }
  },
  {
    pattern: /^\/zigbee\/pairing\/discovered$/,
    handlers: {
      GET: () => mockApi.zigbeeDiscoverCandidate()
    }
  },
  {
    pattern: /^\/zigbee\/pairing\/([^/]+)$/,
    handlers: {
      POST: (_, match) => mockApi.zigbeeConfirmPairing(decode(match[1]))
    }
  },
  {
    pattern: /^\/settings$/,
    handlers: {
      GET: () => mockApi.settings()
    }
  },
  {
    pattern: /^\/settings\/proxy$/,
    handlers: {
      PATCH: async (ctx) => {
        const payload = (await ctx.json()) as { proxy?: Partial<SettingsState['proxy']> } | null;
        return mockApi.settingsUpdateProxy(payload?.proxy ?? {});
      }
    }
  },
  {
    pattern: /^\/settings\/api-token$/,
    handlers: {
      POST: () => mockApi.settingsRotateToken()
    }
  },
  {
    pattern: /^\/settings\/allowed-origins$/,
    handlers: {
      PUT: async (ctx) => {
        const payload = (await ctx.json()) as { origins?: string[] } | null;
        return mockApi.settingsUpdateApi({ allowedOrigins: payload?.origins ?? [] });
      }
    }
  },
  {
    pattern: /^\/settings\/pairing\/start$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { method?: string; durationSeconds?: number } | null;
        return mockApi.settingsStartPairing((payload?.method as SettingsState['pairing']['method']) ?? 'manual', payload?.durationSeconds ?? 120);
      }
    }
  },
  {
    pattern: /^\/settings\/pairing\/cancel$/,
    handlers: {
      POST: () => mockApi.settingsCancelPairing()
    }
  },
  {
    pattern: /^\/settings\/pairing\/([^/]+)\/claim$/,
    handlers: {
      POST: async (ctx, match) => {
        const payload = (await ctx.json()) as { deviceId?: string; note?: string; status?: 'success' | 'error' } | null;
        return mockApi.settingsClaimDiscovered(decode(match[1]), payload ?? {});
      }
    }
  },
  {
    pattern: /^\/settings\/operators$/,
    handlers: {
      POST: async (ctx) => {
        const payload = (await ctx.json()) as { name?: string; email?: string; roles?: string[] } | null;
        const current = mockApi.settings();
        const operator = {
          id: `op-${Math.random().toString(16).slice(2, 8)}`,
          name: payload?.name ?? 'Operator',
          email: payload?.email ?? 'operator@example.com',
          roles: payload?.roles ?? ['viewer'],
          status: 'invited' as const,
          lastActiveAt: null
        };
        return mockApi.settingsUpdate({ operators: [...current.operators, operator] });
      }
    }
  },
  {
    pattern: /^\/settings\/operators\/([^/]+)$/,
    handlers: {
      DELETE: (_, match) => {
        const current = mockApi.settings();
        const remaining = current.operators.filter((operator) => operator.id !== decode(match[1]));
        mockApi.settingsUpdate({ operators: remaining });
        return new Response(null, { status: 204 });
      }
    }
  },
  {
    pattern: /^\/camera$/,
    handlers: {
      GET: () => mockApi.camera()
    }
  },
  {
    pattern: /^\/camera\/overview$/,
    handlers: {
      GET: () => mockApi.camera()
    }
  },
  {
    pattern: /^\/camera\/summary$/,
    handlers: {
      GET: () => mockApi.cameraSummary()
    }
  },
  {
    pattern: /^\/camera\/streams$/,
    handlers: {
      GET: () => getCameraStreams()
    }
  },
  {
    pattern: /^\/camera\/streams\/([^/]+)\/status$/,
    handlers: {
      GET: (_, match) => getCameraStreamStatus(decode(match[1]))
    }
  },
  {
    pattern: /^\/camera\/events$/,
    handlers: {
      GET: () => mockApi.cameraEvents()
    }
  }
];

const ROUTES = buildRoutes();

const getFallback = (path: string, method: HttpMethod): ProxyFallback => {
  for (const definition of ROUTES) {
    const match = definition.pattern.exec(path);
    if (match) {
      const handler = definition.handlers[method];
      if (handler) {
        return (context) => handler(context, match);
      }
      break;
    }
  }
  return () => {
    throw error(404, { message: `No mock response defined for ${method} ${path}` });
  };
};

const createHandler = (method: HttpMethod): RequestHandler => async (event) => {
  const search = event.url.search ?? '';
  const cleanPath = normalisePath(event.params.proxy ?? '');
  const fallback = getFallback(cleanPath, method);
  return proxyFleetRequest(event, `${cleanPath}${search}`, fallback);
};

export const GET = createHandler('GET');
export const POST = createHandler('POST');
export const PUT = createHandler('PUT');
export const PATCH = createHandler('PATCH');
export const DELETE = createHandler('DELETE');
