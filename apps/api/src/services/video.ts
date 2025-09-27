import { randomUUID } from 'node:crypto';
import { enqueueJob } from './jobs.js';
import { createHttpError } from '../util/errors.js';
import { deviceRegistry } from '../upstream/devices.js';

type PowerState = 'on' | 'standby';

type PlaybackState = {
  status: 'idle' | 'playing' | 'paused' | 'stopped';
  source: string | null;
  startedAt: string | null;
};

type VideoDeviceState = {
  deviceId: string;
  name: string;
  power: PowerState;
  mute: boolean;
  input: string;
  volume: number;
  availableInputs: string[];
  playback: PlaybackState;
  busyUntil: number | null;
  lastJobId: string | null;
  lastUpdated: string;
};

const BUSY_WINDOW_MS = 3_000;
const DEFAULT_INPUTS = ['hdmi1', 'hdmi2', 'chromecast'];

const deviceStateStore = new Map<string, VideoDeviceState>();

function ensureState(deviceId: string): VideoDeviceState {
  const existing = deviceStateStore.get(deviceId);
  if (existing) {
    return existing;
  }
  const device = deviceRegistry.getDevice(deviceId);
  const now = new Date().toISOString();
  const state: VideoDeviceState = {
    deviceId,
    name: device?.name ?? deviceId,
    power: 'standby',
    mute: false,
    input: 'hdmi1',
    volume: 30,
    availableInputs: [...DEFAULT_INPUTS],
    playback: { status: 'idle', source: null, startedAt: null },
    busyUntil: null,
    lastJobId: null,
    lastUpdated: now,
  };
  deviceStateStore.set(deviceId, state);
  return state;
}

function updateState(deviceId: string, patch: Partial<VideoDeviceState>): VideoDeviceState {
  const current = ensureState(deviceId);
  const next: VideoDeviceState = {
    ...current,
    ...patch,
    lastUpdated: new Date().toISOString(),
  };
  deviceStateStore.set(deviceId, next);
  return next;
}

function assertNotBusy(state: VideoDeviceState) {
  if (state.busyUntil && state.busyUntil > Date.now()) {
    throw createHttpError(409, 'device_busy', 'HDMI-CEC bus is busy, retry shortly');
  }
}

async function queueDeviceCommand(
  deviceId: string,
  command: string,
  payload: Record<string, unknown> | null,
  patch: Partial<VideoDeviceState>
) {
  const state = ensureState(deviceId);
  assertNotBusy(state);
  const job = await enqueueJob(deviceId, command, payload);
  const updated = updateState(deviceId, {
    ...patch,
    busyUntil: Date.now() + BUSY_WINDOW_MS,
    lastJobId: job.id,
  });
  return { jobId: job.id, state: updated };
}

export function listVideoDevices() {
  return deviceRegistry
    .list()
    .filter((device) => device.module === 'video' || device.role.includes('video'))
    .map((device) => {
      const state = ensureState(device.id);
      return {
        id: device.id,
        name: device.name,
        module: device.module,
        role: device.role,
        status: state.power === 'on' ? 'online' : 'standby',
        power: state.power,
        mute: state.mute,
        input: state.input,
        volumePercent: state.volume,
        availableInputs: state.availableInputs,
        playback: state.playback,
        lastJobId: state.lastJobId,
        busy: Boolean(state.busyUntil && state.busyUntil > Date.now()),
        lastUpdated: state.lastUpdated,
      };
    });
}

export async function setDevicePower(deviceId: string, power: PowerState) {
  const patch: Partial<VideoDeviceState> = { power };
  if (power === 'standby') {
    patch.playback = { status: 'stopped', source: null, startedAt: null };
  } else if (power === 'on') {
    const current = ensureState(deviceId);
    if (current.playback.status === 'stopped') {
      patch.playback = { status: 'idle', source: null, startedAt: null };
    }
  }
  const { jobId, state } = await queueDeviceCommand(deviceId, 'tv.power', { power }, patch);
  return { jobId, state };
}

export async function setDeviceMute(deviceId: string, mute: boolean) {
  const { jobId, state } = await queueDeviceCommand(deviceId, 'tv.mute', { mute }, { mute });
  return { jobId, state };
}

export async function setDeviceInput(deviceId: string, input: string) {
  const normalized = input.toLowerCase();
  const existing = ensureState(deviceId);
  if (!existing.availableInputs.includes(normalized)) {
    throw createHttpError(422, 'invalid_input', `Input ${input} is not available`);
  }
  const { jobId, state } = await queueDeviceCommand(
    deviceId,
    'tv.input',
    { source: normalized },
    { input: normalized }
  );
  return { jobId, state };
}

export async function setDeviceVolume(deviceId: string, volume: number) {
  const safeVolume = Math.max(0, Math.min(100, Math.round(volume)));
  const { jobId, state } = await queueDeviceCommand(
    deviceId,
    'tv.volume',
    { level: safeVolume },
    { volume: safeVolume }
  );
  return { jobId, state };
}

export async function runDevicePlayback(
  deviceId: string,
  action: 'play' | 'pause' | 'resume' | 'stop',
  payload: { url?: string | null; startSeconds?: number | null }
) {
  const existing = ensureState(deviceId);
  const patch: Partial<VideoDeviceState> = {};
  const playback: PlaybackState = { ...existing.playback };

  switch (action) {
    case 'play': {
      if (!payload.url) {
        throw createHttpError(400, 'missing_media_url', 'Playback requires a media URL');
      }
      playback.status = 'playing';
      playback.source = payload.url;
      playback.startedAt = new Date().toISOString();
      break;
    }
    case 'pause': {
      if (playback.status !== 'playing') {
        throw createHttpError(409, 'invalid_state', 'Cannot pause when playback is not active');
      }
      playback.status = 'paused';
      break;
    }
    case 'resume': {
      if (playback.status !== 'paused') {
        throw createHttpError(409, 'invalid_state', 'Cannot resume when playback is not paused');
      }
      playback.status = 'playing';
      break;
    }
    case 'stop': {
      playback.status = 'stopped';
      playback.source = null;
      playback.startedAt = null;
      break;
    }
    default: {
      throw createHttpError(400, 'invalid_action', `Unsupported playback action: ${action}`);
    }
  }

  patch.playback = playback;

  const { jobId, state } = await queueDeviceCommand(deviceId, `media.${action}`, payload, patch);
  return { jobId, state };
}

export function requestPreviewSession(deviceId?: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const targetDevice = deviceId ? ensureState(deviceId) : null;
  return {
    sessionId,
    streamUrl: `https://video.example/preview/${sessionId}`,
    expiresAt,
    device: targetDevice
      ? {
          id: targetDevice.deviceId,
          name: targetDevice.name,
          input: targetDevice.input,
        }
      : null,
  };
}

export function listRecordingSegments() {
  return [
    {
      id: 'segment-001',
      deviceId: 'video-primary',
      startedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 3500 * 1000).toISOString(),
      durationSeconds: 600,
      status: 'available',
    },
    {
      id: 'segment-002',
      deviceId: 'video-primary',
      startedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 1500 * 1000).toISOString(),
      durationSeconds: 300,
      status: 'processing',
    },
  ];
}

export function createClipExport(
  recordingId: string,
  payload: { startOffsetSeconds: number; endOffsetSeconds: number }
) {
  const exportId = randomUUID();
  return {
    exportId,
    recordingId,
    status: 'queued',
    startOffsetSeconds: payload.startOffsetSeconds,
    endOffsetSeconds: payload.endOffsetSeconds,
    requestedAt: new Date().toISOString(),
    downloadUrl: `https://video.example/exports/${exportId}.mp4`,
  };
}
